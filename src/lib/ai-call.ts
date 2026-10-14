// ตัวกลางเรียก AI — ใช้ร่วมทั้ง /api/search และ /api/upload
import { db } from '@/lib/db'
import {
  AI_PROVIDERS,
  DEFAULT_AI_MODEL,
  ZERO_HALLUCINATION_SYSTEM_PROMPT,
  chatCompletionsEndpoint,
  detectProtocol,
  estimateTokens,
  parseResponsesBody,
  providerSettingKeys,
  responsesEndpoint,
  type AiProtocol,
} from '@/lib/ai-pricing'

export interface AiConfig {
  url: string
  apiKey: string
  model: string
  protocol: AiProtocol
  providerId: string
}

export interface AiTextResult {
  content: string
  tokens: number
  providerCredits: number | null
  protocol: AiProtocol
  providerId: string
}

// อ่านค่าการเชื่อมต่อ AI ของ "ผู้ให้บริการที่เลือก" (ai_provider) — auto = เดาโปรโตคอลจาก URL
export async function getAiConfig(): Promise<AiConfig | null> {
  const rows = await db.appSetting.findMany()
  const byKey = new Map(rows.map(r => [r.key, r]))

  const providerId = byKey.get('ai_provider')?.value || AI_PROVIDERS[0].id
  const keys = providerSettingKeys(providerId)

  const url = byKey.get(keys.url)?.value?.trim() || ''
  const apiKey = byKey.get(keys.apiKey)?.value?.trim() || ''
  if (!url || !apiKey) return null

  const saved = (byKey.get(keys.protocol)?.value || 'auto').toLowerCase()
  const protocol: AiProtocol = saved === 'chat' || saved === 'responses' ? saved : detectProtocol(url)
  const model = byKey.get(keys.model)?.value?.trim() || DEFAULT_AI_MODEL

  return { url, apiKey, model, protocol, providerId }
}

// เรียก AI ด้วยข้อความทั่วไป (system + user) — คืน null ถ้าเรียกไม่สำเร็จ
export async function callAiText(
  config: AiConfig,
  opts: { system: string; user: string; maxTokens?: number; timeoutMs?: number },
): Promise<AiTextResult | null> {
  const maxTokens = opts.maxTokens ?? 800
  const timeoutMs = opts.timeoutMs ?? 60000

  try {
    // ---- โปรโตคอล OpenAI Responses (kie.ai ฯลฯ) ----
    if (config.protocol === 'responses') {
      const endpoint = responsesEndpoint(config.url)
      if (!endpoint) return null

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          Authorization: `Bearer ${config.apiKey}`,
        },
        // Responses API ไม่ใช้ max_tokens/temperature — ปิด thinking เพื่อคุมต้นทุน
        body: JSON.stringify({
          model: config.model,
          instructions: opts.system,
          input: opts.user,
          reasoning: { effort: 'none' },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      })

      const raw = await res.text()
      if (!res.ok) {
        console.error('AI (responses) HTTP', res.status, raw.slice(0, 200))
        return null
      }
      const parsed = parseResponsesBody(raw)
      if (parsed.error) {
        console.error('AI (responses) error:', parsed.error)
        return null
      }
      if (!parsed.text) return null

      return {
        content: parsed.text,
        tokens: parsed.tokens > 0 ? parsed.tokens : estimateTokens(opts.system + opts.user + parsed.text),
        providerCredits: parsed.providerCredits,
        protocol: 'responses',
        providerId: config.providerId,
      }
    }

    // ---- โปรโตคอล chat completions ----
    const endpoint = chatCompletionsEndpoint(config.url)
    if (!endpoint) return null

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user', content: opts.user },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!res.ok) {
      console.error('AI (chat) HTTP', res.status, (await res.text().catch(() => '')).slice(0, 200))
      return null
    }

    const json = await res.json()
    const content: string = (json?.choices?.[0]?.message?.content || '').trim()
    if (!content) return null

    const total = Number(json?.usage?.total_tokens)
    return {
      content,
      tokens: Number.isFinite(total) && total > 0 ? total : estimateTokens(opts.system + opts.user + content),
      providerCredits: null,
      protocol: 'chat',
      providerId: config.providerId,
    }
  } catch (err) {
    console.error('AI call failed:', err)
    return null
  }
}

// wrapper สำหรับงานค้นหาแบบ Zero-Hallucination (ใช้ต่อจากของเดิม)
export async function callAi(
  config: AiConfig,
  maxTokens: number,
  context: string,
  query: string,
): Promise<{ content: string; tokens: number; providerCredits: number | null } | null> {
  const result = await callAiText(config, {
    system: ZERO_HALLUCINATION_SYSTEM_PROMPT,
    user: `CONTEXT:\n${context}\n\nคำถาม: ${query}`,
    maxTokens,
    timeoutMs: 60000,
  })
  if (!result) return null
  return { content: result.content, tokens: result.tokens, providerCredits: result.providerCredits }
}

// ดึง JSON ก้อนแรกออกจากคำตอบ (รองรับกรณี AI ครอบด้วย ```json หรือมีคำอธิบาย)
export function extractJson<T>(text: string): T | null {
  if (!text) return null
  const cleaned = text.replace(/```json/gi, '```').replace(/```/g, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T
  } catch {
    return null
  }
}

// สั่งให้ AI ตอบเป็น JSON แล้ว parse ให้
export async function askAiJson<T>(
  config: AiConfig,
  system: string,
  user: string,
  maxTokens = 2000,
): Promise<{ data: T | null; result: AiTextResult | null }> {
  const result = await callAiText(config, { system, user, maxTokens, timeoutMs: 120000 })
  if (!result) return { data: null, result: null }
  return { data: extractJson<T>(result.content), result }
}
