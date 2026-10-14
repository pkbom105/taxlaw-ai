// ราคา/เพดานโทเคนของแต่ละโหมด + วิธีคิด Token credits — แหล่งความจริงเดียว
// ใช้ร่วมกันโดย /api/search (คิดเงินจริง) และหน้า /settings (แสดงตารางราคา)

export type AiMode = 'basic' | 'deep' | 'audit'

export interface AiTier {
  mode: AiMode
  label: string
  credits: number // ราคาโหมด (ใช้เมื่อไม่ได้ต่อ AI = เส้นทาง keyword สำรอง)
  chunkLimit: number // จำนวนมาตรา/ข้อหารือที่ดึงมาใช้เป็น context
  maxTokens: number // เพดานโทเคนของคำตอบจาก AI
}

/** 1 เครดิต : 1,000 tokens */
export const TOKENS_PER_CREDIT = 1000

export const AI_TIERS: Record<AiMode, AiTier> = {
  basic: { mode: 'basic', label: 'Basic Search', credits: 1, chunkLimit: 3, maxTokens: 300 },
  deep: { mode: 'deep', label: 'Deep Analysis', credits: 5, chunkLimit: 8, maxTokens: 800 },
  audit: { mode: 'audit', label: 'Document Audit', credits: 10, chunkLimit: 15, maxTokens: 1500 },
}

export const AI_TIER_LIST: AiTier[] = [AI_TIERS.basic, AI_TIERS.deep, AI_TIERS.audit]

export const DEFAULT_AI_MODEL = 'gpt-4o-mini'

/** 1 เครดิต : 1,000 tokens · ปัดขึ้น · ขั้นต่ำ 1 เครดิต */
export function creditsFromTokens(tokens: number): number {
  if (!Number.isFinite(tokens) || tokens <= 0) return 1
  return Math.max(1, Math.ceil(tokens / TOKENS_PER_CREDIT))
}

/** ต่อท้าย URL ที่ตั้งค่าไว้ให้เป็น endpoint ของ OpenAI-compatible chat completions */
export function chatCompletionsEndpoint(baseUrl: string): string {
  const base = (baseUrl || '').trim().replace(/\/+$/, '')
  if (!base) return ''
  if (/\/chat\/completions$/.test(base)) return base
  return `${base}/chat/completions`
}

/** ประมาณการโทเคนเมื่อ provider ไม่ส่ง usage กลับมา (~4 ตัวอักษร/โทเคน) */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil((text || '').length / 4))
}

// ---------- โปรโตคอลของปลายทาง (Chat Completions vs OpenAI Responses) ----------
export type AiProtocol = 'chat' | 'responses'

/** เดาโปรโตคอลจาก Base URL — kie.ai ใช้ /openai/v1 (Responses), เจ้าอื่นส่วนใหญ่ /v1 (Chat Completions) */
export function detectProtocol(baseUrl: string): AiProtocol {
  const u = (baseUrl || '').toLowerCase()
  if (u.includes('/openai/v1') || /\/responses\/?$/.test(u)) return 'responses'
  return 'chat'
}

/** ต่อท้าย URL ให้เป็น endpoint ของ OpenAI Responses API */
export function responsesEndpoint(baseUrl: string): string {
  const base = (baseUrl || '').trim().replace(/\/+$/, '')
  if (!base) return ''
  if (/\/responses$/.test(base)) return base
  return `${base}/responses`
}

export interface ResponsesResult {
  text: string
  tokens: number
  providerCredits: number | null
  error?: string
}

/** อ่านคำตอบของ Responses API — รองรับทั้ง SSE streaming และ JSON ก้อนเดียว
 *  คืน error ด้วยเมื่อเจอรูปแบบ error ของ kie.ai (HTTP 200 + code ใน body) */
