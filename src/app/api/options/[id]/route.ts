import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function parseMeta(meta: string | null) {
  if (!meta) return null
  try {
    return JSON.parse(meta)
  } catch {
    return null
  }
}

async function usageCount(group: string, value: string): Promise<number> {
  switch (group) {
    case 'law_type':
      return db.lawDocument.count({ where: { type: value } })
    case 'law_source':
      return db.lawDocument.count({ where: { source: value } })
    case 'role':
      return db.user.count({ where: { role: value } })
    case 'search_mode':
      return db.searchQuery.count({ where: { mode: value } })
    case 'category_icon':
      return db.lawCategory.count({ where: { icon: value } })
    case 'category_color':
      return db.lawCategory.count({ where: { color: value } })
    default:
      return 0
  }
}

// PATCH /api/options/[id] - edit label / meta (value is immutable)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const current = await db.optionItem.findUnique({ where: { id } })
    if (!current) return NextResponse.json({ error: 'ไม่พบตัวเลือกนี้' }, { status: 404 })

    const body = await req.json()
    const label = body.label === undefined ? current.label : String(body.label).trim()
    const meta =
      body.meta === undefined
        ? current.meta
        : body.meta && typeof body.meta === 'object'
          ? JSON.stringify(body.meta)
          : null

    if (!label) return NextResponse.json({ error: 'กรุณากรอกชื่อตัวเลือก' }, { status: 400 })

    const item = await db.optionItem.update({ where: { id }, data: { label, meta } })
    const used = await usageCount(item.group, item.value)

    return NextResponse.json({ option: { ...item, meta: parseMeta(item.meta), usageCount: used } })
  } catch (err) {
    console.error('Options API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/options/[id] - only when nothing references this option
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const current = await db.optionItem.findUnique({ where: { id } })
    if (!current) return NextResponse.json({ error: 'ไม่พบตัวเลือกนี้' }, { status: 404 })

    const used = await usageCount(current.group, current.value)
    if (used > 0) {
      return NextResponse.json(
        { error: `ลบไม่ได้ — ตัวเลือกนี้ถูกใช้อยู่ ${used} รายการ ต้องย้ายหรือลบข้อมูลที่อ้างถึงก่อน` },
        { status: 409 }
      )
    }

    await db.optionItem.delete({ where: { id } })
    return NextResponse.json({ ok: true, deleted: current.value })
  } catch (err) {
    console.error('Options API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
