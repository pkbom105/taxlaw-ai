// อัปโหลด PDF ทั้งโฟลเดอร์เข้าคลังกฎหมาย โดยให้ AI แยกหมวดหมู่ + สกัดมาตรา
// ใช้: bun scripts/ai-upload-batch.mjs [โฟลเดอร์]        (ค่าเริ่มต้น public/ิbook-pdf)
// ตัวเลือก: LIMIT=5 จำกัดจำนวนไฟล์ · DELAY_MS=1500 หน่วงระหว่างไฟล์ · DRY_RUN=1 ดูรายการก่อน
import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const API = process.env.API_BASE || 'http://localhost:3000'
const DIR = process.argv[2] || process.env.DIR || 'public/ิbook-pdf'
const LIMIT = Number(process.env.LIMIT || 0)
const DELAY_MS = Number(process.env.DELAY_MS || 1500)
const DRY_RUN = process.env.DRY_RUN === '1'
const MAX_AI_SIZE = 4 * 1024 * 1024 // เพดานเดียวกับ UI (ส่งให้ AI วิเคราะห์)

function titleFromFile(name) {
  return path.basename(name, path.extname(name)).replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  if (!fs.existsSync(DIR)) {
    console.log(`ไม่พบโฟลเดอร์: ${DIR}`)
    process.exit(1)
  }

  let files = fs.readdirSync(DIR).filter(f => /\.pdf$/i.test(f))
  files.sort()
  if (LIMIT > 0) files = files.slice(0, LIMIT)

  console.log(`โฟลเดอร์: ${DIR}`)
  console.log(`พบ PDF ${files.length} ไฟล์${LIMIT ? ` (จำกัด LIMIT=${LIMIT})` : ''}${DRY_RUN ? ' · โหมด DRY_RUN (ไม่ส่งจริง)' : ''}\n`)

  if (!files.length) {
    console.log('ยังไม่มีไฟล์ PDF ในโฟลเดอร์นี้')
    return
  }

  const existing = await db.lawDocument.findMany({ select: { pdfFile: true, title: true } })
  const doneFiles = new Set(existing.map(d => d.pdfFile).filter(Boolean))

  const results = []
  let totalTokens = 0, totalCredits = 0, totalProviderCredits = 0, okCount = 0, skipCount = 0, failCount = 0

  for (const [i, file] of files.entries()) {
    const full = path.join(DIR, file)
    const size = fs.statSync(full).size
    const title = titleFromFile(file)
    const tag = `[${i + 1}/${files.length}] ${file}`

    if (doneFiles.has(file)) {
      console.log(`${tag} — ข้าม (มีในคลังแล้ว)`)
      results.push({ file, title, status: 'skipped-dup', category: '-', sections: 0, tokens: 0, credits: 0, providerCredits: 0, note: 'มีเอกสารชื่อไฟล์นี้แล้ว' })
      skipCount++
      continue
    }
    if (size > MAX_AI_SIZE) {
      console.log(`${tag} — ข้าม (ไฟล์ ${(size / 1024 / 1024).toFixed(1)} MB เกิน 4 MB)` )
      results.push({ file, title, status: 'skipped-large', category: '-', sections: 0, tokens: 0, credits: 0, providerCredits: 0, note: `${(size / 1024 / 1024).toFixed(1)} MB` })
      skipCount++
      continue
    }
    if (DRY_RUN) {
      console.log(`${tag} — (dry run) จะอัปโหลดเป็น "${title}" ขนาด ${(size / 1024).toFixed(0)} KB`)
      continue
    }

    try {
      const base64 = fs.readFileSync(full).toString('base64')
      const res = await fetch(`${API}/api/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file,
          fileSize: size,
          fileType: 'application/pdf',
          uploadType: 'law_doc',
          lawTitle: title,
          fileBase64: base64,
          autoClassify: true,
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        const msg = json.error || `HTTP ${res.status}`
        console.log(`${tag} — ล้มเหลว: ${msg}`)
        results.push({ file, title, status: 'failed', category: '-', sections: 0, tokens: 0, credits: 0, providerCredits: 0, note: msg })
        failCount++
        if (json.error === 'INSUFFICIENT_CREDITS') {
          console.log('\nเครดิตไม่พอ — หยุดกลางทาง')
          break
        }
        await sleep(DELAY_MS)
        continue
      }

      const ai = json.ai || {}
      totalTokens += ai.tokens || 0
      totalCredits += ai.creditsUsed || 0
      totalProviderCredits += ai.providerCredits || 0
      okCount++

      const note = ai.used ? '' : (ai.skippedReason || 'AI ไม่ได้ใช้')
      const win = ai.windows ? ` · อ่าน ${ai.okWindows ?? ai.windows}/${ai.windows} ช่วง` : ''
      console.log(`${tag} — OK · หมวด ${ai.categoryLabel || ai.category} · ${ai.sections || 0} มาตรา · ${ai.tokens || 0} tokens · ${ai.creditsUsed || 0} cr${win}${note ? ` · ${note}` : ''}`)
      results.push({
        file, title, status: ai.used ? 'ok' : 'no-ai',
        category: ai.categoryLabel || ai.category || '-',
        sections: ai.sections || 0,
        tokens: ai.tokens || 0,
        credits: ai.creditsUsed || 0,
        providerCredits: ai.providerCredits || 0,
        note,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`${tag} — ข้อผิดพลาด: ${msg.slice(0, 120)}`)
      results.push({ file, title, status: 'failed', category: '-', sections: 0, tokens: 0, credits: 0, providerCredits: 0, note: msg.slice(0, 120) })
      failCount++
    }

    await sleep(DELAY_MS)
  }

  console.log('\n================ สรุป ================')
  console.log(`สำเร็จ ${okCount} · ข้าม ${skipCount} · ล้มเหลว ${failCount}`)
  console.log(`โทเคนรวม ${totalTokens.toLocaleString()} · เครดิตที่หัก ${totalCredits.toLocaleString()} · ต้นทุนค่าย ${totalProviderCredits.toLocaleString(undefined, { maximumFractionDigits: 4 })} cr`)

  const noAi = results.filter(r => r.status === 'no-ai')
  if (noAi.length) {
    console.log(`\nไฟล์ที่ AI อ่านข้อความไม่ได้ (อาจเป็น PDF สแกน/รูป — ต้องวางข้อความเอง):`)
    for (const r of noAi) console.log(`  · ${r.file} → ${r.note}`)
  }
  const failed = results.filter(r => r.status === 'failed')
  if (failed.length) {
    console.log(`\nไฟล์ที่ล้มเหลว:`)
    for (const r of failed) console.log(`  · ${r.file} → ${r.note}`)
  }

  const docs = await db.lawDocument.count()
  const chunks = await db.lawChunk.count()
  const wallet = await db.wallet.findFirst()
  console.log(`\nคลังตอนนี้: ${docs} เอกสาร · ${chunks} มาตรา · เครดิตคงเหลือ ${wallet?.balance ?? '-'}`)
}

main()
  .catch(err => { console.error('batch error:', err); process.exitCode = 1 })
  .finally(async () => { await db.$disconnect() })
