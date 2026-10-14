import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const ICON_OPTIONS = ['scale', 'landmark', 'book-open', 'gavel', 'calculator', 'globe']
export const COLOR_OPTIONS = ['emerald', 'amber', 'sky', 'rose', 'violet', 'cyan']

// GET /api/categories - list all categories with document counts
export async function GET() {
  try {
    const categories = await db.lawCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    const grouped = await db.lawDocument.groupBy({ by: ['category'], _count: { _all: true } })
    const countMap = new Map(grouped.map(g => [g.category, g._count._all]))

    return NextResponse.json({
      categories: categories.map(c => ({ ...c, documentCount: countMap.get(c.value) ?? 0 })),
    })
  } catch (err) {
    console.error('Categories API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/categories - create a new category
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const value = String(body.value ?? '').trim().toLowerCase()
    const label = String(body.label ?? '').trim()
    const short = String(body.short ?? '').trim()
    const description = String(body.description ?? '').trim()
    const icon = ICON_OPTIONS.includes(body.icon) ? body.icon : 'scale'
    const color = COLOR_OPTIONS.includes(body.color) ? body.color : 'emerald'

    if (!/^[a-z0-9_]{2,40}$/.test(value)) {
      return NextResponse.json(
        { error: 'รหัสหมวด (value) ใช้ได้เฉพาะ a-z, 0-9, _ ความยาว 2-40 ตัวอักษร' },
        { status: 400 }
      )
    }
    if (!label) return NextResponse.json({ error: 'กรุณากรอกชื่อหมวด' }, { status: 400 })
    if (!short) return NextResponse.json({ error: 'กรุณากรอกตัวย่อ' }, { status: 400 })

    const exists = await db.lawCategory.findUnique({ where: { value } })
    if (exists) {
      return NextResponse.json({ error: `รหัส "${value}" ถูกใช้แล้ว` }, { status: 409 })
    }

    const last = await db.lawCategory.findFirst({ orderBy: { sortOrder: 'desc' } })
    const category = await db.lawCategory.create({
      data: {
        value,
        label,
        short,
        description,
        icon,
        color,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    })

    return NextResponse.json({ category: { ...category, documentCount: 0 } }, { status: 201 })
  } catch (err) {
    console.error('Categories API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
