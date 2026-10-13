import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/upload - register an uploaded document
// Used for: (a) user audit files (Tax Compliance Audit) (b) new law documents
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      fileName,
      fileSize,
      fileType,
      category,
      description,
      uploadType, // 'audit' | 'law_doc'
      lawCode,
      lawTitle,
      lawType,
      source,
    } = body as {
      fileName?: string
      fileSize?: number
      fileType?: string
      category?: string
      description?: string
      uploadType?: 'audit' | 'law_doc'
      lawCode?: string
      lawTitle?: string
      lawType?: string
      source?: string
    }

    if (!fileName || !uploadType) {
      return NextResponse.json({ error: 'fileName and uploadType are required' }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { email: 'demo@taxlaw.ai' },
      include: { wallet: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (uploadType === 'audit') {
      // Audit uploads cost 10 credits
      const cost = 10
      if (user.wallet && user.wallet.balance < cost) {
        return NextResponse.json({
          error: 'INSUFFICIENT_CREDITS',
          message: `ยอดเครดิตไม่เพียงพอ ต้องการ ${cost} ครีดิต คงเหลือ ${user.wallet.balance}`,
          required: cost,
          balance: user.wallet.balance,
        }, { status: 402 })
      }

      // Deduct credits
      if (user.wallet) {
        await db.wallet.update({
          where: { userId: user.id },
          data: {
            balance: { decrement: cost },
            totalUsed: { increment: cost },
          },
        })
      }

      // Log usage
      await db.usageLog.create({
        data: {
          userId: user.id,
          action: 'search_audit',
          creditsCost: cost,
          metadata: JSON.stringify({ fileName, fileSize, fileType, category, description }),
        },
      })

      // Simulate audit result - find matching chunks in same category
      const matchedChunks = await db.lawChunk.findMany({
        where: { document: { category: category || 'revenue_code' } },
        take: 5,
        include: { document: true },
      })

      // Create a search query record for the audit
      const auditQuery = await db.searchQuery.create({
        data: {
          userId: user.id,
          query: `[Audit] ${fileName} - ${description || 'ตรวจสอบ Tax Compliance'}`,
          mode: 'audit',
          creditsUsed: cost,
          answer: `**ผลการตรวจสอบเอกสาร**: ${fileName}\n\nพบเอกสารกฎหมายที่เกี่ยวข้อง ${matchedChunks.length} มาตรา ในหมวด "${category || 'revenue_code'}" ที่ควรตรวจสอบ:\n\n${matchedChunks.map((c, i) => `${i + 1}. ${c.sectionLabel} - ${c.document.shortTitle || c.document.title}`).join('\n')}\n\n📄 ไฟล์ที่อัปโหลด: ${fileName} (${(fileSize / 1024).toFixed(1)} KB)\n\n⚠️ คำแนะนำ: ควรตรวจสอบเนื้อหาเอกสารเทียบกับมาตราดังกล่าว หากพบความขัดแย้ง ควรปรึกษาที่ปรึกษาภาษี`,
          status: 'success',
          chunkCount: matchedChunks.length,
          tokensUsed: 500,
          durationMs: 1500,
          citations: {
            create: matchedChunks.map((c, i) => ({
              chunkId: c.id,
              documentId: c.document.id,
              documentCode: c.document.code,
              documentTitle: c.document.shortTitle || c.document.title,
              sectionLabel: c.sectionLabel,
              pageStart: c.pageStart,
              relevance: 0.9 - i * 0.05,
              snippet: c.content.slice(0, 200) + '...',
            })),
          },
        },
        include: { citations: true },
      })

      const updatedWallet = await db.wallet.findUnique({ where: { userId: user.id } })

      return NextResponse.json({
        uploadId: auditQuery.id,
        status: 'success',
        uploadType: 'audit',
        fileName,
        fileSize,
        fileType,
        category,
        description,
        creditsUsed: cost,
        balance: updatedWallet?.balance || 0,
        auditResult: {
          queryId: auditQuery.id,
          answer: auditQuery.answer,
          matchedCount: matchedChunks.length,
          citations: auditQuery.citations.map(c => ({
            id: c.id,
            documentCode: c.documentCode,
            documentTitle: c.documentTitle,
            sectionLabel: c.sectionLabel,
            pageStart: c.pageStart,
            relevance: c.relevance,
            snippet: c.snippet,
          })),
        },
      })
    }

    // uploadType === 'law_doc' - register a new law document (no cost, admin only)
    if (!lawCode || !lawTitle) {
      return NextResponse.json({ error: 'lawCode and lawTitle are required for law_doc upload' }, { status: 400 })
    }

    const newDoc = await db.lawDocument.create({
      data: {
        code: lawCode,
        title: lawTitle,
        shortTitle: lawTitle.length > 30 ? lawTitle.slice(0, 30) + '...' : lawTitle,
        type: lawType || 'act',
        category: category || 'revenue_code',
        source: source || 'rd.go.th',
        sourceUrl: null,
        pdfFile: fileName,
        pageCount: Math.ceil((fileSize || 0) / 4096),
        effectiveDate: new Date(),
        publishedAt: new Date(),
      },
    })

    await db.usageLog.create({
      data: {
        userId: user.id,
        action: 'upload_law_doc',
        creditsCost: 0,
        metadata: JSON.stringify({ documentId: newDoc.id, fileName, lawCode }),
      },
    })

    return NextResponse.json({
      uploadId: newDoc.id,
      status: 'success',
      uploadType: 'law_doc',
      document: newDoc,
      message: `เพิ่มเอกสาร "${lawTitle}" เข้าคลังกฎหมายเรียบร้อย`,
    })
  } catch (err) {
    console.error('Upload API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/upload - list user's uploaded audit files (recent audit queries)
export async function GET() {
  try {
    const user = await db.user.findUnique({ where: { email: 'demo@taxlaw.ai' } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const auditQueries = await db.searchQuery.findMany({
      where: { userId: user.id, mode: 'audit' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { citations: true },
    })

    return NextResponse.json({
      uploads: auditQueries.map(q => ({
        id: q.id,
        fileName: q.query.replace(/^\[Audit\]\s*/, '').split(' - ')[0],
        description: q.query.replace(/^\[Audit\]\s*[^-]+ - /, ''),
        status: q.status,
        creditsUsed: q.creditsUsed,
        matchedCount: q.chunkCount,
        durationMs: q.durationMs,
        createdAt: q.createdAt,
        answer: q.answer,
        citationsCount: q.citations.length,
      })),
    })
  } catch (err) {
    console.error('Upload GET API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
