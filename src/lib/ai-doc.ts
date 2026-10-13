// อ่านกฎหมายฉบับยาวด้วย AI แบบ "ทีละช่วง" (8-10K ตัวอักษร) แล้วรวมผลเป็นชุดเดียว
// ใช้ร่วมกับ /api/upload — กันปัญหา JSON ถูกตัดกลางเมื่อสั่งให้ AI สกัดทั้งฉบับในครั้งเดียว
import { askAiJson, type AiConfig } from '@/lib/ai-call'

export interface AiSection {
  sectionNumber?: string
  sectionLabel?: string
  content?: string
  pageStart?: number
}

export interface AiLawResult {
  category?: string
  type?: string
  shortTitle?: string
  edition?: string | null
  summary?: string
  sections: AiSection[]
}

export interface AiLawOptions {
  title: string
  allowedCats: { value: string; label: string }[]
  allowedTypes: { value: string; label: string }[]
  windowSize?: number // ขนาดข้อความต่อรอบ (ค่าเริ่มต้น 9,000 ตัวอักษร — อยู่ในช่วง 8-10K)
  overlap?: number // ความยาวที่เหลื่อมกันระหว่างช่วง (กันมาตรากูกตัดกลาง)
  maxWindows?: number // เพดานจำนวนรอบเรียก AI ต่อ 1 ไฟล์
}

export interface AiLawOutcome {
  data: AiLawResult | null
  tokens: number
  providerCredits: number | null
  windows: number // จำนวนช่วงที่แบ่งได้
  okWindows: number // ช่วงที่ AI ตอบเป็น JSON ได้
  failedWindows: number // ช่วงที่ AI ตอบไม่เป็น JSON / เรียกไม่สำเร็จ
}

// เพดานต่อ 1 ช่วง — คุมขนาด JSON ไม่ให้ยาวจนถูกตัดกลางทาง
const MAX_SECTIONS_PER_WINDOW = 15
const MAX_SECTION_CHARS = 1500

const DEFAULT_WINDOW = 9000
const DEFAULT_OVERLAP = 400
const DEFAULT_MAX_WINDOWS = 8

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max)
}

// แบ่งข้อความยาวเป็นช่วง ๆ แบบเหลื่อมกันเล็กน้อย
export function splitIntoWindows(text: string, windowSize: number, overlap: number, maxWindows: number): string[] {
  const out: string[] = []
  const step = Math.max(1, windowSize - overlap)
  for (let start = 0; start < text.length && out.length < maxWindows; start += step) {
    out.push(text.slice(start, start + windowSize))
  }
  return out
}

function buildSystem(opts: AiLawOptions, index: number, total: number): string {
  return [
    'คุณคือผู้ช่วยจัดหมวดหมู่กฎหมายไทย ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอกก้อน JSON',
    '',
    'หมวดหมู่ที่อนุญาต (เลือก value เท่านั้น): ' + opts.allowedCats.map(c => `${c.value} (${c.label})`).join(' · '),
    'ประเภทเอกสารที่อนุญาต (เลือก value เท่านั้น): ' + opts.allowedTypes.map(t => `${t.value} (${t.label})`).join(' · '),
    '',
    'รูปแบบผลลัพธ์:',
    '{"category":"...","type":"...","shortTitle":"ชื่อสั้นไม่เกิน 30 ตัวอักษร","edition":"ฉบับที่ n หรือ null","summary":"สรุป 2-3 ประโยค","sections":[{"sectionNumber":"40","sectionLabel":"มาตรา 40","content":"ข้อความของมาตรานั้น","pageStart":1}]}',
    '',
    'กติกา:',
    `1. เอกสารนี้ถูกแบ่งอ่านเป็น ${total} ช่วง และนี่คือ "ช่วงที่ ${index}" — สกัดเฉพาะมาตราที่อยู่ในข้อความช่วงนี้เท่านั้น ห้ามเดามาตราที่ไม่เห็น`,
    `2. sections สูงสุด ${MAX_SECTIONS_PER_WINDOW} รายการ และ content ต่อรายการไม่เกิน ${MAX_SECTION_CHARS} ตัวอักษร — ใช้ข้อความจริงจากเอกสาร ห้ามแต่งขึ้นใหม่`,
    '3. ถ้าข้อความช่วงนี้ไม่มีมาตรา ให้ sections เป็น [] แต่ยังต้องตอบ JSON ให้ครบรูปแบบ',
    '4. ห้ามตัดข้อความมาตรากลางทาง: ถ้าข้อความไม่จบภายในช่วง ให้ส่งเท่าที่ข้อความครบ แล้วปล่อยให้ช่วงถัดไปเก็บต่อ',
    index === 1
      ? '5. ช่วงนี้เป็นช่วงแรก ให้ประเมิน category/type/shortTitle/edition/summary จากเนื้อหาด้วย'
      : '5. ช่วงนี้ไม่ใช่ช่วงแรก: category/type/shortTitle/edition/summary ให้ใส่ค่าที่สอดคล้องกับชื่อเอกสาร ห้ามใส่ค่าเกินจริง',
    '6. ตอบเป็นภาษาไทย',
  ].join('\n')
}

