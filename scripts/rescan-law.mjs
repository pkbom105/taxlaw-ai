// สแกนซ้ำเอกสารในคลังด้วย AI แบบอ่านทีละช่วง (8-10K ตัวอักษร) แล้วเติมข้อมูลให้ครบ
// ใช้: bun scripts/rescan-law.mjs [รหัสเอกสาร ...]     (ไม่ระบุ = ทุกเอกสารที่มีไฟล์ PDF)
// - เติม summary/shortTitle/edition/category/type (ถ้ายังว่าง)
// - รวมมาตราเพิ่ม "ไม่ลบของเดิม": มาตราเลขซ้ำจะอัปเดตเฉพาะเมื่อข้อความใหม่ยาวกว่า
import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { getAiConfig } from '../src/lib/ai-call.ts'
import { extractLawWithAi } from '../src/lib/ai-doc.ts'
import { extractTextFromBuffer } from '../src/lib/doc-text.ts'

const db = new PrismaClient()
const DIR = process.env.DIR || 'public/book-pdf'
const WINDOW = Number(process.env.WINDOW || 9000)
const OVERLAP = Number(process.env.OVERLAP || 400)
const MAX_WINDOWS = Number(process.env.MAX_WINDOWS || 8)
// TEXT_FILE: ใช้ข้อความจากไฟล์ (เช่น ผล OCR) แทนการสกัดจาก PDF
const TEXT_FILE = process.env.TEXT_FILE || ''

