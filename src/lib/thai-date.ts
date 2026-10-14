// Thai date helpers — ทุกวันที่ในระบบแสดงเป็น พ.ศ. (ค.ศ. + 543)
const BE_OFFSET = 543

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function toDate(value: string | Date): Date | null {
  const d = value instanceof Date ? value : new Date(value)
  return isNaN(d.getTime()) ? null : d
}

/** 15-01-2569 (พ.ศ.) */
export function formatThaiDate(value: string | Date | null | undefined): string {
  if (!value) return '-'
  const d = toDate(value)
  if (!d) return '-'
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear() + BE_OFFSET}`
}

/** 15-01-2569 14:30 (พ.ศ.) */
export function formatThaiDateTime(value: string | Date | null | undefined): string {
  if (!value) return '-'
  const d = toDate(value)
  if (!d) return '-'
  return `${formatThaiDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** dd-mm (สำหรับแกนกราฟ 30 วัน) — รองรับสตริง YYYY-MM-DD แบบไม่ให้เพี้ยน timezone */
export function formatThaiDayMonth(value: string | Date | null | undefined): string {
  if (!value) return '-'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [, m, d] = value.split('-')
    return `${d}-${m}`
  }
  const d = toDate(value)
  if (!d) return '-'
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}`
}

/** แปลง ค.ศ. (ISO yyyy-mm-dd จาก date picker) → ข้อความ พ.ศ. dd-mm-yyyy */
export function formatThaiDateFromInput(isoDate: string | null | undefined): string {
  if (!isoDate) return ''
  const d = toDate(isoDate)
  if (!d) return ''
  return formatThaiDate(d)
}
