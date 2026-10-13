import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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

    const categoryMap: Record<string, string> = {
      revenue_code: 'ประมวลรัษฎากร',
      specific_tax: 'ภาษีเฉพาะด้าน',
      ccc: 'ประมวลกฎหมายแพ่งฯ',
      criminal_corporate: 'อาญา/บริษัท',
      accounting: 'กฎหมายบัญชี',
      dta: 'สนธิสัญญาภาษีซ้อน',
    }

    return NextResponse.json({
      documents: documents.map(d => ({
        id: d.id,
        code: d.code,
        title: d.title,
        shortTitle: d.shortTitle,
        type: d.type,
        category: d.category,
        categoryLabel: categoryMap[d.category] || d.category,
        source: d.source,
        sourceUrl: d.sourceUrl,
        pdfFile: d.pdfFile,
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
      categories: Object.entries(categoryMap).map(([value, label]) => ({ value, label })),
    })
  } catch (err) {
    console.error('Documents API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
