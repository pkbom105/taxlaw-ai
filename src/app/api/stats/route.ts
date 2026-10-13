import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Get demo user (in production this would come from auth)
async function getDemoUser() {
  const user = await db.user.findUnique({
    where: { email: 'demo@taxlaw.ai' },
    include: { wallet: true },
  })
  return user
}

// GET /api/stats - dashboard overview stats
export async function GET(req: NextRequest) {
  try {
    const user = await getDemoUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const now = new Date()
    const last30Days = new Date(now.getTime() - 30 * 86400000)
    const last7Days = new Date(now.getTime() - 7 * 86400000)

    const [
      totalDocuments,
      totalChunks,
      totalQueries,
      queriesLast30,
      queriesLast7,
      totalTopUps,
      recentQueries,
      queriesByMode,
      dailyUsage,
      topDocuments,
    ] = await Promise.all([
      db.lawDocument.count(),
      db.lawChunk.count(),
      db.searchQuery.count({ where: { userId: user.id } }),
      db.searchQuery.count({ where: { userId: user.id, createdAt: { gte: last30Days } } }),
      db.searchQuery.count({ where: { userId: user.id, createdAt: { gte: last7Days } } }),
      db.topUpTransaction.count({ where: { userId: user.id } }),
      db.searchQuery.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { citations: true },
      }),
      db.searchQuery.groupBy({
        by: ['mode'],
        where: { userId: user.id },
        _count: true,
        _sum: { creditsUsed: true },
      }),
      db.searchQuery.findMany({
        where: { userId: user.id, createdAt: { gte: last30Days } },
        select: { createdAt: true, creditsUsed: true, mode: true },
      }),
      db.lawDocument.findMany({
        include: { _count: { select: { chunks: true } } },
      }),
    ])

    // Build category distribution
    const categoryMap: Record<string, string> = {
      revenue_code: 'ประมวลรัษฎากร',
      specific_tax: 'ภาษีเฉพาะด้าน',
      ccc: 'ประมวลกฎหมายแพ่งฯ',
      criminal_corporate: 'อาญา/บริษัท',
      accounting: 'กฎหมายบัญชี',
      dta: 'สนธิสัญญาภาษีซ้อน',
    }
    const categories = topDocuments.map(doc => ({
      code: doc.code,
      title: doc.shortTitle || doc.title,
      category: doc.category,
      categoryLabel: categoryMap[doc.category] || doc.category,
      type: doc.type,
      source: doc.source,
      sourceUrl: doc.sourceUrl,
      pageCount: doc.pageCount,
      chunkCount: doc._count.chunks,
      status: doc.status,
      effectiveDate: doc.effectiveDate,
    }))

    // Build daily usage chart data
    const dailyMap: Record<string, { date: string; queries: number; credits: number }> = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000)
      const key = d.toISOString().slice(0, 10)
      dailyMap[key] = { date: key, queries: 0, credits: 0 }
    }
    for (const q of dailyUsage) {
      const key = q.createdAt.toISOString().slice(0, 10)
      if (dailyMap[key]) {
        dailyMap[key].queries += 1
        dailyMap[key].credits += q.creditsUsed
      }
    }
    const dailyUsageData = Object.values(dailyMap).map(d => ({
      ...d,
      dateLabel: new Date(d.date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' }),
    }))

    // Citation accuracy (queries with at least 1 citation / total)
    const queriesWithCitations = await db.searchQuery.count({
      where: { userId: user.id, status: 'success', chunkCount: { gt: 0 } },
    })
    const accuracyRate = totalQueries > 0 ? (queriesWithCitations / totalQueries) * 100 : 0

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
      },
      wallet: user.wallet,
      stats: {
        totalDocuments,
        totalChunks,
        totalQueries,
        queriesLast30,
        queriesLast7,
        totalTopUps,
        accuracyRate: Math.round(accuracyRate * 100) / 100,
        creditsUsed30: dailyUsage.reduce((sum, q) => sum + q.creditsUsed, 0),
      },
      recentQueries: recentQueries.map(q => ({
        id: q.id,
        query: q.query,
        mode: q.mode,
        status: q.status,
        creditsUsed: q.creditsUsed,
        chunkCount: q.chunkCount,
        citationsCount: q.citations.length,
        durationMs: q.durationMs,
        createdAt: q.createdAt,
      })),
      queriesByMode: queriesByMode.map(m => ({
        mode: m.mode,
        count: m._count,
        credits: m._sum.creditsUsed || 0,
      })),
      categories,
      dailyUsage: dailyUsageData,
    })
  } catch (err) {
    console.error('Stats API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
