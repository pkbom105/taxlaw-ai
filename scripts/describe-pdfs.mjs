// อ่านไฟล์ PDF ในโฟลเดอร์ → ให้ AI เขียนคำอธิบาย (summary) → เก็บเข้าคลังให้แสดงบน /documents
// เร็ว: 1 AI call ต่อไฟล์ (อ่าน 6,000 ตัวอักษรแรก ไม่สกัดมาตรา)
// ใช้: bun scripts/describe-pdfs.mjs [โฟลเดอร์]
import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { askAiJson, getAiConfig } from '../src/lib/ai-call.ts'
import { extractTextFromBuffer } from '../src/lib/doc-text.ts'

const db = new PrismaClient()
const DIR = process.argv[2] || process.env.DIR || 'public/ิbook-pdf'
const HEAD_CHARS = Number(process.env.HEAD_CHARS || 6000)
const TH_MIN = Number(process.env.TH_MIN || 50)

function thaiRatio(text) {
  const th = (text.match(/[\u0E00-\u0E7F]/g) || []).length
  return Math.round((th / Math.max(text.length, 1)) * 100)
}

// ดึงเฉพาะช่วงที่มีอักษรไทย (ไว้ใช้กับไฟล์ที่ชั้นข้อความเพี้ยน)
function thaiFragments(text, maxChars) {
  const out = []
  const re = /[\u0E00-\u0E7F][\u0E00-\u0E7F\s.,()/-]{8,}/g
  let m
  while ((m = re.exec(text)) !== null) {
    out.push(m[0].trim())
    if (out.join(' | ').length >= maxChars) break
  }
  return out.join(' | ')
}

function titleFromFile(name) {
  return path.basename(name, path.extname(name)).replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)
}

function codeFromTitle(title) {
  const ascii = title.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return ascii.length >= 3 ? ascii.slice(0, 24) : 'LAW'
}

async function uniqueCode(title) {
  const base = codeFromTitle(title)
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}-${Date.now().toString(36).toUpperCase().slice(-4)}${i > 0 ? i : ''}`
    if (!(await db.lawDocument.findUnique({ where: { code: candidate } }))) return candidate
  }
  return `${base}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