async function main() {
  const codes = process.argv.slice(2)
  const config = await getAiConfig()
  if (!config) {
    console.log('ยังไม่ได้ตั้งค่าผู้ให้บริการ AI ในหน้า /settings')
    process.exit(1)
  }

  const cats = await db.lawCategory.findMany({ orderBy: { sortOrder: 'asc' } })
  const types = await db.optionItem.findMany({ where: { group: 'law_type' }, orderBy: { sortOrder: 'asc' } })
  const allowedCats = cats.length ? cats.map(c => ({ value: c.value, label: c.label })) : [{ value: 'revenue_code', label: 'ประมวลรัษฎากร' }]
  const allowedTypes = types.length ? types.map(t => ({ value: t.value, label: t.label })) : [{ value: 'act', label: 'พระราชบัญญัติ' }]

  const docs = codes.length
    ? await db.lawDocument.findMany({ where: { code: { in: codes } } })
    : await db.lawDocument.findMany({ where: { pdfFile: { not: null } }, orderBy: { createdAt: 'asc' } })

  console.log(`ผู้ให้บริการ: ${config.providerId} · โมเดล ${config.model} · โปรโตคอล ${config.protocol}`)
  console.log(`อ่านทีละ ${WINDOW} ตัวอักษร (เหลื่อม ${OVERLAP}) สูงสุด ${MAX_WINDOWS} ช่วง · เอกสาร ${docs.length} รายการ\n`)

  for (const doc of docs) {
    const tag = `[${doc.code}] ${doc.title.slice(0, 48)}`
    const file = doc.pdfFile ? path.join(DIR, doc.pdfFile) : null
    if (!file || !fs.existsSync(file)) {
      console.log(`${tag} — ข้าม (ไม่พบไฟล์ ${doc.pdfFile ?? '-'})`)
      continue
    }

    const ext = TEXT_FILE && fs.existsSync(TEXT_FILE)
      ? { text: fs.readFileSync(TEXT_FILE, 'utf8'), pages: doc.pageCount || 0, kind: 'text', note: 'ข้อความจาก OCR' }
      : await extractTextFromBuffer(fs.readFileSync(file), doc.pdfFile)
    const th = (ext.text.match(/[\u0E00-\u0E7F]/g) || []).length
    const thPct = Math.round((th / Math.max(ext.text.length, 1)) * 100)
    console.log(`${tag}\n   ไฟล์ ${doc.pdfFile} · ${ext.pages} หน้า · ข้อความ ${ext.text.length} ตัวอักษร · อักษรไทย ${thPct}%`)

    if (ext.text.length < 200) {
      console.log('   ข้าม — ข้อความสั้นเกินไป/อ่านไม่ได้')
      continue
    }
    if (thPct < 50) {
      console.log(`   เตือน: ข้อความส่วนใหญ่ไม่ใช่ภาษาไทย (${thPct}%) — ผลจาก AI อาจไม่น่าเชื่อถือ`)
    }

    const outcome = await extractLawWithAi(config, ext.text, {
      title: doc.title,
      allowedCats,
      allowedTypes,
      windowSize: WINDOW,
      overlap: OVERLAP,
      maxWindows: MAX_WINDOWS,
    })

    if (!outcome.data) {
      console.log(`   ล้มเหลว — AI ตอบไม่เป็น JSON (${outcome.failedWindows}/${outcome.windows} ช่วง) · ${outcome.tokens} tokens`)
      continue
    }

    const ai = outcome.data
    const validCat = ai.category && allowedCats.some(c => c.value === ai.category) ? ai.category : doc.category
    const validType = ai.type && allowedTypes.some(t => t.value === ai.type) ? ai.type : doc.type

    // เติมข้อมูลระดับเอกสาร (ไม่ทับค่าที่มีอยู่แล้ว)
    await db.lawDocument.update({
      where: { id: doc.id },
      data: {
        summary: doc.summary || ai.summary?.trim() || null,
        shortTitle: doc.shortTitle || ai.shortTitle?.trim() || doc.title.slice(0, 30),
        edition: doc.edition || ai.edition?.trim() || null,
        category: validCat,
        type: validType,
      },
    })

    // รวมมาตราแบบไม่ลบของเดิม
    const existing = await db.lawChunk.findMany({ where: { documentId: doc.id } })
    const bySection = new Map(existing.map(c => [String(c.sectionNumber), c]))
    let added = 0
    let updated = 0

    for (const [i, s] of ai.sections.entries()) {
      const num = String(s.sectionNumber || i + 1).slice(0, 40)
      const content = String(s.content || '').slice(0, 4000)
      const label = String(s.sectionLabel || `มาตรา ${num}`).slice(0, 120)
      const prev = bySection.get(num)
      if (!prev) {
        await db.lawChunk.create({
          data: {
            documentId: doc.id,
            sectionNumber: num,
            sectionLabel: label,
            content,
            pageStart: Number(s.pageStart) > 0 ? Number(s.pageStart) : 1,
            keywords: `${doc.title} ${label}`.slice(0, 200),
          },
        })
        added++
      } else if (content.length > prev.content.length) {
        await db.lawChunk.update({ where: { id: prev.id }, data: { content, sectionLabel: label } })
        updated++
      }
    }

    const user = await db.user.findUnique({ where: { email: 'demo@taxlaw.ai' } })
    await db.usageLog.create({
      data: {
        userId: user?.id ?? null,
        action: 'rescan_law_doc',
        creditsCost: 0,
        metadata: JSON.stringify({
          documentId: doc.id,
          code: doc.code,
          provider: config.providerId,
          protocol: config.protocol,
          tokens: outcome.tokens,
          credits: 0,
          providerCredits: outcome.providerCredits,
          windows: outcome.windows,
          okWindows: outcome.okWindows,
          sections: ai.sections.length,
          added,
          updated,
        }),
      },
    })

    console.log(`   OK · ${ai.sections.length} มาตรา (เพิ่ม ${added} · อัปเดต ${updated}) · อ่าน ${outcome.okWindows}/${outcome.windows} ช่วง · ${outcome.tokens} tokens · ${(outcome.providerCredits ?? 0).toFixed(2)} cr`)
    console.log(`   สรุป: ${(ai.summary || '-').slice(0, 140)}`)
  }

  const docsCount = await db.lawDocument.count()
  const chunks = await db.lawChunk.count()
  const wallet = await db.wallet.findFirst()
  console.log(`\nคลังตอนนี้: ${docsCount} เอกสาร · ${chunks} มาตรา · เครดิตคงเหลือ ${wallet?.balance ?? '-'}`)
}

main()
  .catch(err => { console.error('rescan error:', err); process.exitCode = 1 })
  .finally(async () => { await db.$disconnect() })
