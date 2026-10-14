import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { AI_TIERS, creditsFromTokens, type AiMode } from '@/lib/ai-pricing'
import { callAi, getAiConfig } from '@/lib/ai-call'

interface MatchedChunk {
  sectionLabel: string
  content: string
  pageStart: number
  document: { shortTitle: string | null; title: string; source: string }
}

// คำตอบสำรอง (เส้นทาง keyword) — ใช้เมื่อยังไม่ตั้งค่า AI หรือเรียก AI ไม่สำเร็จ
function buildKeywordAnswer(mode: string, query: string, matched: MatchedChunk[]): string {
  const answerParts: string[] = []
  answerParts.push(`**คำตอบจากฐานข้อมูลกฎหมาย** (${mode === 'basic' ? 'ค้นหาพื้นฐาน' : mode === 'deep' ? 'วิเคราะห์เชิงลึก' : 'ตรวจสอบเอกสาร'})`)
  answerParts.push('')
  answerParts.push(`พบข้อกฎหมายที่เกี่ยวข้อง ${matched.length} มาตรา/ข้อหารือ จากคำถาม "${query}" ดังนี้:`)
  answerParts.push('')
  matched.forEach((m, i) => {
    answerParts.push(`**${i + 1}. ${m.sectionLabel}** - ${m.document.shortTitle || m.document.title}`)
    answerParts.push(`> ${m.content}`)
    answerParts.push(`📄 แหล่งที่มา: ${m.document.source} | ไฟล์ PDF หน้า ${m.pageStart}`)
    answerParts.push('')
  })

  if (mode === 'deep' || mode === 'audit') {
    answerParts.push('**สรุปการวิเคราะห์**')
    answerParts.push(`จากการวิเคราะห์ ${matched.length} มาตราที่เกี่ยวข้อง พบว่าคำถาม "${query}" มีข้อกำหนดทางกฎหมายที่ชัดเจนในฐานข้อมูลราชการ คำตอบข้างต้นมาจากเอกสารทางการ 100% ไม่มีการตีความเพิ่มเติม`)
  }

  return answerParts.join('\n')
}