async function main() {
  const config = await getAiConfig()
  if (!config) {
    console.log('ยังไม่ได้ตั้งค่าผู้ให้บริการ AI ในหน้า /settings')
    process.exit(1)
  }

  const cats = await db.lawCategory.findMany({ orderBy: { sortOrder: 'asc' } })
  const types = await db.optionItem.findMany({ where: { group: 'law_type' }, orderBy: { sortOrder: 'asc' } })
  const allowedCats = cats.length ? cats.map(c => ({ value: c.value, label: c.label })) : [{ value: 'revenue_code', label: 'ประมวลรัษฎากร' }]
  const allowedTypes = types.length ? types.map(t => ({ value: t.value, label: t.label })) : [{ value: 'act', label: 'พระราชบัญญัติ' }]

  const files = fs.readdirSync(DIR).filter(f => /\.pdf$/i.test(f)).sort()
  const user = await db.user.findUnique({ where: { email: 'demo@taxlaw.ai' } })
  console.log(`โฟลเดอร์: ${DIR}`)
  console.log(`พบ ${files.length} ไฟล์ · ผู้ให้บริการ ${config.providerId}/${config.model}\n`)

  for (const file of files) {
    const ext = await extractTextFromBuffer(fs.readFileSync(path.join(DIR, file)), file)
    const ratio = thaiRatio(ext.text)
    const readable = ratio >= TH_MIN
    const content = readable ? ext.text.slice(0, HEAD_CHARS) : thaiFragments(ext.text, 2500)

    const system = [
      'คุณคือผู้ช่วยทำคำอธิบายเอกสารกฎหมายไทย ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอกก้อน JSON',
      '',
      'หมวดหมู่ที่อนุญาต (เลือก value เท่านั้น): ' + allowedCats.map(c => `${c.value} (${c.label})`).join(' · '),
      'ประเภทเอกสารที่อนุญาต (เลือก value เท่านั้น): ' + allowedTypes.map(t => `${t.value} (${t.label})`).join(' · '),
      '',
      'รูปแบบผลลัพธ์:',
      '{"title":"ชื่อเต็มของเอกสาร","shortTitle":"ชื่อสั้นไม่เกิน 30 ตัวอักษร","summary":"คำอธิบาย 2-3 ประโยค","category":"...","type":"...","textQuality":"ok หรือ poor","note":"หมายเหตุสั้น ๆ"}',
      '',
      'กติกา:',
      '1. summary อธิบายว่าเอกสารนี้คืออะไร มีเนื้อหาอะไร ใช้ประโยชน์อย่างไร',
      '2. ใช้ข้อมูลจากชื่อไฟล์ + เนื้อหาที่ให้เท่านั้น ห้ามแต่งเนื้อหาที่มองไม่เห็น',
      '3. ถ้าข้อความส่วนใหญ่แปลงเป็นไทยไม่ได้ ให้ textQuality="poor" และใส่ note ว่าต้องใช้ OCR หรือต้นฉบับ Unicode',
      '4. ตอบเป็นภาษาไทย',
    ].join('\n')

    const user_prompt = [
      `ชื่อไฟล์: ${file}`,
      `คุณภาพชั้นข้อความ: อักษรไทย ${ratio}% ของข้อความที่สกัดได้${readable ? '' : ' (ส่วนใหญ่แปลงไม่ได้ เพราะฟอนต์รหัสเก่า)'}`,
      '',
      readable ? 'เนื้อหาตอนต้นของเอกสาร:' : 'ข้อความไทยเท่าที่อ่านได้ (ไม่ครบ):',
      content,
    ].join('\n')

    const { data, result } = await askAiJson(config, system, user_prompt, 1200)

    const fallbackTitle = titleFromFile(file)
    const title = data?.title?.trim() || fallbackTitle
    let summary = data?.summary?.trim() || ''
    if (!readable || data?.textQuality === 'poor') {
      const note = data?.note?.trim() || 'ชั้นข้อความในไฟล์ใช้ฟอนต์รหัสเก่า แปลงเป็น Unicode ได้ไม่ครบ'
      summary = summary ? `${summary} — หมายเหตุ: ${note}` : `ยังสกัดข้อความอัตโนมัติไม่ได้ — ${note}`
    }

    const validCat = data?.category && allowedCats.some(c => c.value === data.category) ? data.category : 'revenue_code'
    const validType = data?.type && allowedTypes.some(t => t.value === data.type) ? data.type : 'act'
    const existing = await db.lawDocument.findFirst({ where: { pdfFile: file } })

    if (existing) {
      await db.lawDocument.update({
        where: { id: existing.id },
        data: {
          summary: summary || existing.summary,
          shortTitle: data?.shortTitle?.trim() || existing.shortTitle,
          category: validCat,
          type: validType,
          pageCount: ext.pages || existing.pageCount,
        },
      })
    } else {
      await db.lawDocument.create({
        data: {
          code: await uniqueCode(title),
          title,
          shortTitle: data?.shortTitle?.trim() || (title.length > 30 ? title.slice(0, 30) : title),
          summary: summary || null,
          type: validType,
          category: validCat,
          source: 'rd.go.th',
          pdfFile: file,
          pageCount: ext.pages,
          status: 'in_force',
          effectiveDate: new Date(),
          publishedAt: new Date(),
        },
      })
    }

    if (user) {
      await db.usageLog.create({
        data: {
          userId: user.id,
          action: 'describe_law_doc',
          creditsCost: 0,
          metadata: JSON.stringify({
            fileName: file,
            provider: config.providerId,
            protocol: config.protocol,
            tokens: result?.tokens ?? 0,
            credits: 0,
            providerCredits: result?.providerCredits ?? null,
            textQuality: readable ? 'ok' : 'poor',
            thaiRatio: ratio,
            pages: ext.pages,
            mode: existing ? 'update' : 'create',
          }),
        },
      })
    }

    console.log(`[${existing ? 'อัปเดต' : 'สร้างใหม่'}] ${file}`)
    console.log(`   หมวด ${validCat} · ประเภท ${validType} · ${ext.pages} หน้า · อักษรไทย ${ratio}% · ${result?.tokens ?? 0} tokens · 0 cr`)
    console.log(`   คำอธิบาย: ${(summary || '-').slice(0, 200)}`)
  }

  const docs = await db.lawDocument.count()
  console.log(`\nคลังตอนนี้: ${docs} เอกสาร · ${await db.lawChunk.count()} มาตรา`)
}

main()
  .catch(err => { console.error('describe error:', err); process.exitCode = 1 })
  .finally(async () => { await db.$disconnect() })
