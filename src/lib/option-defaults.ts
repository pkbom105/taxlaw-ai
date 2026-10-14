// Default option lists — used to seed the OptionItem table AND as runtime fallback
// Keep this file dependency-free so it can also be imported by a bun seed script.

export interface OptionDefault {
  group: string
  value: string
  label: string
  meta?: Record<string, unknown>
}

export const OPTION_GROUPS: Array<{ group: string; label: string; description: string }> = [
  { group: 'law_type', label: 'ประเภทเอกสาร', description: 'ใช้ในฟอร์มเพิ่มเอกสารกฎหมาย และแสดงประเภทในคลังกฎหมาย' },
  { group: 'law_source', label: 'แหล่งที่มาเอกสาร', description: 'ใช้ในฟอร์มเพิ่มเอกสารกฎหมาย' },
  { group: 'role', label: 'บทบาทผู้ใช้', description: 'ใช้ในหน้าโปรไฟล์ และแสดงบทบาทบน header' },
  { group: 'search_mode', label: 'โหมดค้นหา (ราคาเครดิต)', description: 'ใช้ในการ์ดเลือกโหมดในหน้า Dashboard' },
  { group: 'topup_preset', label: 'แพ็คเกจเติมเครดิต', description: 'ใช้ในหน้าต่างเติมเครดิต' },
  { group: 'law_status', label: 'สถานะเอกสาร', description: 'ใช้ในฟอร์มเพิ่มเอกสารกฎหมาย' },
  { group: 'category_icon', label: 'ไอคอนหมวดหมู่', description: 'ตัวเลือกไอคอนในหน้าตั้งค่าหมวดหมู่' },
  { group: 'category_color', label: 'สีหมวดหมู่', description: 'ตัวเลือกสีในหน้าตั้งค่าหมวดหมู่' },
]

export const DEFAULT_OPTIONS: OptionDefault[] = [
  // ----- ประเภทเอกสาร -----
  { group: 'law_type', value: 'act', label: 'พ.ร.บ.' },
  { group: 'law_type', value: 'decree', label: 'พ.ร.ฎ.' },
  { group: 'law_type', value: 'regulation', label: 'กฎกระทรวง' },
  { group: 'law_type', value: 'announcement', label: 'ประกาศ' },
  { group: 'law_type', value: 'ruling', label: 'ข้อหารือ' },
  { group: 'law_type', value: 'treaty', label: 'สนธิสัญญา' },

  // ----- แหล่งที่มา -----
  { group: 'law_source', value: 'rd.go.th', label: 'กรมสรรพากร (rd.go.th)' },
  { group: 'law_source', value: 'krisdika.go.th', label: 'กฤษฎีกา (krisdika.go.th)' },
  { group: 'law_source', value: 'ratchakitcha', label: 'ราชกิจจานุเบกษา' },

  // ----- บทบาทผู้ใช้ -----
  { group: 'role', value: 'user', label: 'ผู้ใช้ทั่วไป' },
  { group: 'role', value: 'accountant', label: 'นักบัญชี' },
  { group: 'role', value: 'lawyer', label: 'ทนายความ' },
  { group: 'role', value: 'admin', label: 'ผู้ดูแลระบบ' },

  // ----- โหมดค้นหา (meta: credits, description, features, color) -----
  { group: 'search_mode', value: 'basic', label: 'Basic Search', meta: { credits: 1, description: 'ค้นหามาตรา/ข้อหารือภาษี', features: ['Vector Search อย่างเดียว', 'แสดง 3 chunks ที่เกี่ยวข้อง', 'ไม่ใช้ LLM สรุปยาว'], color: 'emerald' } },
  { group: 'search_mode', value: 'deep', label: 'Deep Analysis', meta: { credits: 5, description: 'AI อ่านกฎหมาย 3-5 ฉบับ สรุป+เปรียบเทียบมาตรา', features: ['วิเคราะห์ 8 chunks', 'สรุปคำตอบอัตโนมัติ', 'อ้างอิงมาตรา + หน้า PDF', 'เปรียบเทียบข้อกฎหมาย'], color: 'amber' } },
  { group: 'search_mode', value: 'audit', label: 'Document Audit', meta: { credits: 10, description: 'อัปโหลดสัญญาตรวจสอบ Tax Compliance', features: ['ตรวจสอบ 15 chunks', 'เทียบกับประมวลรัษฎากร', 'หาความเสี่ยงทางภาษี', 'ออกรายงาน Compliance'], color: 'rose' } },

  // ----- แพ็คเกจเติมเครดิต (meta: amount, bonus, bonusPct) -----
  { group: 'topup_preset', value: '100', label: 'เริ่มต้น', meta: { amount: 100, bonus: 0, bonusPct: 0 } },
  { group: 'topup_preset', value: '200', label: 'มาตรฐาน', meta: { amount: 200, bonus: 10, bonusPct: 5 } },
  { group: 'topup_preset', value: '500', label: 'ยอดนิยม', meta: { amount: 500, bonus: 50, bonusPct: 10 } },
  { group: 'topup_preset', value: '1000', label: 'มืออาชีพ', meta: { amount: 1000, bonus: 150, bonusPct: 15 } },

  // ----- สถานะเอกสาร -----
  { group: 'law_status', value: 'in_force', label: 'ใช้บังคับ' },
  { group: 'law_status', value: 'repealed', label: 'ยกเลิกแล้ว' },
  { group: 'law_status', value: 'amended', label: 'แก้ไขเพิ่มเติม' },

  // ----- ไอคอนหมวดหมู่ (value = key ใน CATEGORY_ICONS) -----
  { group: 'category_icon', value: 'scale', label: 'ตาชั่ง (กฎหมายทั่วไป)' },
  { group: 'category_icon', value: 'landmark', label: 'อาคารราชการ' },
  { group: 'category_icon', value: 'book-open', label: 'หนังสือเปิด' },
  { group: 'category_icon', value: 'gavel', label: 'ค้อนตัดสิน (อาญา)' },
  { group: 'category_icon', value: 'calculator', label: 'เครื่องคิดเลข (บัญชี)' },
  { group: 'category_icon', value: 'globe', label: 'ลูกโลก (DTA)' },
  { group: 'category_icon', value: 'file-text', label: 'เอกสาร' },
  { group: 'category_icon', value: 'scroll-text', label: 'ประกาศ/ม้วนคัมภีร์' },
  { group: 'category_icon', value: 'building', label: 'อาคารบริษัท' },
  { group: 'category_icon', value: 'shield-check', label: 'โล่ตรวจสอบ' },
  { group: 'category_icon', value: 'coins', label: 'เหรียญ (การเงิน)' },
  { group: 'category_icon', value: 'book-marked', label: 'ประมวลกฎหมาย' },

  // ----- สีหมวดหมู่ (value = key ใน CATEGORY_COLORS) -----
  { group: 'category_color', value: 'emerald', label: 'เขียว' },
  { group: 'category_color', value: 'amber', label: 'เหลืองอำพัน' },
  { group: 'category_color', value: 'sky', label: 'ฟ้า' },
  { group: 'category_color', value: 'rose', label: 'ชมพูแดง' },
  { group: 'category_color', value: 'violet', label: 'ม่วง' },
  { group: 'category_color', value: 'cyan', label: 'ฟ้าคราม' },
  { group: 'category_color', value: 'teal', label: 'เขียวนิล' },
  { group: 'category_color', value: 'indigo', label: 'คราม' },
  { group: 'category_color', value: 'lime', label: 'เขียวมะนาว' },
  { group: 'category_color', value: 'fuchsia', label: 'บานเย็น' },
]
