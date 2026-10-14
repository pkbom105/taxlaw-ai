// สกัดข้อความจากไฟล์เอกสาร (PDF / DOCX / TXT) — ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น
import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'

export interface ExtractedText {
  text: string
  pages: number
  kind: 'pdf' | 'docx' | 'text' | 'unknown'
  note?: string
}

const MAX_CHARS = 60000

function normalize(raw: string): string {
  return (raw || '')
    // ล้างอักขระควบคุม/null byte ที่มากับการดึงข้อความจาก PDF (สระ/วรรณยุกต์ไทยบางตัวอาจกลายเป็น \u0000)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\uFFFD/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  fileName: string,
  fileType?: string,
): Promise<ExtractedText> {
  const name = (fileName || '').toLowerCase()
  const type = (fileType || '').toLowerCase()

  // ---- ข้อความล้วน ----
  if (name.endsWith('.txt') || name.endsWith('.md') || type.startsWith('text/')) {
    return { text: normalize(buffer.toString('utf8')).slice(0, MAX_CHARS), pages: 1, kind: 'text' }
  }

  // ---- DOCX ----
  if (name.endsWith('.docx') || type.includes('wordprocessingml')) {
    try {
      const result = await mammoth.extractRawText({ buffer })
      return { text: normalize(result.value).slice(0, MAX_CHARS), pages: 1, kind: 'docx' }
    } catch (err) {
      return { text: '', pages: 0, kind: 'docx', note: `อ่านไฟล์ DOCX ไม่สำเร็จ: ${String(err).slice(0, 120)}` }
    }
  }

  // ---- PDF ----
  if (name.endsWith('.pdf') || type === 'application/pdf') {
    try {
      const parser = new PDFParse({ data: new Uint8Array(buffer) })
      const out = await parser.getText()
      const pages = Number((out as { total?: number }).total) || 1
      try {
        await parser.destroy()
      } catch {
        // ignore
      }
      return { text: normalize(out.text).slice(0, MAX_CHARS), pages, kind: 'pdf' }
    } catch (err) {
      return { text: '', pages: 0, kind: 'pdf', note: `อ่านไฟล์ PDF ไม่สำเร็จ: ${String(err).slice(0, 120)}` }
    }
  }

  // ---- .doc (Word เก่า) และอื่น ๆ ----
  if (name.endsWith('.doc')) {
    return { text: '', pages: 0, kind: 'unknown', note: 'ไฟล์ .doc (Word เก่า) ยังไม่รองรับ — กรุณาแปลงเป็น .docx หรือวางข้อความ' }
  }
  return { text: '', pages: 0, kind: 'unknown', note: 'ไม่รู้จักชนิดไฟล์นี้ — กรุณาวางข้อความกฎหมายแทน' }
}
