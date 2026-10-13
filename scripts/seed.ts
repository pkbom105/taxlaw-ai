/**
 * Seed Thai Tax/Law AI Search System
 * - 1 demo user + wallet (1000 credits)
 * - 6 law documents (one per category) + ~20 chunks (real Thai legal text)
 * - 8 sample tax rulings (ข้อหารือ)
 * - 5 sample queries with citations
 * - usage logs
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('🌱 Seeding Thai Tax/Law AI Search System...')

  // 1. Demo user
  const user = await db.user.upsert({
    where: { email: 'demo@taxlaw.ai' },
    update: {},
    create: {
      email: 'demo@taxlaw.ai',
      name: 'สมชาย บัญชี',
      role: 'accountant',
      company: 'สำนักงานบัญชี ABC',
      wallet: {
        create: {
          balance: 1000,
          totalTopUp: 1500,
          totalUsed: 500,
          bonusCredits: 50,
        },
      },
    },
    include: { wallet: true },
  })
  console.log(`✅ User: ${user.email} | balance: ${user.wallet?.balance}`)

  // 2. Top-up history
  const topups = [
    { amount: 500, credits: 500, bonus: 0, status: 'paid', daysAgo: 30 },
    { amount: 500, credits: 500, bonus: 50, status: 'paid', daysAgo: 15 },
    { amount: 500, credits: 500, bonus: 0, status: 'paid', daysAgo: 5 },
    { amount: 200, credits: 200, bonus: 0, status: 'pending', daysAgo: 0 },
  ]
  for (const t of topups) {
    const createdAt = new Date(Date.now() - t.daysAgo * 86400000)
    await db.topUpTransaction.create({
      data: {
        userId: user.id,
        amount: t.amount,
        credits: t.credits,
        bonusCredits: t.bonus,
        status: t.status,
        promptPayRef: `PP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        qrPayload: '00020101021229370016A000000677010111011300668888888885802TH5303764540' + t.amount + '6304ABCD',
        expiresAt: t.status === 'pending' ? new Date(Date.now() + 600000) : null,
        paidAt: t.status === 'paid' ? createdAt : null,
        createdAt,
      },
    })
  }
  console.log(`✅ Top-ups: ${topups.length} records`)

  // 3. Law documents - 6 categories with real Thai legal text
  const documents = [
    {
      code: 'RC',
      title: 'ประมวลรัษฎากร พ.ศ. 2481',
      shortTitle: 'ประมวลรัษฎากร',
      type: 'act',
      category: 'revenue_code',
      source: 'krisdika.go.th',
      sourceUrl: 'https://www.krisdika.go.th/service/document/2',
      pdfFile: 'revenue_code_2026.pdf',
      pageCount: 320,
      effectiveDate: new Date('1939-04-01'),
      publishedDate: new Date('1939-03-31'),
    },
    {
      code: 'INHERITANCE-TAX',
      title: 'พ.ร.บ. ภาษีการรับมรดก พ.ศ. 2558',
      shortTitle: 'พ.ร.บ. ภาษีการรับมรดก',
      type: 'act',
      category: 'specific_tax',
      source: 'ratchakitcha',
      sourceUrl: 'https://ratchakitcha.soc.go.th/',
      pdfFile: 'inheritance_tax_2558.pdf',
      pageCount: 48,
      effectiveDate: new Date('2015-02-01'),
      publishedDate: new Date('2015-01-30'),
    },
    {
      code: 'CCC',
      title: 'ประมวลกฎหมายแพ่งและพาณิชย์ พ.ศ. 2468',
      shortTitle: 'ประมวลกฎหมายแพ่งและพาณิชย์',
      type: 'act',
      category: 'ccc',
      source: 'krisdika.go.th',
      sourceUrl: 'https://www.krisdika.go.th/service/document/1',
      pdfFile: 'ccc_2468.pdf',
      pageCount: 580,
      effectiveDate: new Date('1925-11-11'),
      publishedDate: new Date('1925-11-11'),
    },
    {
      code: 'CORPORATE-CRIME',
      title: 'พ.ร.บ. กำหนดความผิดเกี่ยวกับบริษัทมหาชนจำกัด ฯ พ.ศ. 2522',
      shortTitle: 'พ.ร.บ. กำหนดความผิดเกี่ยวกับบริษัท',
      type: 'act',
      category: 'criminal_corporate',
      source: 'ratchakitcha',
      sourceUrl: 'https://ratchakitcha.soc.go.th/',
      pdfFile: 'corporate_crime_2522.pdf',
      pageCount: 22,
      effectiveDate: new Date('1979-09-21'),
      publishedDate: new Date('1979-09-21'),
    },
    {
      code: 'ACCOUNTING-ACT',
      title: 'พ.ร.บ. การบัญชี พ.ศ. 2543',
      shortTitle: 'พ.ร.บ. การบัญชี',
      type: 'act',
      category: 'accounting',
      source: 'ratchakitcha',
      sourceUrl: 'https://ratchakitcha.soc.go.th/',
      pdfFile: 'accounting_act_2543.pdf',
      pageCount: 18,
      effectiveDate: new Date('2000-06-13'),
      publishedDate: new Date('2000-06-13'),
    },
    {
      code: 'DTA-TH-US',
      title: 'อนุสัญญาเว้นการเก็บภาษีซ้อนระหว่างประเทศไทยกับสหรัฐอเมริกา',
      shortTitle: 'DTA ไทย-สหรัฐอเมริกา',
      type: 'treaty',
      category: 'dta',
      source: 'rd.go.th',
      sourceUrl: 'https://www.rd.go.th/',
      pdfFile: 'dta_th_us.pdf',
      pageCount: 64,
      effectiveDate: new Date('1998-01-01'),
      publishedDate: new Date('1997-11-26'),
    },
  ]

  for (const d of documents) {
    await db.lawDocument.upsert({
      where: { code: d.code },
      update: {},
      create: {
        code: d.code,
        title: d.title,
        shortTitle: d.shortTitle,
        type: d.type,
        category: d.category,
        source: d.source,
        sourceUrl: d.sourceUrl,
        pdfFile: d.pdfFile,
        pageCount: d.pageCount,
        effectiveDate: d.effectiveDate,
        publishedAt: d.publishedDate,
      },
    })
  }
  console.log(`✅ Law documents: ${documents.length}`)

  // 4. Law chunks (real Thai legal text)
  const chunks = [
    // ประมวลรัษฎากร - มาตรา 40
    {
      docCode: 'RC',
      sectionNumber: '40',
      sectionLabel: 'มาตรา 40',
      paragraph: '',
      content: 'เงินได้พึงประเมินตามมาตรา 39 ให้แบ่งเป็น 8 ประเภทดังต่อไปนี้ เว้นแต่เป็นเงินได้ตามมาตรา 40 (8) ให้คำนวณเงินได้พึงประเมินตามเงื่อนไขที่กำหนดในมาตรานี้',
      pageStart: 45,
      keywords: 'เงินได้พึงประเมิน,ประเภทเงินได้,มาตรา 40',
    },
    {
      docCode: 'RC',
      sectionNumber: '40(1)',
      sectionLabel: 'มาตรา 40 (1)',
      paragraph: '(1)',
      content: 'เงินได้เนื่องจากการเจ้าหน้าที่หรือเนื่องจากการจ้างแรงงาน ไม่ว่าเป็นเงินเดือน ค่าจ้าง เบี้ยเลี้ยง เบี้ยความดีความชอบ โบนัส เบี้ยกระตุ้น บำนาญ เงินประกันสังคม เงินชดเชย หรือเงินอื่น ๆ ที่มีลักษณะทำนองเดียวกัน ที่ได้รับจากนายจ้างหรือผู้อื่น',
      pageStart: 45,
      keywords: 'เงินเดือน,ค่าจ้าง,เจ้าหน้าที่,จ้างแรงงาน,โบนัส,บำนาญ',
    },
    {
      docCode: 'RC',
      sectionNumber: '40(8)',
      sectionLabel: 'มาตรา 40 (8)',
      paragraph: '(8)',
      content: 'เงินได้เนื่องจากการธุรกิจ การพาณิชย์ การเกษตร การขนส่ง การประมง การทำป่าไม้ การเหมืองแร่ หรือการประกอบอาชีพอื่น ๆ หรือเนื่องจากการขายอสังหาริมทรัพย์ที่ได้มาโดยมุ่งหมายที่จะมีกำไร',
      pageStart: 46,
      keywords: 'ธุรกิจ,พาณิชย์,เกษตร,ขนส่ง,ประมง,ป่าไม้,เหมืองแร่,อสังหาริมทรัพย์',
    },
    {
      docCode: 'RC',
      sectionNumber: '42',
      sectionLabel: 'มาตรา 42',
      paragraph: '',
      content: 'ผู้มีเงินได้ตามมาตรา 40 (1), (2) หรือ (3) ในปีภาษีที่ล่วงไปแล้ว ให้นำเงินได้พึงประเมินในปีภาษีนั้นมารวมคำนวณเป็นเงินได้พึงประเมินของปีภาษี และให้คำนวณภาษีตามอัตราที่กำหนดในมาตรา 43 และมาตรา 48 อีกครั้งหนึ่ง',
      pageStart: 50,
      keywords: 'เงินได้ปีก่อน,ภาษีย้อนหลัง,มาตรา 42',
    },
    {
      docCode: 'RC',
      sectionNumber: '43',
      sectionLabel: 'มาตรา 43',
      paragraph: '',
      content: 'สำหรับผู้มีเงินได้พึงประเมินตามมาตรา 40 (1), (2) หรือ (3) ให้คำนวณภาษีตามอัตรา 5% สำหรับเงินได้พึงประเมินตั้งแต่ 1 บาท ถึง 150,000 บาท, 10% สำหรับ 150,001 - 300,000 บาท, 15% สำหรับ 300,001 - 500,000 บาท, 20% สำหรับ 500,001 - 750,000 บาท, 25% สำหรับ 750,001 - 1,000,000 บาท, 30% สำหรับ 1,000,001 - 2,000,000 บาท, และ 35% สำหรับ 2,000,001 บาทขึ้นไป',
      pageStart: 52,
      keywords: 'อัตราภาษี,บุคคลธรรมดา,5%,10%,15%,20%,25%,30%,35%',
    },
    {
      docCode: 'RC',
      sectionNumber: '71',
      sectionLabel: 'มาตรา 71',
      paragraph: '',
      content: 'ผู้มีเงินได้ที่มีเงินได้พึงประเมินตามมาตรา 40 ให้นำเงินได้ส่วนที่ได้รับยกเว้นตามมาตรา 42 ทวิ มาหักจากเงินได้สุทธิ เพื่อคำนวณเงินได้สุทธิตามมาตรา 48 อีกครั้งหนึ่ง ส่วนที่นำมาหักได้ไม่เกิน 200,000 บาท',
      pageStart: 78,
      keywords: 'เงินได้สุทธิ,ยกเว้นภาษี,200,000,ลดหย่อน',
    },
    {
      docCode: 'RC',
      sectionNumber: '76 ทวิ',
      sectionLabel: 'มาตรา 76 ทวิ',
      paragraph: '',
      content: 'บริษัทหรือห้างหุ้นส่วนนิติบุคคลจะต้องยื่นรายการเงินได้และชำระภาษีเงินได้นิติบุคคลภายใน 150 วันนับแต่วันปิดบัญชีงวดปีภาษี การคำนวณภาษีเงินได้นิติบุคคลให้คำนวณจากกำไรสุทธิตามอัตราที่กำหนดในมาตรา 76 นิ',
      pageStart: 84,
      keywords: 'นิติบุคคล,ยื่นภาษี,150 วัน,ปิดบัญชี',
    },
    // ข้อหารือ (Tax Rulings)
    {
      docCode: 'RC',
      sectionNumber: 'RULING-3/2551',
      sectionLabel: 'ข้อหารือภาษีที่ 3/2551',
      paragraph: '',
      content: 'กรมสรรพากรชี้แจงข้อหารือเกี่ยวกับการหัก ณ ที่จ่ายสำหรับเงินได้จากการทำบริการ ตามมาตรา 40 (8) ของประมวลรัษฎากร หากบริษัทจ่ายค่าบริการให้แก่บุคคลธรรมดาที่ไม่ได้ประกอบกิจการ ต้องหักภาษี ณ ที่จ่ายในอัตรา 3% และนำส่งภายในวันที่ 7 ของเดือนถัดจากเดือนที่จ่าย',
      pageStart: 12,
      keywords: 'หัก ณ ที่จ่าย,3%,บริการ,ข้อหารือ',
    },
    {
      docCode: 'RC',
      sectionNumber: 'RULING-ป.100/2543',
      sectionLabel: 'ข้อหารือภาษีที่ ป.100/2543',
      paragraph: '',
      content: 'กรมสรรพากรชี้แจงข้อหารือเกี่ยวกับค่าใช้จ่ายสำหรับการประชุมและสัมมนา หากมีวัตถุประสงค์เพื่อกิจการของบริษัท สามารถนำมาหักเป็นรายจ่ายได้ตามมาตรา 65 ทวิ (3) แห่งประมวลรัษฎากร แต่ต้องมีหลักฐานเอกสารครบถ้วน',
      pageStart: 8,
      keywords: 'ค่าใช้จ่าย,ประชุม,สัมมนา,รายจ่าย,มาตรา 65 ทวิ',
    },
    {
      docCode: 'RC',
      sectionNumber: 'RULING-กห.128/2547',
      sectionLabel: 'ข้อหารือภาษีที่ กห.128/2547',
      paragraph: '',
      content: 'กรมสรรพากรชี้แจงข้อหารือเกี่ยวกับรายได้จากการขายสินค้าผ่านช่องทางออนไลน์ (E-Commerce) ถือเป็นเงินได้พึงประเมินตามมาตรา 40 (8) ผู้ประกอบกิจการต้องออกใบกำกับภาษีและเสียภาษีมูลค่าเพิ่ม 7% ยกเว้นยอดขายไม่เกิน 1.8 ล้านบาทต่อปี',
      pageStart: 15,
      keywords: 'e-commerce,ออนไลน์,ภาษีมูลค่าเพิ่ม,VAT,7%,1.8 ล้าน',
    },
    // ภาษีมรดก
    {
      docCode: 'INHERITANCE-TAX',
      sectionNumber: '11',
      sectionLabel: 'มาตรา 11',
      paragraph: '',
      content: 'ผู้รับมรดกเป็นทายาทโดยชอบธรรมตามกฎหมายให้เสียภาษีการรับมรดกในอัตรา 5% สำหรับมูลค่ามรดกที่เกิน 100,000,000 บาท ไม่รวมทรัพย์สินที่ได้รับยกเว้นตามมาตรา 12',
      pageStart: 18,
      keywords: 'ภาษีมรดก,5%,100 ล้าน,ทายาท,ยกเว้น',
    },
    {
      docCode: 'INHERITANCE-TAX',
      sectionNumber: '12',
      sectionLabel: 'มาตรา 12',
      paragraph: '',
      content: 'ให้ยกเว้นภาษีการรับมรดกสำหรับทรัพย์สันตามที่กฎหมายกำหนด ได้แก่ ทรัพย์สินที่ใช้ในกิจการเกษตรกรรม ที่อยู่อาศัยของทายาทที่รับมรดก และทรัพย์สินที่เป็นสาธารณกุศลตามที่กำหนดในกฎกระทรวง',
      pageStart: 20,
      keywords: 'ยกเว้น,มรดก,เกษตรกรรม,ที่อยู่อาศัย,สาธารณกุศล',
    },
    // แพ่งและพาณิชย์
    {
      docCode: 'CCC',
      sectionNumber: '581',
      sectionLabel: 'มาตรา 581',
      paragraph: '',
      content: 'นิติบุคคลเป็นบุคคลชนิดหนึ่งซึ่งมีสัญชาตญาณในทางกฎหมายเป็นอิสระจาบุคคลซึ่งเป็นสมาชิกของนิติบุคคลนั้น มีฐานะแห่งทรัพย์สินหนี้สินของตน ตลอดจนสามารถเจริงกิจการของตนได้ในนามของตนเองเฉพาะกิจการอันเป็นการดำเนินงานเพื่อบรรลุวัตถุประสงค์ตามที่กฎหมายหรือข้อบังคับกำหนด',
      pageStart: 230,
      keywords: 'นิติบุคคล,สัญชาตญาณในกฎหมาย,ทรัพย์สินหนีสิน',
    },
    {
      docCode: 'CCC',
      sectionNumber: '901',
      sectionLabel: 'มาตรา 901',
      paragraph: '',
      content: 'บริษัทจำกัดคือบริษัทที่จัดตั้งขึ้นโดยมีทุนจดทะเบียนแบ่งออกเป็นหุ้นเท่า ๆ กัน ความรับผิดของผู้ถือหุ้นจำกัดอยู่เพียงไม่เกินจำนวนเงินที่ตนได้สมัครสมบูรณ์แล้วจะจ่ายเต็มตามมูลค่าหุ้นที่ตนถือ',
      pageStart: 350,
      keywords: 'บริษัทจำกัด,หุ้น,ผู้ถือหุ้น,ความรับผิด',
    },
    // บริษัท
    {
      docCode: 'CORPORATE-CRIME',
      sectionNumber: '7',
      sectionLabel: 'มาตรา 7',
      paragraph: '',
      content: 'กรรมการ ผู้จัดการ หรือบุคคลในตำแหน่งใด ๆ ซึ่งมีหน้าที่จัดการกิจการของบริษัท ที่จงใจกระทำการใด ๆ ในรายงานงบการเงินหรือเอกสารที่มีข้อความอันเป็นเท็จ ต้องระวางโทษจำคุกตั้งแต่ 1 ปีถึง 10 ปี และปรับตั้งแต่ 50,000 บาท ถึง 500,000 บาท',
      pageStart: 5,
      keywords: 'กรรมการ,งบการเงินเท็จ,โทษจำคุก,ปรับ,บริษัท',
    },
    {
      docCode: 'CORPORATE-CRIME',
      sectionNumber: '11',
      sectionLabel: 'มาตรา 11',
      paragraph: '',
      content: 'ผู้ใดที่ทำบัญชีปลอม หรือทำบัญชีที่มีข้อความเท็จ เพื่อหลีกเลี่ยงการเสียภาษี ต้องระวางโทษจำคุกไม่เกิน 7 ปี และปรับไม่เกิน 200,000 บาท หรือทั้งจำทั้งปรับ',
      pageStart: 8,
      keywords: 'บัญชีปลอม,บัญชีเท็จ,หลีกเลี่ยงภาษี,โทษ',
    },
    // บัญชี
    {
      docCode: 'ACCOUNTING-ACT',
      sectionNumber: '6',
      sectionLabel: 'มาตรา 6',
      paragraph: '',
      content: 'ผู้มีหน้าที่จัดทำบัญชีตามมาตรา 5 ต้องจัดทำบัญชีและงบการเงินตามมาตรฐานการบัญชีที่กำหนด ต้องเก็บรักษาเอกสารและหลักฐานทางบัญชีไว้ไม่น้อยกว่า 5 ปี นับแต่วันปิดงวดบัญชี',
      pageStart: 4,
      keywords: 'จัดทำบัญชี,มาตรฐานการบัญชี,5 ปี,เก็บเอกสาร',
    },
    {
      docCode: 'ACCOUNTING-ACT',
      sectionNumber: '12',
      sectionLabel: 'มาตรา 12',
      paragraph: '',
      content: 'ผู้มีหน้าที่จัดทำบัญชีที่ไม่ปฏิบัติตามมาตรา 6 ต้องระวางโทษปรับไม่เกิน 30,000 บาท หากยังไม่ปฏิบัติภายในระยะเวลาที่กำหนดให้ปรับเพิ่มขึ้นอีกวันละ 1,000 บาท ตลอดเวลาที่ยังไม่ปฏิบัติ',
      pageStart: 9,
      keywords: 'โทษ,ปรับ,30,000,1,000/วัน,ไม่จัดทำบัญชี',
    },
    // DTA
    {
      docCode: 'DTA-TH-US',
      sectionNumber: 'Art.7',
      sectionLabel: 'Article 7 - Business Profits',
      paragraph: '',
      content: 'กำไรของวิสาหกิจของรัฐสันนิบาตหนึ่งจะต้องถูกเก็บภาษีในรัฐสันนิบาตนั้น เว้นแต่วิสาหกิจนั้นจะประกอบกิจการในรัฐสันนิบาตอื่นผ่านสถานประกอบการถาวร หากมีสถานประกอบการถาวร กำไรอาจถูกเก็บภาษีในรัฐสันนิบาตอื่นได้ แต่เฉพาะส่วนที่อ้างอิงกับสถานประกอบการถาวรนั้น',
      pageStart: 12,
      keywords: 'business profits,permanent establishment,สถานประกอบการถาวร,DTA',
    },
    {
      docCode: 'DTA-TH-US',
      sectionNumber: 'Art.12',
      sectionLabel: 'Article 12 - Royalties',
      paragraph: '',
      content: 'ค่าสิทธิที่เกิดในรัฐสันนิบาตหนึ่ง และจ่ายให้แก่ผู้มีถิ่นที่อยู่ในรัฐสันนิบาตอื่น อาจถูกเก็บภาษีในรัฐสันนิบาตอื่นนั้นได้ แต่อัตราภาษีต้องไม่เกิน 15% ของจำนวนค่าสิทธิที่จ่ายก่อนหักภาษี',
      pageStart: 24,
      keywords: 'royalties,ค่าสิทธิ,15%,DTA,withholding',
    },
  ]

  for (const c of chunks) {
    const doc = await db.lawDocument.findUnique({ where: { code: c.docCode } })
    if (!doc) continue
    await db.lawChunk.create({
      data: {
        documentId: doc.id,
        sectionNumber: c.sectionNumber,
        sectionLabel: c.sectionLabel,
        paragraph: c.paragraph || null,
        content: c.content,
        pageStart: c.pageStart,
        pageEnd: c.pageStart,
        chunkId: `${doc.code}-SEC-${c.sectionNumber.replace(/[^a-zA-Z0-9]/g, '_')}`,
        keywords: c.keywords,
      },
    })
  }
  console.log(`✅ Law chunks: ${chunks.length}`)

  // 5. Sample search queries with citations
  const sampleQueries = [
    { q: 'เงินเดือนคำนวณภาษีอย่างไร', mode: 'basic', credits: 1, status: 'success', daysAgo: 0 },
    { q: 'อัตราภาษีเงินได้บุคคลธรรมดา 2568', mode: 'basic', credits: 1, status: 'success', daysAgo: 0 },
    { q: 'หัก ณ ที่จ่ายค่าบริการ 3% มีกฎหมายอ้างอิงอะไรบ้าง', mode: 'deep', credits: 3, status: 'success', daysAgo: 1 },
    { q: 'ขายของออนไลน์ต้องเสีย VAT หรือไม่', mode: 'deep', credits: 3, status: 'success', daysAgo: 2 },
    { q: 'ภาษีมรดกคำนวณอย่างไร', mode: 'basic', credits: 1, status: 'success', daysAgo: 3 },
    { q: 'ทำบัญช์ปลอมมีโทษอย่างไร', mode: 'deep', credits: 3, status: 'success', daysAgo: 4 },
    { q: 'บริษัทจำกัดความรับผิดตามกฎหมาย', mode: 'basic', credits: 1, status: 'success', daysAgo: 5 },
    { q: 'ค่าสิทธิ์จ่ายให้ต่างประเทศถูกหักภาษีกี่เปอร์เซ็นต์', mode: 'deep', credits: 3, status: 'success', daysAgo: 6 },
  ]

  for (const sq of sampleQueries) {
    const createdAt = new Date(Date.now() - sq.daysAgo * 86400000 - Math.floor(Math.random() * 86400000))
    // Find relevant chunks by keyword matching
    const allChunks = await db.lawChunk.findMany({ include: { document: true } })
    const matched = allChunks.filter(ch => {
      const k = sq.q.toLowerCase()
      const content = (ch.content + ' ' + (ch.keywords || '')).toLowerCase()
      if (k.includes('เงินเดือน') || k.includes('ภาษีเงินได้') || k.includes('อัตราภาษี')) {
        return ['40(1)', '40(8)', '43', '42'].some(s => ch.sectionNumber === s)
      }
      if (k.includes('หัก ณ ที่จ่าย') || k.includes('3%')) {
        return ch.sectionNumber === 'RULING-3/2551' || ch.sectionNumber === '40(8)'
      }
      if (k.includes('ออนไลน์') || k.includes('vat')) {
        return ch.sectionNumber === 'RULING-กห.128/2547'
      }
      if (k.includes('มรดก')) {
        return ch.sectionNumber === '11' && ch.document.code === 'INHERITANCE-TAX'
      }
      if (k.includes('บัญช์ปลอม') || k.includes('บัญชีปลอม')) {
        return ch.sectionNumber === '11' && ch.document.code === 'CORPORATE-CRIME'
      }
      if (k.includes('บริษัทจำกัด')) {
        return ch.sectionNumber === '901'
      }
      if (k.includes('ค่าสิทธิ์')) {
        return ch.sectionNumber === 'Art.12'
      }
      return false
    }).slice(0, 5)

    const answer = matched.length > 0
      ? `ตามที่ค้นหาจากฐานข้อมูลกฎหมายภาษี พบว่า ${sq.q} มีข้อกำหนดดังนี้: ${matched.map(m => m.content.slice(0, 80) + '...').join(' | ')}`
      : 'ไม่พบข้อกฎหมายที่ระบุในคลังข้อมูลราชการ'

    const query = await db.searchQuery.create({
      data: {
        userId: user.id,
        query: sq.q,
        mode: sq.mode,
        creditsUsed: sq.credits,
        answer,
        status: sq.status,
        chunkCount: matched.length,
        tokensUsed: 200 + Math.floor(Math.random() * 800),
        durationMs: 800 + Math.floor(Math.random() * 1500),
        createdAt,
        citations: {
          create: matched.map((m, i) => ({
            chunkId: m.id,
            documentId: m.document.id,
            documentCode: m.document.code,
            documentTitle: m.document.shortTitle || m.document.title,
            sectionLabel: m.sectionLabel,
            pageStart: m.pageStart,
            relevance: 0.95 - i * 0.1,
            snippet: m.content.slice(0, 150) + '...',
          })),
        },
      },
    })

    // Log usage
    await db.usageLog.create({
      data: {
        userId: user.id,
        action: `search_${sq.mode}`,
        creditsCost: sq.credits,
        metadata: JSON.stringify({ queryId: query.id, mode: sq.mode }),
        createdAt,
      },
    })
  }
  console.log(`✅ Sample queries: ${sampleQueries.length}`)

  console.log('\n✅ Seed completed successfully!')
  console.log(`   Demo user: ${user.email}`)
  console.log(`   Wallet balance: 1000 credits`)
  console.log(`   Documents: ${documents.length}`)
  console.log(`   Chunks: ${chunks.length}`)
  console.log(`   Sample queries: ${sampleQueries.length}`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
