import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { OPTION_GROUPS } from '@/lib/option-defaults'

const VALID_GROUPS = OPTION_GROUPS.map(g => g.group)

function parseMeta(meta: string | null) {
  if (!meta) return null
  try {
    return JSON.parse(meta)
  } catch {
    return null
  }
}

// Count how many records currently reference each option value (used to block deletes)
async function usageMap(group: string): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  const add = (key: string, count: number) => map.set(key, count)

  switch (group) {
    case 'law_type': {
      const rows = await db.lawDocument.groupBy({ by: ['type'], _count: { _all: true } })
      rows.forEach(r => add(r.type, r._count._all))
      break
    }
    case 'law_source': {
      const rows = await db.lawDocument.groupBy({ by: ['source'], _count: { _all: true } })
      rows.forEach(r => add(r.source, r._count._all))
      break
    }
    case 'role': {
      const rows = await db.user.groupBy({ by: ['role'], _count: { _all: true } })
      rows.forEach(r => add(r.role, r._count._all))
      break
    }
    case 'search_mode': {
      const rows = await db.searchQuery.groupBy({ by: ['mode'], _count: { _all: true } })
      rows.forEach(r => add(r.mode, r._count._all))
      break
    }
    case 'category_icon': {
      const rows = await db.lawCategory.groupBy({ by: ['icon'], _count: { _all: true } })
      rows.forEach(r => add(r.icon, r._count._all))
      break
    }
    case 'category_color': {
      const rows = await db.lawCategory.groupBy({ by: ['color'], _count: { _all: true } })
      rows.forEach(r => add(r.color, r._count._all))
      break
    }
    default:
      break
  }
  return map
}

// GET /api/options - all option groups (or ?group=law_type for one group)
export async function GET(req: NextRequest) {
  try {
    const group = new URL(req.url).searchParams.get('group')
    const groups = group && VALID_GROUPS.includes(group) ? [group] : VALID_GROUPS

    const rows = await db.optionItem.findMany({
      where: { group: { in: groups } },
      orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    const usageByGroup = await Promise.all(groups.map(async g => [g, await usageMap(g)] as const))
    const usage = new Map(usageByGroup)

    return NextResponse.json({
      options: rows.map(o => ({
        id: o.id,
        group: o.group,
        value: o.value,
        label: o.label,
        meta: parseMeta(o.meta),
        sortOrder: o.sortOrder,
        usageCount: usage.get(o.group)?.get(o.value) ?? 0,
      })),
      groups: OPTION_GROUPS,
    })
  } catch (err) {
    console.error('Options API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/options - create one option
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const group = String(body.group ?? '').trim()
    const value = String(body.value ?? '').trim()
    const label = String(body.label ?? '').trim()
    const meta = body.meta && typeof body.meta === 'object' ? JSON.stringify(body.meta) : null

    if (!VALID_GROUPS.includes(group)) {
      return NextResponse.json({ error: `ไม่รู้จักกลุ่ม "${group}"` }, { status: 400 })
    }
    if (!/^[a-zA-Z0-9._-]{1,60}$/.test(value)) {
      return NextResponse.json({ error: 'รหัสตัวเลือกใช้ได้เฉพาะ a-z, A-Z, 0-9, . _ - (1-60 ตัว)' }, { status: 400 })
    }
    if (!label) return NextResponse.json({ error: 'กรุณากรอกชื่อตัวเลือก' }, { status: 400 })

    const exists = await db.optionItem.findUnique({ where: { group_value: { group, value } } })
    if (exists) return NextResponse.json({ error: `รหัส "${value}" มีอยู่แล้วในกลุ่มนี้` }, { status: 409 })

    const last = await db.optionItem.findFirst({ where: { group }, orderBy: { sortOrder: 'desc' } })
    const item = await db.optionItem.create({
      data: { group, value, label, meta, sortOrder: (last?.sortOrder ?? -1) + 1 },
    })

    return NextResponse.json(
      { option: { ...item, meta: parseMeta(item.meta), usageCount: 0 } },
      { status: 201 }
    )
  } catch (err) {
    console.error('Options API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