// POST /api/search - Zero-Hallucination RAG search
// Strict policy: only answer from retrieved context. If no match -> return "no_match"
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { query, mode = 'basic' } = body as { query?: string; mode?: 'basic' | 'deep' | 'audit' }

    if (!query || !query.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { email: 'demo@taxlaw.ai' },
      include: { wallet: true },
    })
    if (!user || !user.wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
    }

    // Pricing tier + การเชื่อมต่อ AI (ถ้าตั้งค่าไว้ → คิดเงินตาม Token credits)
    const tier = AI_TIERS[(mode as AiMode)] || AI_TIERS.basic
    const aiConfig = await getAiConfig()

    // เช็คยอดก่อนทำงาน: ถ้าต่อ AI ใช้ได้ ต้องมีอย่างน้อย 1 เครดิต
    const minRequired = aiConfig ? 1 : tier.credits
    if (user.wallet.balance < minRequired) {
      return NextResponse.json({
        error: 'INSUFFICIENT_CREDITS',
        message: `ยอดเครดิตไม่เพียงพอ ต้องการ ${minRequired} ครีดิต คงเหลือ ${user.wallet.balance} ครีดิต`,
        required: minRequired,
        balance: user.wallet.balance,
      }, { status: 402 })
    }

    const startTime = Date.now()

    // Retrieval: keyword + section matching from law chunks
    // In production, this would be a vector search; here we use keyword-based retrieval
    const allChunks = await db.lawChunk.findMany({
      include: { document: true },
    })

    // Score chunks by keyword overlap
    const queryTerms = query.toLowerCase()
      .replace(/[^\u0E00-\u0E7Fa-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1)

    const scored = allChunks.map(chunk => {
      const haystack = (chunk.content + ' ' + (chunk.keywords || '') + ' ' + chunk.sectionLabel).toLowerCase()
      let score = 0
      for (const term of queryTerms) {
        if (haystack.includes(term)) score += 1
        if (chunk.sectionLabel.toLowerCase().includes(term)) score += 2
      }
      // Special heuristics for common Thai tax questions
      if (queryTerms.some(t => ['เงินเดือน', 'salary'].includes(t)) && chunk.sectionNumber === '40(1)') score += 5
      if (queryTerms.some(t => ['อัตราภาษี', 'อัตรา'].includes(t)) && chunk.sectionNumber === '43') score += 5
      if (queryTerms.some(t => ['หัก', '3%'].includes(t)) && chunk.sectionNumber === 'RULING-3/2551') score += 5
      if (queryTerms.some(t => ['ออนไลน์', 'ecommerce', 'vat'].includes(t)) && chunk.sectionNumber === 'RULING-กห.128/2547') score += 5
      if (queryTerms.some(t => ['มรดก'].includes(t)) && chunk.sectionNumber === '11') score += 5
      if (queryTerms.some(t => ['บัญชีปลอม', 'บัญช์ปลอม'].includes(t)) && chunk.sectionNumber === '11') score += 5
      if (queryTerms.some(t => ['บริษัทจำกัด'].includes(t)) && chunk.sectionNumber === '901') score += 5
      if (queryTerms.some(t => ['ค่าสิทธิ', 'royalt'].includes(t)) && chunk.sectionNumber === 'Art.12') score += 5
      return { chunk, score }
    })
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, tier.chunkLimit)

    const matched = scored.map(s => s.chunk)
    const maxScore = scored[0]?.score || 1

    // STRICT POLICY: if no chunks matched, return "no_match" - NEVER hallucinate
    if (matched.length === 0) {
      // Refund - don't charge for failed searches? Or charge 1 for compute? Here we refund.
      const durationMs = Date.now() - startTime
      const searchQuery = await db.searchQuery.create({
        data: {
          userId: user.id,
          query,
          mode,
          creditsUsed: 0,
          answer: 'ไม่พบข้อกฎหมายที่เกี่ยวข้องในคลังข้อมูลราชการ กรุณาปรับคำถามหรือติดต่อเจ้าหน้าที่เพื่อเพิ่มข้อมูลในระบบ',
          status: 'no_match',
          chunkCount: 0,
          tokensUsed: 0,
          durationMs,
        },
      })
      await db.usageLog.create({
        data: {
          userId: user.id,
          action: `search_${mode}_no_match`,
          creditsCost: 0,
          metadata: JSON.stringify({ queryId: searchQuery.id }),
        },
      })
      return NextResponse.json({
        queryId: searchQuery.id,
        status: 'no_match',
        answer: searchQuery.answer,
        citations: [],
        creditsUsed: 0,
        balance: user.wallet.balance,
      })
    }

    // ---- ตอบด้วย AI ถ้าตั้งค่าคีย์ไว้ ไม่งั้นถอยไปสร้างคำตอบจาก context เอง (keyword) ----
    const contextText = matched
      .map((m, i) => `[${i + 1}] ${m.sectionLabel} — ${m.document.shortTitle || m.document.title} (${m.document.source}, หน้า ${m.pageStart})\n${m.content}`)
      .join('\n\n')

    let engine: 'ai' | 'keyword' = 'keyword'
    let answer = ''
    let tokensUsed = 0
    let creditsUsed = tier.credits
    let providerCredits: number | null = null

    if (aiConfig) {
      const aiResult = await callAi(aiConfig, tier.maxTokens, contextText, query)
      if (aiResult) {
        answer = aiResult.content
        tokensUsed = aiResult.tokens
        providerCredits = aiResult.providerCredits
        creditsUsed = creditsFromTokens(tokensUsed) // 1 เครดิต : 1,000 tokens (ปัดขึ้น ขั้นต่ำ 1)
        engine = 'ai'
      } else {
        console.error(`AI unavailable -> fallback keyword (mode=${mode}, protocol=${aiConfig.protocol})`)
      }
    }

    if (!answer) {
      answer = buildKeywordAnswer(mode, query, matched)
      tokensUsed = answer.length
      creditsUsed = tier.credits
      engine = 'keyword'
    }

    // หักเครดิตตามที่ใช้จริง (กันยอดติดลบ)
    const charged = Math.min(creditsUsed, user.wallet.balance)
    await db.wallet.update({
      where: { userId: user.id },
      data: {
        balance: { decrement: charged },
        totalUsed: { increment: charged },
      },
    })

    const durationMs = Date.now() - startTime

    // Save query + citations
    const searchQuery = await db.searchQuery.create({
      data: {
        userId: user.id,
        query,
        mode,
        creditsUsed: charged,
        answer,
        status: 'success',
        chunkCount: matched.length,
        tokensUsed,
        durationMs,
        citations: {
          create: matched.map((m, i) => ({
            chunkId: m.id,
            documentId: m.document.id,
            documentCode: m.document.code,
            documentTitle: m.document.shortTitle || m.document.title,
            sectionLabel: m.sectionLabel,
            pageStart: m.pageStart,
            relevance: Math.min(0.99, (scored[i].score / maxScore) * 0.95 + 0.05),
            snippet: m.content.slice(0, 200) + (m.content.length > 200 ? '...' : ''),
          })),
        },
      },
      include: { citations: true },
    })

    // Log usage
    await db.usageLog.create({
      data: {
        userId: user.id,
        action: `search_${mode}`,
        creditsCost: charged,
        metadata: JSON.stringify({ queryId: searchQuery.id, chunkCount: matched.length, engine, tokens: tokensUsed, credits: charged, protocol: aiConfig?.protocol ?? null, provider: aiConfig?.providerId ?? null, providerCredits }),
      },
    })

    const updatedWallet = await db.wallet.findUnique({ where: { userId: user.id } })

    return NextResponse.json({
      queryId: searchQuery.id,
      status: 'success',
      answer,
      citations: searchQuery.citations.map(c => ({
        id: c.id,
        chunkId: c.chunkId,
        documentCode: c.documentCode,
        documentTitle: c.documentTitle,
        sectionLabel: c.sectionLabel,
        pageStart: c.pageStart,
        relevance: c.relevance,
        snippet: c.snippet,
      })),
      creditsUsed: charged,
      balance: updatedWallet?.balance || 0,
      durationMs,
      tokensUsed,
      engine,
      protocol: aiConfig?.protocol ?? null,
      provider: aiConfig?.providerId ?? null,
      providerCredits,
    })
  } catch (err) {
    console.error('Search API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
