import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { creditsFromTokens } from '@/lib/ai-pricing'
import { getAiConfig } from '@/lib/ai-call'
import { extractLawWithAi } from '@/lib/ai-doc'
import { extractTextFromBuffer } from '@/lib/doc-text'

// ที่มา: ดึงโดเมนจาก URL ที่ผู้ใช้วาง เช่น https://www.rd.go.th/x -> rd.go.th
function extractHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || null
  } catch {
    return null
  }
}

// รหัสเอกสารสร้างอัตโนมัติจากชื่อ (ฟอร์มไม่ให้กรอกเองแล้ว)
function codeFromTitle(title: string): string {
  const ascii = title.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return ascii.length >= 3 ? ascii.slice(0, 24) : 'LAW'
}

async function generateUniqueCode(title: string): Promise<string> {
  const base = codeFromTitle(title)
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}-${Date.now().toString(36).toUpperCase().slice(-4)}${i > 0 ? i : ''}`
    const exists = await db.lawDocument.findUnique({ where: { code: candidate } })
    if (!exists) return candidate
  }
  return `${base}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

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
      sourceUrl,
      edition,
      status,
      publishedAt,
      content,
      fileBase64,
      autoClassify,
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
      sourceUrl?: string
      edition?: string
      status?: string
      publishedAt?: string
      content?: string
      fileBase64?: string
      autoClassify?: boolean
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

    // uploadType === 'law_doc' — เพิ่มเอกสาร + ให้ AI ประมวลผล/แยกหมวดหมู่/สกัดมาตรา
    if (!lawTitle) {
      return NextResponse.json({ error: 'ต้องระบุชื่อกฎหมายสำหรับการเพิ่มเอกสาร' }, { status: 400 })
    }

    // ---- 1) เตรียมข้อความ: ใช้ข้อความที่วางมา หรือสกัดจากไฟล์ที่อัปโหลด (PDF/DOCX/TXT) ----
    let docText = (content || '').trim()
    let extractedNote: string | undefined
    let pageCount = Math.ceil((fileSize || 0) / 4096)

    if (!docText && fileBase64) {
      try {
        const buffer = Buffer.from(fileBase64, 'base64')
        const extracted = await extractTextFromBuffer(buffer, fileName || '', fileType)
        docText = extracted.text
        extractedNote = extracted.note
        if (extracted.pages > 0) pageCount = extracted.pages
      } catch (err) {
        extractedNote = `สกัดข้อความจากไฟล์ไม่สำเร็จ: ${String(err).slice(0, 120)}`
      }
    }

    const MIN_TEXT = 200
    const wantsAi = autoClassify !== false
    const canUseAi = wantsAi && docText.length >= MIN_TEXT

    // ---- 2) ให้ AI วิเคราะห์: หมวดหมู่ + ประเภท + มาตรา ----
    const lawCategories = await db.lawCategory.findMany({ orderBy: { sortOrder: 'asc' } })
    const lawTypes = await db.optionItem.findMany({ where: { group: 'law_type' }, orderBy: { sortOrder: 'asc' } })
    const allowedCats = lawCategories.length
      ? lawCategories.map(c => ({ value: c.value, label: c.label }))
      : [{ value: 'revenue_code', label: 'ประมวลรัษฎากร' }]
    const allowedTypes = lawTypes.length
      ? lawTypes.map(t => ({ value: t.value, label: t.label }))
      : [{ value: 'act', label: 'พระราชบัญญัติ' }]

    interface AiClassification {
      category?: string
      type?: string
      shortTitle?: string
      edition?: string | null
      summary?: string
      sections?: Array<{ sectionNumber?: string; sectionLabel?: string; content?: string; pageStart?: number }>
    }

    let ai: AiClassification | null = null
    let aiSkippedReason: string | undefined = extractedNote
    const aiMeta: { engine: 'ai' | 'none'; provider: string | null; protocol: string | null; tokens: number; credits: number; providerCredits: number | null } = {
      engine: 'none', provider: null, protocol: null, tokens: 0, credits: 0, providerCredits: null,
    }

    const aiConfig = await getAiConfig()
    let aiWindows = 0
    if (!wantsAi) {
      aiSkippedReason = 'ปิดการวิเคราะห์ด้วย AI (ใช้ค่าที่กรอกเอง)'
    } else if (!aiConfig) {
      aiSkippedReason = 'ยังไม่ได้ตั้งค่าผู้ให้บริการ AI ในหน้า /settings'
    } else if ((user.wallet?.balance ?? 0) < 1) {
      aiSkippedReason = 'เครดิตไม่พอสำหรับประมวลผลด้วย AI (ต้องการอย่างน้อย 1 ครีดิต)'
    } else if (docText.length < MIN_TEXT) {
      aiSkippedReason = docText.length === 0
        ? 'ไม่มีข้อความให้วิเคราะห์ (อัปโหลดไฟล์ที่อ่านข้อความได้ หรือวางข้อความ)'
        : `ข้อความสั้นเกินไป (${docText.length} ตัวอักษร)`
    } else {
      // อ่านทีละช่วง 8-10K ตัวอักษร แล้วรวมมาตรา — ไฟล์ยาวจึงไม่ถูกตัดทิ้งกลางทาง
      const outcome = await extractLawWithAi(aiConfig, docText, {
        title: lawTitle,
        allowedCats,
        allowedTypes,
      })

      aiMeta.tokens = outcome.tokens
      aiMeta.provider = aiConfig.providerId
      aiMeta.protocol = aiConfig.protocol
      aiMeta.providerCredits = outcome.providerCredits
      aiWindows = outcome.windows

      if (outcome.data) {
        ai = outcome.data
        aiMeta.engine = 'ai'
      } else {
        aiSkippedReason = 'AI ตอบกลับแต่ไม่ใช่รูปแบบ JSON ที่อ่านได้'
      }
      if (outcome.failedWindows > 0) {
        aiSkippedReason = [aiSkippedReason, `อ่านไม่ได้ ${outcome.failedWindows}/${outcome.windows} ช่วง`]
          .filter(Boolean)
          .join(' · ')
      }
    }

    const validCategory = ai?.category && allowedCats.some(c => c.value === ai.category) ? ai.category : undefined
    const validType = ai?.type && allowedTypes.some(t => t.value === ai.type) ? ai.type : undefined

    // รหัสเอกสารสร้างอัตโนมัติ (ฟอร์มไม่ให้กรอกแล้ว) — กันซ้ำกับคอลัมน์ @unique
    const code = lawCode?.trim() || (await generateUniqueCode(lawTitle))
    // ที่มา: ผู้ใช้วาง URL → เก็บเป็น sourceUrl และถอดโดเมนเป็น source
    const urlHost = sourceUrl ? extractHost(sourceUrl) : null
    const publishedDate = publishedAt ? new Date(publishedAt) : new Date()

    const newDoc = await db.lawDocument.create({
      data: {
        code,
        title: lawTitle,
        shortTitle: ai?.shortTitle?.trim() || (lawTitle.length > 30 ? lawTitle.slice(0, 30) + '...' : lawTitle),
        summary: ai?.summary?.trim() || null,
        edition: edition?.trim() || ai?.edition?.trim() || null,
        type: lawType || validType || 'act',
        category: category || validCategory || 'revenue_code',
        source: source || urlHost || 'rd.go.th',
        sourceUrl: sourceUrl?.trim() || null,
        pdfFile: fileName,
        pageCount: pageCount > 0 ? pageCount : Math.ceil((fileSize || 0) / 4096),
        status: status || 'in_force',
        effectiveDate: publishedDate,
        publishedAt: publishedDate,
      },
    })

    // ---- 3) สร้างมาตรา (chunks) ให้ค้นหาได้ทันที ----
    // เพดานสูงขึ้นเพราะอ่านทีละช่วง: หลายช่วงรวมกันได้มากกว่า 40 มาตรา
    const sections = (ai?.sections || [])
      .filter(s => (s.content || '').trim().length >= 20)
      .slice(0, 300)

    if (sections.length) {
      await db.lawChunk.createMany({
        data: sections.map((s, i) => ({
          documentId: newDoc.id,
          sectionNumber: String(s.sectionNumber || i + 1).slice(0, 40),
          sectionLabel: String(s.sectionLabel || `มาตรา ${s.sectionNumber || i + 1}`).slice(0, 120),
          content: String(s.content || '').slice(0, 4000),
          pageStart: Number(s.pageStart) > 0 ? Number(s.pageStart) : 1,
          keywords: `${lawTitle} ${s.sectionLabel || ''}`.slice(0, 200),
        })),
      })
    }

    // ---- 4) ค่าใช้จ่าย: งานอัปโหลด/ประมวลผล "ไม่คิดเครดิต" (แต่ยังบันทึก log ตามจริง) ----
    const charged = 0
    aiMeta.credits = 0

    await db.usageLog.create({
      data: {
        userId: user.id,
        action: 'upload_law_doc',
        creditsCost: charged,
        metadata: JSON.stringify({
          documentId: newDoc.id,
          fileName,
          code,
          engine: aiMeta.engine,
          provider: aiMeta.provider,
          protocol: aiMeta.protocol,
          tokens: aiMeta.tokens,
          credits: charged,
          providerCredits: aiMeta.providerCredits,
          sections: sections.length,
          windows: aiWindows,
          category: newDoc.category,
          type: newDoc.type,
        }),
      },
    })

    const categoryLabel = allowedCats.find(c => c.value === newDoc.category)?.label ?? newDoc.category
    const updatedWallet = await db.wallet.findUnique({ where: { userId: user.id } })

    return NextResponse.json({
      uploadId: newDoc.id,
      status: 'success',
      uploadType: 'law_doc',
      document: newDoc,
      ai: {
        used: aiMeta.engine === 'ai',
        provider: aiMeta.provider,
        protocol: aiMeta.protocol,
        category: newDoc.category,
        categoryLabel,
        type: newDoc.type,
        shortTitle: newDoc.shortTitle,
        summary: ai?.summary ?? null,
        sections: sections.length,
        windows: aiWindows,
        tokens: aiMeta.tokens,
        creditsUsed: charged,
        providerCredits: aiMeta.providerCredits,
        skippedReason: aiMeta.engine === 'ai' ? undefined : aiSkippedReason,
        textLength: docText.length,
      },
      balance: updatedWallet?.balance ?? 0,
      message: sections.length
        ? `AI วิเคราะห์แล้ว: หมวด ${categoryLabel} · สกัดได้ ${sections.length} มาตรา (ค้นหาได้ทันที)`
        : `เพิ่มเอกสาร "${lawTitle}" เข้าคลังกฎหมายเรียบร้อย`,
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
