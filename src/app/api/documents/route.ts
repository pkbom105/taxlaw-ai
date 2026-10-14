import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { db } from '@/lib/db'

// โฟลเดอร์ที่เก็บไฟล์ PDF ของคลัง (ให้บริการผ่าน /public)
const BATCH_DIR = 'ิbook-pdf'

// หาลิงก์เปิดไฟล์จากชื่อไฟล์ — ตรวจว่ามีไฟล์จริงใน public ก่อน
function fileUrlFor(pdfFile: string | null): string | null {
  if (!pdfFile) return null
  const candidates = [
    { full: path.join(process.cwd(), 'public', BATCH_DIR, pdfFile), url: `/${encodeURIComponent(BATCH_DIR)}/${encodeURIComponent(pdfFile)}` },
    { full: path.join(process.cwd(), 'public', pdfFile), url: `/${encodeURIComponent(pdfFile)}` },
  ]
  for (const c of candidates) {
    try {
      if (fs.existsSync(c.full)) return c.url
    } catch {
      // ignore
    }
  }
  return null
}

// GET /api/documents - list all law documents with chunk counts
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const type = searchParams.get('type')
    const search = searchParams.get('q')

    const where: Record<string, unknown> = {}
    if (category && category !== 'all') where.category = category
    if (type && type !== 'all') where.type = type
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { shortTitle: { contains: search } },
        { code: { contains: search } },
      ]
    }

    const documents = await db.lawDocument.findMany({
      where,
      include: {
        chunks: {
          select: { id: true, sectionLabel: true, sectionNumber: true, content: true, pageStart: true, keywords: true, chunkId: true },
          orderBy: { sectionNumber: 'asc' },
        },
        _count: { select: { chunks: true } },
      },
      orderBy: { category: 'asc' },
    })

    const categoryDefs = await db.lawCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    const labelOf = (value: string) => categoryDefs.find(c => c.value === value)?.label ?? value

    return NextResponse.json({
      documents: documents.map(d => ({
        id: d.id,
        code: d.code,
        title: d.title,
        shortTitle: d.shortTitle,
        summary: d.summary,
        type: d.type,
        category: d.category,
        categoryLabel: labelOf(d.category),
        source: d.source,
        sourceUrl: d.sourceUrl,
        pdfFile: d.pdfFile,
        fileUrl: fileUrlFor(d.pdfFile),
        pageCount: d.pageCount,
        effectiveDate: d.effectiveDate,
        publishedAt: d.publishedAt,
        status: d.status,
        chunkCount: d._count.chunks,
        chunks: d.chunks.map(c => ({
          id: c.id,
          chunkId: c.chunkId,
          sectionNumber: c.sectionNumber,
          sectionLabel: c.sectionLabel,
          pageStart: c.pageStart,
          keywords: c.keywords,
          content: c.content,
        })),
      })),
      categories: categoryDefs.map(c => ({ value: c.value, label: c.label })),
    })
  } catch (err) {
    console.error('Documents API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
