import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  AI_PROVIDERS,
  DEFAULT_AI_MODEL,
  chatCompletionsEndpoint,
  detectProtocol,
  isAllowedSettingKey,
  isProviderId,
  parseResponsesBody,
  providerSettingKeys,
  responsesEndpoint,
  type AiProtocol,
} from '@/lib/ai-pricing'

// ไม่ส่งค่าลับกลับให้ client — ส่งแค่ mask
function mask(value: string): string {
  if (!value) return ''
  return `••••••${value.slice(-4)}`
}

// GET /api/app-settings — ค่าของทุกผู้ให้บริการ + เจ้าที่ใช้งาน + สรุปการใช้
export async function GET() {
  try {
    const rows = await db.appSetting.findMany()
    const byKey = new Map(rows.map(r => [r.key, r]))

    const active = byKey.get('ai_provider')?.value || AI_PROVIDERS[0].id

    const providers = AI_PROVIDERS.map(p => {
      const keys = providerSettingKeys(p.id)
      const keyRow = byKey.get(keys.apiKey)
      return {
        id: p.id,
        label: p.label,
        hint: p.hint,
        presetUrl: p.baseUrl,
        presetModel: p.model,
        url: byKey.get(keys.url)?.value ?? '',
        model: byKey.get(keys.model)?.value ?? '',
        protocol: byKey.get(keys.protocol)?.value ?? 'auto',
        hasKey: !!keyRow,
        masked: keyRow ? mask(keyRow.value) : '',
        updatedAt: byKey.get(keys.url)?.updatedAt ?? null,
        active: p.id === active,
      }
    })

    // สรุปการใช้ Token credits 30 วันล่าสุด — ให้หน้า /settings แสดงคู่กับสถานะการเชื่อมต่อ
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const [usageAgg, user] = await Promise.all([
      db.searchQuery.aggregate({
        where: { createdAt: { gte: since } },
        _sum: { tokensUsed: true, creditsUsed: true },
        _count: { _all: true },
      }),
      db.user.findUnique({ where: { email: 'demo@taxlaw.ai' }, include: { wallet: true } }),
    ])

    return NextResponse.json({
      active,
      providers,
      usage: {
        days: 30,
        queries: usageAgg._count._all,
        tokens: usageAgg._sum.tokensUsed ?? 0,
        credits: usageAgg._sum.creditsUsed ?? 0,
        balance: user?.wallet?.balance ?? 0,
      },
    })
  } catch (err) {
    console.error('App settings API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/app-settings  { key, value }  — value ว่าง = ลบ setting นั้น
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const key = String(body.key ?? '')
    const value = String(body.value ?? '').trim()

    if (!isAllowedSettingKey(key)) {
      return NextResponse.json({ error: `ไม่รู้จักคีย์ "${key}"` }, { status: 400 })
    }
    if (key === 'ai_provider' && !isProviderId(value)) {
      return NextResponse.json({ error: `ไม่รู้จักผู้ให้บริการ "${value}"` }, { status: 400 })
    }

    if (!value) {
      await db.appSetting.deleteMany({ where: { key } })
      return NextResponse.json({ ok: true, key, cleared: true })
    }

    if (key.endsWith('_api_url')) {
      try {
        new URL(value)
      } catch {
        return NextResponse.json({ error: 'URL ไม่ถูกต้อง (ต้องขึ้นต้นด้วย http:// หรือ https://)' }, { status: 400 })
      }
    }

    const isSecret = key.endsWith('_api_key')
    const saved = await db.appSetting.upsert({
      where: { key },
      update: { value, isSecret },
      create: { key, value, isSecret },
    })

    return NextResponse.json({
      ok: true,
      key,
      hasValue: true,
      masked: isSecret ? mask(saved.value) : undefined,
    })
  } catch (err) {
    console.error('App settings API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/app-settings — ทดสอบการเชื่อมต่อของผู้ให้บริการ (ค่าเริ่มต้น = เจ้าที่ใช้งาน)
// body: { provider?: 'kob' | 'kie' } · ใช้ค่าที่บันทึกไว้ · ไม่หักเครดิตของผู้ใช้
export async function POST(req: NextRequest) {
  try {
    let requestedProvider = ''
    try {
      const body = await req.json()
      requestedProvider = String(body?.provider ?? '')
    } catch {
      requestedProvider = ''
    }

    const rows = await db.appSetting.findMany()
    const byKey = new Map(rows.map(r => [r.key, r]))
    const providerId = isProviderId(requestedProvider)
      ? requestedProvider
      : byKey.get('ai_provider')?.value || AI_PROVIDERS[0].id

    const keys = providerSettingKeys(providerId)
    const url = byKey.get(keys.url)?.value?.trim() || ''
    const apiKey = byKey.get(keys.apiKey)?.value?.trim() || ''
    const model = byKey.get(keys.model)?.value?.trim() || DEFAULT_AI_MODEL
    const savedProtocol = (byKey.get(keys.protocol)?.value || 'auto').toLowerCase()

    if (!url || !apiKey) {
      return NextResponse.json({ ok: false, provider: providerId, error: 'ยังไม่ได้ตั้งค่า URL หรือ API Key ของผู้ให้บริการนี้' })
    }

    const protocol: AiProtocol = savedProtocol === 'chat' || savedProtocol === 'responses' ? savedProtocol : detectProtocol(url)
    const started = Date.now()

    // ---- โปรโตคอล OpenAI Responses (เช่น kie.ai) ----
    if (protocol === 'responses') {
      const endpoint = responsesEndpoint(url)
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          instructions: 'ตอบสั้นที่สุด',
          input: 'ตอบคำว่า OK',
          reasoning: { effort: 'none' },
        }),
        signal: AbortSignal.timeout(30000),
      })
      const latencyMs = Date.now() - started
      const raw = await res.text()

      if (!res.ok) {
        return NextResponse.json({ ok: false, provider: providerId, protocol, endpoint, model, latencyMs, error: `HTTP ${res.status} — ${raw.slice(0, 200)}` })
      }
      const parsed = parseResponsesBody(raw)
      if (parsed.error) {
        return NextResponse.json({ ok: false, provider: providerId, protocol, endpoint, model, latencyMs, error: parsed.error })
      }
      if (!parsed.text) {
        return NextResponse.json({ ok: false, provider: providerId, protocol, endpoint, model, latencyMs, error: 'ได้การตอบกลับแต่ไม่มีข้อความ' })
      }
      return NextResponse.json({
        ok: true,
        provider: providerId,
        protocol,
        endpoint,
        model,
        latencyMs,
        tokens: parsed.tokens > 0 ? parsed.tokens : null,
        reply: parsed.text.slice(0, 100),
        providerCredits: parsed.providerCredits,
      })
    }

    // ---- โปรโตคอล chat completions ----
    const endpoint = chatCompletionsEndpoint(url)
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 8,
        messages: [{ role: 'user', content: 'ตอบคำว่า OK' }],
      }),
      signal: AbortSignal.timeout(20000),
    })
    const latencyMs = Date.now() - started
    const raw = await res.text()

    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        provider: providerId,
        protocol,
        error: `HTTP ${res.status} — ${raw.slice(0, 200)}`,
        endpoint,
        model,
        latencyMs,
      })
    }

    let tokens: number | null = null
    let reply = ''
    try {
      const json = JSON.parse(raw)
      const total = Number(json?.usage?.total_tokens)
      tokens = Number.isFinite(total) && total > 0 ? total : null
      reply = String(json?.choices?.[0]?.message?.content || '').slice(0, 100)
    } catch {
      reply = raw.slice(0, 100)
    }

    return NextResponse.json({ ok: true, provider: providerId, protocol, endpoint, model, latencyMs, tokens, reply })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
