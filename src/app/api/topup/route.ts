import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/topup - create a new PromptPay top-up transaction
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { amount, paymentMethod = 'promptpay' } = body as { amount?: number; paymentMethod?: string }

    if (!amount || amount < 100) {
      return NextResponse.json({
        error: 'MIN_AMOUNT',
        message: 'ยอดเติมขั้นต่ำ 100 บาท',
      }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { email: 'demo@taxlaw.ai' },
      include: { wallet: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    if (!user.wallet) {
      await db.wallet.create({ data: { userId: user.id, balance: 0 } })
    }

    // Pricing tier with bonus
    let bonusCredits = 0
    if (amount >= 1000) bonusCredits = Math.floor(amount * 0.15) // 15% bonus
    else if (amount >= 500) bonusCredits = Math.floor(amount * 0.10) // 10% bonus
    else if (amount >= 200) bonusCredits = Math.floor(amount * 0.05) // 5% bonus

    const credits = amount
    const promptPayRef = `PP-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 10000)}`
    // Mock PromptPay QR payload (in production: use real PromptPay API)
    const ppId = '0888888888' // demo phone
    const amountStr = amount.toFixed(2)
    const qrPayload = `00020101021229370016A00000067701011101130066${ppId}5802TH5303764540${amountStr}6304ABCD${Date.now().toString(36).toUpperCase().slice(-4)}`

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 min

    const tx = await db.topUpTransaction.create({
      data: {
        userId: user.id,
        amount,
        credits,
        bonusCredits,
        status: 'pending',
        promptPayRef,
        qrPayload,
        paymentMethod,
        expiresAt,
      },
    })

    return NextResponse.json({
      transactionId: tx.id,
      amount,
      credits,
      bonusCredits,
      totalCredits: credits + bonusCredits,
      promptPayRef,
      qrPayload,
      expiresAt,
      status: 'pending',
      paymentUrl: `https://promptpay.io/${ppId}/${amount}`,
    })
  } catch (err) {
    console.error('Topup API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/topup - simulate payment confirmation (in production: webhook from bank)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { transactionId, action } = body as { transactionId?: string; action?: 'confirm' | 'cancel' }

    if (!transactionId) {
      return NextResponse.json({ error: 'transactionId required' }, { status: 400 })
    }

    const tx = await db.topUpTransaction.findUnique({ where: { id: transactionId } })
    if (!tx) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }
    if (tx.status !== 'pending') {
      return NextResponse.json({ error: 'Transaction already processed', status: tx.status }, { status: 400 })
    }

    if (action === 'cancel') {
      const updated = await db.topUpTransaction.update({
        where: { id: transactionId },
        data: { status: 'expired' },
      })
      return NextResponse.json({ transaction: updated, status: 'expired' })
    }

    // Confirm payment
    const totalCredits = tx.credits + tx.bonusCredits
    const [updatedTx, wallet] = await db.$transaction([
      db.topUpTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'paid',
          paidAt: new Date(),
        },
      }),
      db.wallet.update({
        where: { userId: tx.userId },
        data: {
          balance: { increment: totalCredits },
          totalTopUp: { increment: totalCredits },
          bonusCredits: { increment: tx.bonusCredits },
        },
      }),
      db.usageLog.create({
        data: {
          userId: tx.userId,
          action: 'topup',
          creditsCost: -totalCredits,
          metadata: JSON.stringify({ transactionId, amount: tx.amount, bonus: tx.bonusCredits }),
        },
      }),
    ])

    return NextResponse.json({
      transaction: updatedTx,
      wallet,
      status: 'paid',
      credited: totalCredits,
    })
  } catch (err) {
    console.error('Topup confirm API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
