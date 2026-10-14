// Shared types for Thai Tax Law AI Search System

export type SearchMode = 'basic' | 'deep' | 'audit'

export type SearchStatus = 'pending' | 'success' | 'no_match' | 'error'

// Category slugs are DB-driven now (LawCategory model + /settings), so this stays a string.
export type LawCategory = string

export interface CategoryRecord {
  id: string
  value: string
  label: string
  short: string
  description: string
  icon: string
  color: string
  sortOrder: number
  documentCount: number
}

export interface OptionRecord {
  id: string
  group: string
  value: string
  label: string
  meta: Record<string, unknown> | null
  sortOrder: number
  usageCount: number
}

export interface CategoryMeta {
  value: LawCategory
  label: string
  short: string
  description: string
  icon: string
  color: string
}

export const CATEGORY_META: CategoryMeta[] = [
  {
    value: 'revenue_code',
    label: 'ประมวลรัษฎากร',
    short: 'RC',
    description: 'ภาษีเงินได้บุคคลธรรมดา, นิติบุคคล, VAT, สรรพสามิต, อากรแสตมป์, หัก ณ ที่จ่าย',
    icon: 'scale',
    color: 'emerald',
  },
  {
    value: 'specific_tax',
    label: 'ภาษีเฉพาะด้าน',
    short: 'ST',
    description: 'ภาษีมรดก, ที่ดินและสิ่งปลูกสร้าง, ภาษีป้าย, ภาษีสรรพสามิต',
    icon: 'landmark',
    color: 'amber',
  },
  {
    value: 'ccc',
    label: 'ประมวลกฎหมายแพ่งฯ',
    short: 'CCC',
    description: 'สัญญา, หุ้นส่วน, บริษัทจำกัด, ซื้อขาย, เช่า (ใช้ตีความสัญญาเพื่อเสียภาษี)',
    icon: 'book-open',
    color: 'sky',
  },
  {
    value: 'criminal_corporate',
    label: 'อาญา/บริษัท',
    short: 'CR',
    description: 'โทษภาษีเท็จ, บัญชีเล่มผี, เอกสารปลอม, ความผิดบริษัท',
    icon: 'gavel',
    color: 'rose',
  },
  {
    value: 'accounting',
    label: 'กฎหมายบัญชี',
    short: 'ACC',
    description: 'พ.ร.บ. การบัญชี 2543 - หน้าที่จัดทำบัญชีและงบการเงิน',
    icon: 'calculator',
    color: 'violet',
  },
  {
    value: 'dta',
    label: 'สนธิสัญญาภาษีซ้อน',
    short: 'DTA',
    description: 'DTA ระหว่างไทยกับ 60+ ประเทศ สำหรับ import/export/software',
    icon: 'globe',
    color: 'cyan',
  },
]

export interface Wallet {
  id: string
  userId: string
  balance: number
  totalTopUp: number
  totalUsed: number
  bonusCredits: number
}

export interface TopUpTransaction {
  id: string
  amount: number
  credits: number
  bonusCredits: number
  status: 'pending' | 'paid' | 'failed' | 'expired'
  promptPayRef: string | null
  paymentMethod: string
  createdAt: string
  paidAt: string | null
  expiresAt: string | null
}

export interface Citation {
  id: string
  chunkId: string
  documentCode: string
  documentTitle: string
  sectionLabel: string
  pageStart: number
  relevance: number
  snippet: string
}

export interface SearchResult {
  queryId: string
  status: SearchStatus
  answer: string
  citations: Citation[]
  creditsUsed: number
  balance: number
  durationMs: number
  tokensUsed: number
}

export interface SearchQueryRecord {
  id: string
  query: string
  mode: SearchMode
  status: SearchStatus
  creditsUsed: number
  chunkCount: number
  citationsCount: number
  durationMs: number
  tokensUsed: number
  createdAt: string
  answer?: string
  citations?: Citation[]
}

export interface LawDocumentSummary {
  code: string
  title: string
  shortTitle: string | null
  type: string
  category: LawCategory
  categoryLabel: string
  source: string
  sourceUrl: string | null
  pdfFile: string | null
  pageCount: number
  chunkCount: number
  status: string
  effectiveDate: string | null
}

export interface DashboardStats {
  user: {
    id: string
    name: string | null
    email: string
    role: string
    company: string | null
  }
  wallet: Wallet | null
  stats: {
    totalDocuments: number
    totalChunks: number
    totalQueries: number
    queriesLast30: number
    queriesLast7: number
    totalTopUps: number
    accuracyRate: number
    creditsUsed30: number
  }
  recentQueries: Array<{
    id: string
    query: string
    mode: SearchMode
    status: SearchStatus
    creditsUsed: number
    chunkCount: number
    citationsCount: number
    durationMs: number
    createdAt: string
  }>
  queriesByMode: Array<{ mode: SearchMode; count: number; credits: number }>
  categories: LawDocumentSummary[]
  dailyUsage: Array<{ date: string; dateLabel: string; queries: number; credits: number }>
}

export interface PricingTier {
  mode: SearchMode
  name: string
  credits: number
  description: string
  features: string[]
  color: string
}

export const PRICING_TIERS: PricingTier[] = [
  {
    mode: 'basic',
    name: 'Basic Search',
    credits: 1,
    description: 'ค้นหามาตรา/ข้อหารือภาษี',
    features: ['Vector Search อย่างเดียว', 'แสดง 3 chunks ที่เกี่ยวข้อง', 'ไม่ใช้ LLM สรุปยาว'],
    color: 'emerald',
  },
  {
    mode: 'deep',
    name: 'Deep Analysis',
    credits: 5,
    description: 'AI อ่านกฎหมาย 3-5 ฉบับ สรุป+เปรียบเทียบมาตรา',
    features: ['วิเคราะห์ 8 chunks', 'สรุปคำตอบอัตโนมัติ', 'อ้างอิงมาตรา + หน้า PDF', 'เปรียบเทียบข้อกฎหมาย'],
    color: 'amber',
  },
  {
    mode: 'audit',
    name: 'Document Audit',
    credits: 10,
    description: 'อัปโหลดสัญญาตรวจสอบ Tax Compliance',
    features: ['ตรวจสอบ 15 chunks', 'เทียบกับประมวลรัษฎากร', 'หาความเสี่ยงทางภาษี', 'ออกรายงาน Compliance'],
    color: 'rose',
  },
]

export const TOPUP_PRESETS = [
  { amount: 100, bonus: 0, label: 'เริ่มต้น', bonusPct: 0 },
  { amount: 200, bonus: 10, label: 'มาตรฐาน', bonusPct: 5 },
  { amount: 500, bonus: 50, label: 'ยอดนิยม', bonusPct: 10 },
  { amount: 1000, bonus: 150, label: 'มืออาชีพ', bonusPct: 15 },
]
