import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const ICON_OPTIONS = ['scale', 'landmark', 'book-open', 'gavel', 'calculator', 'globe']
const COLOR_OPTIONS = ['emerald', 'amber', 'sky', 'rose', 'violet', 'cyan']

// PATCH /api/categories/[id] - edit a category (value/slug is immutable)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const current = await db.lawCategory.findUnique({ where: { id } })
    if (!current) return NextResponse.json({ error: 'ไม่พบหมวดนี้' }, { status: 404 })

    const body = await req.json()
    const label = body.label === undefined ? current.label : String(body.label).trim()
    const short = body.short === undefined ? current.short : String(body.short).trim()
    const description =
      body.description === undefined ? current.description : String(body.description).trim()
    const icon = ICON_OPTIONS.includes(body.icon) ? body.icon : current.icon
    const color = COLOR_OPTIONS.includes(body.color) ? body.color : current.color

    if (!label) return NextResponse.json({ error: 'กรุณากรอกชื่อหมวด' }, { status: 400 })
    if (!short) return NextResponse.json({ error: 'กรุณากรอกตัวย่อ' }, { status: 400 })

    const category = await db.lawCategory.update({
      where: { id },
      data: { label, short, description, icon, color },
    })

    const documentCount = await db.lawDocument.count({ where: { category: current.value } })
    return NextResponse.json({ category: { ...category, documentCount } })
  } catch (err) {
    console.error('Categories API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/categories/[id] - only when no document uses this category
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const current = await db.lawCategory.findUnique({ where: { id } })
    if (!current) return NextResponse.json({ error: 'ไม่พบหมวดนี้' }, { status: 404 })

    const documentCount = await db.lawDocument.count({ where: { category: current.value } })
    if (documentCount > 0) {
      return NextResponse.json(
        { error: `ลบไม่ได้ — หมวดนี้ยังมีเอกสาร ${documentCount} ฉบับ ต้องย้ายหรือลบเอกสารก่อน` },
        { status: 409 }
      )
    }

    await db.lawCategory.delete({ where: { id } })
    return NextResponse.json({ ok: true, deleted: current.value })
  } catch (err) {
    console.error('Categories API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
