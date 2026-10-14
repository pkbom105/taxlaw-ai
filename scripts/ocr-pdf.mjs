// OCR ไฟล์ PDF ที่ชั้นข้อความใช้ฟอนต์รหัสเก่า (แปลงเป็น Unicode ไม่ได้) ด้วย tesseract.js
// ใช้: bun scripts/ocr-pdf.mjs <ไฟล์.pdf> [หน้าเริ่ม] [หน้าสุดท้าย] [ไฟล์ออก .txt]
// ตัวอย่าง: bun scripts/ocr-pdf.mjs "public/book-pdf/พระราชบัญญัติ งบประมาณ 2570-1.pdf" 1 20 /tmp/ocr-2570.txt
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { createWorker } from 'tesseract.js'

const pdf = process.argv[2]
const from = Number(process.argv[3] || 1)
const to = Number(process.argv[4] || from)
const outFile = process.argv[5] || `/tmp/ocr-${path.basename(pdf, '.pdf')}-${from}-${to}.txt`
const DPI = Number(process.env.DPI || 300)
const LANG = process.env.LANG_OCR || 'tha'

if (!pdf || !fs.existsSync(pdf)) {
  console.log('ไม่พบไฟล์:', pdf)
  process.exit(1)
}

function thaiRatio(t) {
  const th = (t.match(/[\u0E00-\u0E7F]/g) || []).length
  return Math.round((th / Math.max(t.length, 1)) * 100)
}

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-pdf-'))
  console.log(`ไฟล์: ${pdf}`)
  console.log(`หน้า ${from}-${to} · DPI ${DPI} · ภาษา ${LANG} · โฟลเดอร์ชั่วคราว ${tmp}`)

  // 1) แปลงหน้า PDF เป็นรูป PNG (ต้องมี pdftoppm จาก poppler)
  const t0 = Date.now()
  execFileSync('pdftoppm', ['-f', String(from), '-l', String(to), '-r', String(DPI), '-png', pdf, path.join(tmp, 'p')], { stdio: 'inherit' })
  const pngs = fs.readdirSync(tmp).filter(f => f.endsWith('.png')).sort()
  console.log(`แปลงเป็นรูปแล้ว ${pngs.length} หน้า (${((Date.now() - t0) / 1000).toFixed(1)} วิ)`)

  // 2) OCR ทีละหน้า (แคชข้อมูลภาษาไว้ใน /tmp ไม่ให้กองที่ root โปรเจกต์)
  const cacheDir = process.env.OCR_CACHE || path.join(os.tmpdir(), 'tesseract-cache')
  fs.mkdirSync(cacheDir, { recursive: true })
  const worker = await createWorker(LANG, 1, { cachePath: cacheDir, logger: () => {} })
  const parts = []
  let chars = 0

  for (const [i, png] of pngs.entries()) {
    const t1 = Date.now()
    const { data } = await worker.recognize(path.join(tmp, png))
    const text = (data.text || '').replace(/\n{3,}/g, '\n\n').trim()
    const r = thaiRatio(text)
    chars += text.length
    parts.push(`--- หน้า ${from + i} ---\n${text}`)
    console.log(`  หน้า ${from + i}: ${text.length} ตัวอักษร · ไทย ${r}% · conf ${Math.round(data.confidence || 0)} · ${((Date.now() - t1) / 1000).toFixed(1)} วิ`)
  }

  await worker.terminate()

  const all = parts.join('\n\n')
  fs.writeFileSync(outFile, all)
  fs.rmSync(tmp, { recursive: true, force: true })

  console.log(`\nรวม ${chars} ตัวอักษร · อักษรไทย ${thaiRatio(all)}%`)
  console.log(`บันทึก: ${outFile}`)
  console.log(`เวลารวม ${((Date.now() - t0) / 1000).toFixed(1)} วิ · เฉลี่ย ${(((Date.now() - t0) / 1000) / Math.max(pngs.length, 1)).toFixed(1)} วิ/หน้า`)
}

main().catch(err => { console.error('ocr error:', err); process.exitCode = 1 })