// คีย์กันซ้ำ: ใช้เลขมาตราเป็นหลัก (รองรับ 40, 40/1) แล้ว fallback เป็นชื่อมาตรา
function sectionKey(s: AiSection): string {
  const num = String(s.sectionNumber || '').match(/\d+(?:\/\d+)?/)?.[0]
  if (num) return num
  const label = String(s.sectionLabel || '').match(/\d+(?:\/\d+)?/)?.[0]
  if (label) return label
  return String(s.sectionLabel || s.content || '').replace(/\s+/g, '').slice(0, 40)
}

function sectionOrder(s: AiSection): number {
  const num = String(s.sectionNumber || s.sectionLabel || '').match(/\d+/)?.[0]
  return num ? Number(num) : Number.MAX_SAFE_INTEGER
}

// อ่านเอกสารทั้งฉบับทีละช่วง แล้วรวมเป็นผลลัพธ์เดียว
export async function extractLawWithAi(
  config: AiConfig,
  text: string,
  opts: AiLawOptions,
): Promise<AiLawOutcome> {
  const windowSize = clamp(opts.windowSize ?? DEFAULT_WINDOW, 6000, 12000)
  const overlap = clamp(opts.overlap ?? DEFAULT_OVERLAP, 0, Math.floor(windowSize / 4))
  const maxWindows = clamp(opts.maxWindows ?? DEFAULT_MAX_WINDOWS, 1, 60)

  const windows = splitIntoWindows(text, windowSize, overlap, maxWindows)
  const merged: AiLawResult = { sections: [] }
  const byKey = new Map<string, AiSection>()
  let tokens = 0
  let providerCredits: number | null = null
  let okWindows = 0
  let failedWindows = 0

  for (const [i, chunk] of windows.entries()) {
    const system = buildSystem(opts, i + 1, windows.length)
    const user = `ชื่อเอกสาร: ${opts.title}\nช่วงที่ ${i + 1}/${windows.length} ของเอกสาร\n\nเนื้อหาเอกสาร:\n${chunk}`

    const { data, result } = await askAiJson<AiLawResult>(config, system, user, 2500)

    if (result) {
      tokens += result.tokens
      if (typeof result.providerCredits === 'number') {
        providerCredits = (providerCredits ?? 0) + result.providerCredits
      }
    }
    if (!data) {
      failedWindows++
      continue
    }
    okWindows++

    // ข้อมูลระดับเอกสาร: ใช้ค่าจากช่วงแรกที่มีค่า
    if (!merged.category && data.category) merged.category = data.category
    if (!merged.type && data.type) merged.type = data.type
    if (!merged.shortTitle && data.shortTitle) merged.shortTitle = data.shortTitle
    if (!merged.edition && data.edition) merged.edition = data.edition
    if (!merged.summary && data.summary) merged.summary = data.summary

    // รวมมาตรา: ตัดซ้ำตามเลขมาตรา เก็บข้อความที่ยาว/ครบที่สุด
    for (const s of data.sections || []) {
      const content = String(s.content || '').trim()
      if (content.length < 20) continue
      const key = sectionKey(s)
      const prev = byKey.get(key)
      if (!prev) {
        const clean: AiSection = { ...s, content: content.slice(0, 4000) }
        byKey.set(key, clean)
        merged.sections.push(clean)
      } else if (content.length > String(prev.content || '').length) {
        prev.content = content.slice(0, 4000)
        if (s.sectionLabel) prev.sectionLabel = s.sectionLabel
        if (s.pageStart && !prev.pageStart) prev.pageStart = s.pageStart
      }
    }

    // หน่วงเล็กน้อยก่อนช่วงถัดไป
    if (i < windows.length - 1) await new Promise(r => setTimeout(r, 250))
  }

  merged.sections.sort((a, b) => sectionOrder(a) - sectionOrder(b))

  return {
    data: okWindows > 0 ? merged : null,
    tokens,
    providerCredits,
    windows: windows.length,
    okWindows,
    failedWindows,
  }
}
