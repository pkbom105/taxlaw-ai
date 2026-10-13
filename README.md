# TaxLaw AI — ระบบค้นหากฎหมายภาษีไทย (Zero-Hallucination RAG)

ระบบ AI ค้นหากฎหมายและประมวลรัษฎากรไทย สำหรับนักบัญชี ทนายความ และ SME
ใช้เทคนิค RAG (Retrieval-Augmented Generation) ป้องกัน AI มโนมาตรา — อ้างอิงแหล่งที่มา 100%

## 🛡️ หลักการ Zero-Hallucination

1. **Citation & Source Link** — ทุกคำตอบมีเลขมาตรา + หน้า PDF
2. **Chunking ตามโครงสร้างกฎหมาย** — ตัดตาม มาตรา/ข้อ/วรรค ไม่สุ่ม
3. **Strict Prompting** — ห้ามใช้ความรู้ภายนอก หากไม่พบใน Context ตอบว่า "ไม่พบข้อมูล"

## 🏗️ Tech Stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **UI:** Tailwind CSS 4 + shadcn/ui (New York)
- **Database:** SQLite + Prisma ORM
- **Icons:** Lucide React
- **State:** React hooks + TanStack Query

## 📋 ฟีเจอร์

### 1. Dashboard
- สถิติการใช้งาน 4 การ์ด (เครดิต, คลังกฎหมาย, การค้นหา, ความแม่นยำ)
- กราฟการใช้งาน 30 วัน + สัดส่วนโหมด
- คำค้นล่าสุด + ภาพรวมคลังกฎหมาย 6 หมวด

### 2. AI Search (3 โหมด)
- **Basic Search** (1 credit) — ค้นหามาตรา ดึง 3 chunks
- **Deep Analysis** (5 credits) — อ่านกฎหมาย 3-5 ฉบับ สรุป+เปรียบเทียบ
- **Document Audit** (10 credits) — อัปโหลดเอกสารตรวจสอบ Tax Compliance

### 3. Profile
- แก้ไขข้อมูลส่วนตัว (ชื่อ, บริษัท, ประเภทผู้ใช้)
- Tier system: Silver → Gold → Platinum → Diamond
- สถิติการใช้งาน + ประวัติ Wallet

### 4. Upload
- อัปโหลดไฟล์ตรวจสอบ Tax Compliance (PDF/DOCX/TXT/JPG/PNG)
- เพิ่มเอกสารกฎหมายใหม่เข้าคลัง (admin)
- ประวัติการตรวจสอบ

### 5. Documents (แยกหมวด)
- 6 หมวดหลัก: ประมวลรัษฎากร, ภาษีเฉพาะด้าน, แพ่งฯ, อาญา/บริษัท, บัญชี, DTA
- Filter + Search + Expand ดู chunks แต่ละมาตรา

### 6. Credit Wallet + PromptPay
- เติมเครดิตผ่าน PromptPay Dynamic QR (จำลอง)
- โบนัส 5-15% ตามยอดเติม
- 1 บาท = 1 ครดิต

## 🚀 Getting Started

```bash
# ติดตั้ง dependencies
bun install

# ตั้งค่า environment
echo "DATABASE_URL=file:/home/z/my-project/db/custom.db" > .env

# สร้าง database
bun run db:push

# Seed ข้อมูลตัวอย่าง
bun run scripts/seed.ts

# เริ่ม dev server
bun run dev
```

เปิด http://localhost:3000 — login ด้วย `demo@taxlaw.ai` (มี 1000 credits เริ่มต้น)

## 📁 โครงสร้างโปรเจกต์

```
prisma/
  schema.prisma          # 8 models: User, Wallet, TopUp, LawDocument, LawChunk, SearchQuery, QueryCitation, UsageLog
scripts/
  seed.ts                # Seed กฎหมาย 6 หมวด + 20 chunks + sample queries
src/
  app/
    api/                 # 8 API routes
      stats/             # Dashboard overview
      search/            # Zero-Hallucination RAG
      wallet/            # Wallet + transactions
      topup/             # PromptPay QR
      documents/         # Law document listing
      queries/           # Search history
      profile/           # User profile
      upload/            # Document upload
    page.tsx             # Main layout (sidebar + views)
  components/
    layout/              # Sidebar, Header, MobileNav
    views/               # Dashboard, Profile, Upload, Documents
    dashboard/           # Stats cards, charts
    search/              # Search panel + citations
    wallet/              # Top-up modal
  lib/
    db.ts                # Prisma client
    types.ts             # Shared types + CATEGORY_META + PRICING_TIERS
```

## 📊 คลังกฎหมาย 6 หมวด

| หมวด | ตัวย่อ | ตัวอย่างกฎหมาย | แหล่งที่มา |
|------|-------|---------------|----------|
| ประมวลรัษฎากร | RC | มาตรา 40, 42, 43, 71, 76 ทวิ + ข้อหารือ | krisdika.go.th |
| ภาษีเฉพาะด้าน | ST | ภาษีมรดก มาตรา 11, 12 | ratchakitcha |
| ประมวลกฎหมายแพ่งฯ | CCC | มาตรา 581, 901 (นิติบุคคล/บริษัทจำกัด) | krisdika.go.th |
| อาญา/บริษัท | CR | มาตรา 7, 11 (โทษบัญชีปลอม) | ratchakitcha |
| กฎหมายบัญชี | ACC | พ.ร.บ. การบัญชี 2543 | ratchakitcha |
| สนธิสัญญาภาษีซ้อน | DTA | DTA ไทย-สหรัฐ (Art. 7, 12) | rd.go.th |

## 💰 โมเดลราคา

| โหมด | ราคา | คำอธิบาย |
|------|------|---------|
| Basic Search | 1 cr | ค้นหา Vector Search อย่างเดียว |
| Deep Analysis | 5 cr | AI สรุป+เปรียบเทียบมาตรา |
| Document Audit | 10 cr | อัปโหลดเอกสารตรวจสอบ Compliance |

**ต้นทุนจริง:** 0.10-0.30 บาท/คำถาม · **ราคาขาย:** 1-10 บาท · **กำไร:** 80%+

## 🔐 Security Notes

- ไฟล์ `.env` และ `db/*.db` ถูก ignore ใน `.gitignore`
- ใช้ NextAuth.js สำหรับ authentication (ในอนาคต)
- PromptPay ใช้ sandbox mode — ต้องเชื่อม API จริงก่อน production

## 🗺️ Roadmap

- [ ] Vector Search จริง (sqlite-vss หรือ pgvector)
- [ ] PDF parser สำหรับดึงกฎหมายจริงจาก rd.go.th
- [ ] NextAuth.js multi-user
- [ ] PromptPay API จริง (GBPrimePay/Omise)
- [ ] Export PDF/CSV สำหรับผลการตรวจสอบ
- [ ] Cron job ดึง PDF ใหม่จากเว็บราชการ

## 📝 License

MIT