export function parseResponsesBody(raw: string): ResponsesResult {
  const out: ResponsesResult = { text: '', tokens: 0, providerCredits: null }
  const body = (raw || '').trim()
  if (!body) return { ...out, error: 'empty response' }

  const collect = (obj: unknown) => {
    if (!obj || typeof obj !== 'object') return
    const evt = obj as Record<string, unknown>

    if (typeof evt.credits_consumed === 'number') out.providerCredits = evt.credits_consumed
    if (evt.type === 'response.output_text.delta' && typeof evt.delta === 'string') out.text += evt.delta
    if (evt.type === 'response.output_text.done' && typeof evt.text === 'string' && evt.text) out.text = evt.text

    // รูปแบบ error ของ kie.ai: {"code":401,"msg":"...","data":null}
    const code = (evt as { code?: unknown }).code
    if (typeof code === 'number' && code !== 200) {
      out.error = `code ${code}: ${String((evt as { msg?: unknown }).msg || 'unknown error')}`
    }
    if (evt.error && typeof evt.error === 'object') {
      const e = evt.error as { message?: string }
      out.error = e.message || 'provider error'
    }

    const resp = evt.response as Record<string, unknown> | undefined
    if (resp) {
      const usage = resp.usage as Record<string, unknown> | undefined
      if (usage) {
        const t = Number(usage.total_tokens)
        if (Number.isFinite(t) && t > 0) out.tokens = t
      }
      const items = Array.isArray(resp.output) ? (resp.output as Array<Record<string, unknown>>) : []
      for (const item of items) {
        const parts = Array.isArray(item?.content) ? (item.content as Array<Record<string, unknown>>) : []
        for (const part of parts) {
          if (part?.type === 'output_text' && typeof part.text === 'string' && part.text) out.text = part.text
        }
      }
    }
  }

  // ลองอ่านเป็น JSON ก้อนเดียวก่อน (กรณีไม่ stream)
  try {
    collect(JSON.parse(body))
  } catch {
    // เป็น SSE: อ่านทีละบรรทัด data: {...}
    for (const line of body.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        collect(JSON.parse(payload))
      } catch {
        // ข้ามบรรทัดที่ไม่ใช่ JSON
      }
    }
  }

  out.text = out.text.trim()
  return out
}

export const ZERO_HALLUCINATION_SYSTEM_PROMPT = [
  'คุณคือผู้ช่วยกฎหมายภาษีไทยที่ตอบจากเอกสารราชการที่ให้มาเท่านั้น (Zero-Hallucination)',
  '',
  'กฎเหล็ก:',
  '1. ใช้ข้อมูลจาก CONTEXT ที่ให้เท่านั้น ห้ามใช้ความรู้ภายนอก ห้ามคาดเดา ห้ามแต่งเลขมาตรา',
  '2. ทุกข้อความที่อ้างข้อกฎหมาย ต้องระบุเลขมาตรา/ข้อ + แหล่งที่มา + หน้า PDF',
  '3. ถ้า CONTEXT ไม่มีคำตอบ ให้ตอบว่า "ไม่พบข้อมูลในเอกสารที่มีอยู่" แล้วหยุด',
  '4. ตอบเป็นภาษาไทย กระชับ เป็นข้อ ๆ และปิดท้ายด้วยรายการอ้างอิง',
].join('\n')

// ---------- ผู้ให้บริการ AI (สลับด้วย radio button ในหน้า /settings) ----------
export interface AiProvider {
  id: string
  label: string
  baseUrl: string
  model: string
  protocol: 'auto' | AiProtocol
  hint: string
}

export const AI_PROVIDERS: AiProvider[] = [
  {
    id: 'kob',
    label: 'Kob AI',
    baseUrl: 'https://www.kob-ai.dev/v1',
    model: 'minimax-m3',
    protocol: 'auto',
    hint: 'kob-ai.dev · Chat Completions',
  },
  {
    id: 'kie',
    label: 'Kai AI',
    baseUrl: 'https://api.kie.ai/openai/v1',
    model: 'deepseek-v4-1-flash',
    protocol: 'auto',
    hint: 'kie.ai · Responses API',
  },
]

export const AI_PROVIDER_FIELDS = ['api_url', 'api_key', 'model', 'protocol'] as const
export type AiProviderField = (typeof AI_PROVIDER_FIELDS)[number]

export function getProvider(id: string): AiProvider | undefined {
  return AI_PROVIDERS.find(p => p.id === id)
}

export function isProviderId(id: string): boolean {
  return AI_PROVIDERS.some(p => p.id === id)
}

/** ชื่อคีย์ใน DB ของแต่ละเจ้า เช่น kob_api_url */
export function providerSettingKey(providerId: string, field: AiProviderField): string {
  return `${providerId}_${field}`
}

