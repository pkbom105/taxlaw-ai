import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/profile - get demo user profile + stats
export async function GET() {
  try {
    const user = await db.user.findUnique({
      where: { email: 'demo@taxlaw.ai' },
      include: {
        wallet: true,
        _count: {
          select: { queries: true, topUps: true, usageLogs: true },
        },
      },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Aggregate usage stats
    const [totalCreditsUsed, totalSearches, successCount, noMatchCount, last7DaysLogs, topActions] = await Promise.all([
      db.usageLog.aggregate({
        where: { userId: user.id, creditsCost: { gt: 0 } },
        _sum: { creditsCost: true },
      }),
      db.searchQuery.count({ where: { userId: user.id } }),
      db.searchQuery.count({ where: { userId: user.id, status: 'success' } }),
      db.searchQuery.count({ where: { userId: user.id, status: 'no_match' } }),
      db.usageLog.findMany({
        where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
        select: { action: true, creditsCost: true, createdAt: true },
      }),
      db.usageLog.groupBy({
        by: ['action'],
        where: { userId: user.id },
        _count: true,
        _sum: { creditsCost: true },
        orderBy: { _count: { action: 'desc' } },
        take: 10,
      }),
    ])

    // Calculate tier
    const totalUsed = totalCreditsUsed._sum.creditsCost || 0
    let tier = 'Starter'
    let tierColor = 'gray'
    let tierIcon = '🥉'
    if (totalUsed >= 5000) { tier = 'Diamond'; tierColor = 'cyan'; tierIcon = '💎' }
    else if (totalUsed >= 2000) { tier = 'Platinum'; tierColor = 'violet'; tierIcon = '👑' }
    else if (totalUsed >= 1000) { tier = 'Gold'; tierColor = 'amber'; tierIcon = '🥇' }
    else if (totalUsed >= 300) { tier = 'Silver'; tierColor = 'slate'; tierIcon = '🥈' }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company: user.company,
        createdAt: user.createdAt,
      },
      wallet: user.wallet,
      counts: {
        totalSearches: user._count.queries,
        totalTopUps: user._count.topUps,
        totalActions: user._count.usageLogs,
      },
      usage: {
        totalCreditsUsed: totalUsed,
        successCount,
        noMatchCount,
        successRate: totalSearches > 0 ? Math.round((successCount / totalSearches) * 10000) / 100 : 0,
        actionsThisWeek: last7DaysLogs.length,
        creditsThisWeek: last7DaysLogs.reduce((s, l) => s + Math.max(0, l.creditsCost), 0),
      },
      tier: { name: tier, color: tierColor, icon: tierIcon, totalUsed },
      topActions: topActions.map(a => ({
        action: a.action,
        count: a._count,
        credits: a._sum.creditsCost || 0,
      })),
    })
  } catch (err) {
    console.error('Profile API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/profile - update profile
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, company, role } = body as { name?: string; company?: string; role?: string }

    const allowedRoles = ['user', 'accountant', 'lawyer', 'admin']
    if (role && !allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const updated = await db.user.update({
      where: { email: 'demo@taxlaw.ai' },
      data: {
        ...(name !== undefined && { name }),
        ...(company !== undefined && { company }),
        ...(role !== undefined && { role }),
      },
      include: { wallet: true },
    })

    return NextResponse.json({
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        company: updated.company,
        createdAt: updated.createdAt,
      },
      wallet: updated.wallet,
    })
  } catch (err) {
    console.error('Profile PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
