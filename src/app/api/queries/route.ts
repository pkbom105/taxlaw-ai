import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/queries - list search history
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const mode = searchParams.get('mode')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = { userId: undefined }
    const user = await db.user.findUnique({ where: { email: 'demo@taxlaw.ai' } })
    if (user) where.userId = user.id
    if (mode && mode !== 'all') where.mode = mode
    if (status && status !== 'all') where.status = status

    const queries = await db.searchQuery.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { citations: true },
    })

    return NextResponse.json({
      queries: queries.map(q => ({
        id: q.id,
        query: q.query,
        mode: q.mode,
        status: q.status,
        creditsUsed: q.creditsUsed,
        chunkCount: q.chunkCount,
        citationsCount: q.citations.length,
        durationMs: q.durationMs,
        tokensUsed: q.tokensUsed,
        createdAt: q.createdAt,
        answer: q.answer,
        citations: q.citations.map(c => ({
          id: c.id,
          chunkId: c.chunkId,
          documentCode: c.documentCode,
          documentTitle: c.documentTitle,
          sectionLabel: c.sectionLabel,
          pageStart: c.pageStart,
          relevance: c.relevance,
          snippet: c.snippet,
        })),
      })),
    })
  } catch (err) {
    console.error('Queries API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
