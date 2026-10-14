import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { AI_PROVIDERS } from '@/lib/ai-pricing'

interface LogMeta {
  queryId?: string
  chunkCount?: number
  engine?: string
  tokens?: number
  credits?: number
  protocol?: string | null
  provider?: string | null
  providerCredits?: number | null
  durationMs?: number
  status?: string
  sections?: number
  category?: string
  fileName?: string
  code?: string
  documentId?: string
}

// GET /api/ai-log — ประวัติการใช้งาน AI (ค้นหา · อัปโหลดประมวลผล) + สรุปโทเคน/เครดิต
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '60', 10) || 60, 200)
    const kind = searchParams.get('kind') || 'all' // all | ai | keyword | upload

    const user = await db.user.findUnique({
      where: { email: 'demo@taxlaw.ai' },
      include: { wallet: true },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const allLogs = await db.usageLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    const metaOf = (raw: string | null): LogMeta => {
      if (!raw) return {}
      try {
        return JSON.parse(raw) as LogMeta
      } catch {
        return {}
      }
    }

    // ดึงข้อมูลคำค้นที่เกี่ยวข้อง (ข้อความคำถาม/ระยะเวลา/สถานะ)
    const queryIds = new Set<string>()
    for (const l of allLogs) {
      const m = metaOf(l.metadata)
      if (m.queryId) queryIds.add(m.queryId)
    }
    const queries = queryIds.size
      ? await db.searchQuery.findMany({
          where: { id: { in: [...queryIds] } },
          select: { id: true, query: true, mode: true, status: true, durationMs: true, chunkCount: true },
        })
      : []
    const qMap = new Map(queries.map(q => [q.id, q]))

    const mapped = allLogs.map(l => {
      const m = metaOf(l.metadata)
      const q = m.queryId ? qMap.get(m.queryId) : undefined
      const isUpload = l.action === 'upload_law_doc'
      const engine = m.engine ?? (l.action.startsWith('search_') ? 'keyword' : null)
      const providerLabel = m.provider
        ? AI_PROVIDERS.find(p => p.id === m.provider)?.label ?? m.provider
        : null

      return {
        id: l.id,
        createdAt: l.createdAt,
        action: l.action,
        kind: isUpload ? 'upload' : engine === 'ai' ? 'ai' : 'keyword',
        engine,
        provider: m.provider ?? null,
        providerLabel,
        protocol: m.protocol ?? null,
        tokens: Number(m.tokens) || 0,
        credits: l.creditsCost,
        providerCredits: typeof m.providerCredits === 'number' ? m.providerCredits : null,
        durationMs: m.durationMs ?? q?.durationMs ?? null,
        status: q?.status ?? (isUpload ? (engine === 'ai' ? 'success' : 'registered') : null),
        category: m.category ?? null,
        sections: m.sections ?? null,
        fileName: m.fileName ?? null,
        detail: q?.query ?? m.fileName ?? (m.code ? `เอกสาร ${m.code}` : l.action),
      }
    })

    const logs = kind === 'all' ? mapped.slice(0, limit) : mapped.filter(l => l.kind === kind).slice(0, limit)

    // ---- สรุปยอด (ทั้งประวัติ ไม่จำกัดตามหน้า) ----
    const summary = {
      totalRequests: mapped.length,
      aiRequests: mapped.filter(l => l.engine === 'ai').length,
      keywordRequests: mapped.filter(l => l.kind === 'keyword').length,
      uploadRequests: mapped.filter(l => l.kind === 'upload').length,
      tokens: mapped.reduce((s, l) => s + l.tokens, 0),
      credits: mapped.reduce((s, l) => s + l.credits, 0),
      providerCredits: mapped.reduce((s, l) => s + (l.providerCredits ?? 0), 0),
      avgDurationMs: (() => {
        const withTime = mapped.filter(l => typeof l.durationMs === 'number' && l.durationMs > 0)
        if (!withTime.length) return 0
        return Math.round(withTime.reduce((s, l) => s + (l.durationMs || 0), 0) / withTime.length)
      })(),
      lastUsedAt: mapped[0]?.createdAt ?? null,
    }

    const byProvider = AI_PROVIDERS.map(p => {
      const rows = mapped.filter(l => l.provider === p.id)
      return {
        id: p.id,
        label: p.label,
        requests: rows.length,
        tokens: rows.reduce((s, l) => s + l.tokens, 0),
        credits: rows.reduce((s, l) => s + l.credits, 0),
        providerCredits: rows.reduce((s, l) => s + (l.providerCredits ?? 0), 0),
      }
    })

    const activeRow = await db.appSetting.findUnique({ where: { key: 'ai_provider' } })
    const activeProvider = activeRow?.value && AI_PROVIDERS.some(p => p.id === activeRow.value) ? activeRow.value : null

    return NextResponse.json({
      logs,
      summary,
      byProvider,
      balance: user.wallet?.balance ?? 0,
      activeProvider,
    })
  } catch (err) {
    console.error('AI log API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