/** ชุดชื่อคีย์ทั้ง 4 ของเจ้านั้น */
export function providerSettingKeys(providerId: string) {
  return {
    url: providerSettingKey(providerId, 'api_url'),
    apiKey: providerSettingKey(providerId, 'api_key'),
    model: providerSettingKey(providerId, 'model'),
    protocol: providerSettingKey(providerId, 'protocol'),
  }
}

/** คีย์ที่อนุญาตให้บันทึกผ่าน API: ai_provider หรือ {provider}_{field} */
export function isAllowedSettingKey(key: string): boolean {
  if (key === 'ai_provider') return true
  for (const p of AI_PROVIDERS) {
    if (key.startsWith(`${p.id}_`)) {
      const field = key.slice(p.id.length + 1)
      return (AI_PROVIDER_FIELDS as readonly string[]).includes(field)
    }
  }
  return false
}

// ---------- เมนูกลุ่มโมเดล (ราคาอ้างอิงจาก kie.ai) ----------
// แหล่งความจริงเดียวของ "รุ่นที่เลือกได้ + ราคา" ที่หน้า /settings แสดงเป็นเมนูกลุ่ม
// ราคาเป็น USD ต่อ 1M tokens (input/output) และเครดิตของ kie.ai — ต้องอัปเดตเมื่อ kie.ai เปลี่ยนราคา
export const AI_PRICING_SOURCE = 'https://kie.ai/pricing'
export const AI_PRICING_UPDATED = '2026-10-14'
/** รุ่นฐานที่ใช้เทียบราคา (ถูกสุดในเมนู = DeepSeek V4.1 Flash) */
export const AI_PRICE_BASELINE_ID = 'deepseek-v4-1-flash'

export interface AiModelOption {
  /** model id ที่ส่งให้ API จริง (ต้องตรงกับฝั่งผู้ให้บริการ) */
  id: string
  label: string
  /** ราคาที่ kie.ai คิด (USD ต่อ 1M tokens) */
  inputUsd: number
  outputUsd: number
  /** เครดิต kie.ai ต่อ 1M tokens */
  inputCredits: number
  outputCredits: number
  note?: string
}

export interface AiModelGroup {
  id: string
  label: string
  /** ผู้ให้บริการที่เมนูกลุ่มนี้แสดง (kie = Kai AI) */
  providerId: string
  note?: string
  models: AiModelOption[]
}

export const AI_MODEL_GROUPS: AiModelGroup[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    providerId: 'kie',
    note: 'ถูกสุดในเมนู — ค่าเริ่มต้นของ Kai AI',
    models: [
      {
        id: 'deepseek-v4-1-flash',
        label: 'DeepSeek V4.1 Flash',
        inputUsd: 0.12,
        outputUsd: 0.475,
        inputCredits: 24,
        outputCredits: 95,
        note: '1M context · multimodal · Responses API',
      },
    ],
  },
  {
    id: 'gemini-flash',
    label: 'Gemini Flash',
    providerId: 'kie',
    note: 'รุ่น Flash ล่าสุดบน kie.ai',
    models: [
      {
        id: 'gemini-3-8-flash',
        label: 'Gemini 3.8 Flash',
        inputUsd: 0.225,
        outputUsd: 1.125,
        inputCredits: 45,
        outputCredits: 225,
        note: 'official $0.75 / $3.75 per 1M',
      },
    ],
  },
]

/** กลุ่มโมเดลของผู้ให้บริการนั้น (คืน [] = ไม่มีเมนูกลุ่มให้แสดง) */
export function modelGroupsForProvider(providerId: string): AiModelGroup[] {
  return AI_MODEL_GROUPS.filter(group => group.providerId === providerId)
}

/** หารุ่นจาก model id */
export function findModelOption(modelId: string): AiModelOption | undefined {
  for (const group of AI_MODEL_GROUPS) {
    const found = group.models.find(m => m.id === modelId)
    if (found) return found
  }
  return undefined
}

/** ตัวคูณราคาเทียบรุ่นฐาน — ใช้โชว์ "เทียบ DeepSeek ×1.9 in · ×2.4 out" (null = เทียบไม่ได้/เป็นรุ่นฐานเอง) */
export function priceRatioVs(modelId: string, baseId: string): { input: number; output: number } | null {
  if (modelId === baseId) return null
  const model = findModelOption(modelId)
  const base = findModelOption(baseId)
  if (!model || !base || !base.inputUsd || !base.outputUsd) return null
  return { input: model.inputUsd / base.inputUsd, output: model.outputUsd / base.outputUsd }
}
