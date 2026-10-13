import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/wallet - get wallet + recent transactions
export async function GET(req: NextRequest) {
  try {
    const user = await db.user.findUnique({
      where: { email: 'demo@taxlaw.ai' },
      include: {
        wallet: true,
        topUps: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.wallet) {
      // Create wallet
      const wallet = await db.wallet.create({
        data: {
          userId: user.id,
          balance: 0,
        },
      })
      user.wallet = wallet
    }

    return NextResponse.json({
      wallet: user.wallet,
      transactions: user.topUps.map(t => ({
        id: t.id,
        amount: t.amount,
        credits: t.credits,
        bonusCredits: t.bonusCredits,
        status: t.status,
        promptPayRef: t.promptPayRef,
        paymentMethod: t.paymentMethod,
        createdAt: t.createdAt,
        paidAt: t.paidAt,
        expiresAt: t.expiresAt,
      })),
    })
  } catch (err) {
    console.error('Wallet API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
