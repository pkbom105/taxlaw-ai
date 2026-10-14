'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Upload, FileText, FileCheck2, Loader2, ShieldCheck, AlertTriangle, Coins,
  FileUp, FileSearch, CheckCircle2, Clock, X, Sparkles, FileWarning, Scale, Quote
} from 'lucide-react'
import { toast } from 'sonner'
import { useAppState } from '@/lib/app-state'
import { formatThaiDateTime, formatThaiDateFromInput } from '@/lib/thai-date'

interface AuditResult {
  uploadId: string
  status: string
  fileName: string
  fileSize: number
  fileType: string
  category: string
  description: string
  creditsUsed: number
  balance: number
  auditResult: {
    queryId: string
    answer: string
    matchedCount: number
    citations: Array<{
      id: string
      documentCode: string
      documentTitle: string
      sectionLabel: string
      pageStart: number
      relevance: number
      snippet: string
    }>
  }
}

interface HistoryItem {
  id: string
  fileName: string
  description: string
  status: string
  creditsUsed: number
  matchedCount: number
  durationMs: number
  createdAt: string
  citationsCount: number
}

interface Props {
  balance: number
  onTopUpNeeded: () => void
  onCreditsChange: (newBalance: number) => void
}

const AUDIT_COST = 10
const ACCEPTED_TYPES = ['.pdf', '.docx', '.doc', '.txt', '.jpg', '.png']
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const LAW_ACCEPTED_TYPES = ['.pdf', '.docx', '.doc', '.txt', '.md']
const MAX_AI_SIZE = 4 * 1024 * 1024 // 4 MB — เพดานสำหรับส่งไฟล์ให้ AI วิเคราะห์

interface LawAiResult {
  used: boolean
  provider: string | null
  protocol: string | null
  category: string
  categoryLabel: string
  type: string
  shortTitle: string | null
  summary: string | null
  sections: number
  tokens: number
  creditsUsed: number
  providerCredits: number | null
  skippedReason?: string
  textLength: number
}

export function UploadView({ balance, onTopUpNeeded, onCreditsChange }: Props) {
  const { categories, options } = useAppState()
  const [tab, setTab] = React.useState<'audit' | 'law_doc' | 'history'>('audit')
  const [file, setFile] = React.useState<File | null>(null)
  const [dragOver, setDragOver] = React.useState(false)
  const [category, setCategory] = React.useState<string>('revenue_code')
  const [description, setDescription] = React.useState('')
  const [uploading, setUploading] = React.useState(false)
  const [result, setResult] = React.useState<AuditResult | null>(null)
  const [history, setHistory] = React.useState<HistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = React.useState(false)

  // Law doc form
  const [lawTitle, setLawTitle] = React.useState('')
  const [lawUrl, setLawUrl] = React.useState('')
  const [lawEdition, setLawEdition] = React.useState('')
  const [lawStatus, setLawStatus] = React.useState('in_force')
  const [lawPublishedAt, setLawPublishedAt] = React.useState('')
  const [lawFile, setLawFile] = React.useState<File | null>(null)
  const [lawDragOver, setLawDragOver] = React.useState(false)
  const [lawUploading, setLawUploading] = React.useState(false)
  const [lawText, setLawText] = React.useState('')
  const [lawCategory, setLawCategory] = React.useState('auto')
  const [lawResult, setLawResult] = React.useState<LawAiResult | null>(null)

  React.useEffect(() => {
    if (tab === 'history') loadHistory()
  }, [tab])

  async function loadHistory() {
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/upload')
      const json = await res.json()
      setHistory(json.uploads || [])
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false)
    }
  }

  function handleFileDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFileSelect(f)
  }

  function handleFileSelect(f: File) {
    if (f.size > MAX_SIZE) {
      toast.error(`ไฟล์ใหญ่เกิน 10 MB (ขนาดปัจจุบัน ${(f.size / 1024 / 1024).toFixed(1)} MB)`)
      return
    }
    const ext = '.' + f.name.split('.').pop()?.toLowerCase()
    if (!ACCEPTED_TYPES.includes(ext)) {
      toast.error(`รองรับเฉพาะ ${ACCEPTED_TYPES.join(', ')}`)
      return
    }
    setFile(f)
    setResult(null)
  }

  function handleLawFileDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setLawDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) {
      if (f.size > MAX_SIZE) {
        toast.error('ไฟล์ใหญ่เกิน 10 MB')
        return
      }
      const ext = '.' + (f.name.split('.').pop() || '').toLowerCase()
      if (!LAW_ACCEPTED_TYPES.includes(ext)) {
        toast.error(`รองรับ ${LAW_ACCEPTED_TYPES.join(', ')}`)
        return
      }
      setLawFile(f)
      setLawResult(null)
    }
  }

  // อ่านไฟล์เป็น base64 เพื่อส่งให้เซิร์ฟเวอร์สกัดข้อความ (PDF/DOCX/TXT)
  function readFileAsBase64(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = String(reader.result || '')
        resolve(result.includes(',') ? result.split(',')[1] : result)
      }
      reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'))
      reader.readAsDataURL(f)
    })
  }

  async function handleAuditUpload() {
    if (!file) {
      toast.error('กรุณาเลือกไฟล์ก่อน')
      return
    }
    if (balance < AUDIT_COST) {
      toast.error(`เครดิตไม่พอ ต้องการ ${AUDIT_COST} ครีดิต คงเหลือ ${balance}`)
      onTopUpNeeded()
      return
    }

    setUploading(true)
    setResult(null)
    try {
      // In a real app, we'd upload to S3/storage first; here we just register the metadata
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          category,
          description,
          uploadType: 'audit',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'INSUFFICIENT_CREDITS') {
          toast.error(data.message)
          onTopUpNeeded()
          return
        }
        throw new Error(data.error)
      }
      setResult(data)
      onCreditsChange(data.balance)
      toast.success(`ตรวจสอบสำเร็จ พบ ${data.auditResult.matchedCount} มาตราที่เกี่ยวข้อง`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'อัปโหลดไม่สำเร็จ')
    } finally {
      setUploading(false)
    }
  }

  async function handleLawDocUpload() {
    if (!lawFile && !lawText.trim()) {
      toast.error('กรุณาเลือกไฟล์ หรือวางข้อความกฎหมาย')
      return
    }
    if (!lawTitle.trim()) {
      toast.error('กรุณาระบุชื่อกฎหมาย')
      return
    }
    if (lawFile && lawFile.size > MAX_AI_SIZE) {
      toast.error('ไฟล์ใหญ่เกิน 4 MB สำหรับให้ AI วิเคราะห์ — กรุณาวางข้อความแทน')
      return
    }

    setLawUploading(true)
    setLawResult(null)
    try {
      let fileBase64: string | undefined
      if (lawFile) {
        try {
          fileBase64 = await readFileAsBase64(lawFile)
        } catch {
          toast.error('อ่านไฟล์ไม่สำเร็จ')
          return
        }
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: lawFile?.name ?? 'pasted-law-text.txt',
          fileSize: lawFile?.size ?? lawText.trim().length,
          fileType: lawFile?.type || 'text/plain',
          uploadType: 'law_doc',
          lawTitle,
          sourceUrl: lawUrl.trim() || undefined,
          edition: lawEdition.trim() || undefined,
          status: lawStatus,
          publishedAt: lawPublishedAt || undefined,
          category: lawCategory === 'auto' ? undefined : lawCategory,
          content: lawText.trim() || undefined,
          fileBase64,
          autoClassify: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setLawResult(data.ai ?? null)
      if (typeof data.balance === 'number') onCreditsChange(data.balance)
      toast.success(data.message || 'เพิ่มเอกสารกฎหมายสำเร็จ')

      setLawFile(null)
      setLawText('')
      setLawTitle('')
      setLawUrl('')
      setLawEdition('')
      setLawStatus('in_force')
      setLawPublishedAt('')
      setLawCategory('auto')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'อัปโหลดไม่สำเร็จ')
    } finally {
      setLawUploading(false)
    }
  }

  function resetAudit() {
    setFile(null)
    setResult(null)
    setDescription('')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight">อัปโหลดเอกสาร</h1>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900">
            <FileUp className="h-3 w-3 mr-1" />
            2 โหมดการใช้งาน
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
          อัปโหลดสัญญา/เอกสารทางภาษีเพื่อตรวจสอบ Tax Compliance หรือเพิ่มเอกสารกฎหมายใหม่เข้าคลังข้อมูล
          ระบบจะเปรียบเทียบเนื้อหากับประมวลรัษฎากรและกฎหมายที่เกี่ยวข้อง พร้อมอ้างอิงมาตราที่ตรงกัน
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="audit" className="text-xs sm:text-sm">
            <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
            ตรวจสอบเอกสาร
          </TabsTrigger>
          <TabsTrigger value="law_doc" className="text-xs sm:text-sm">
            <Scale className="h-3.5 w-3.5 mr-1.5" />
            เพิ่มกฎหมายใหม่
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs sm:text-sm">
            <Clock className="h-3.5 w-3.5 mr-1.5" />
            ประวัติ ({history.length})
          </TabsTrigger>
        </TabsList>

        {/* AUDIT TAB */}
        <TabsContent value="audit" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileSearch className="h-4 w-4 text-amber-600" />
                    อัปโหลดไฟล์เพื่อตรวจสอบ
                  </CardTitle>
                  <CardDescription>
                    รองรับ PDF, DOCX, TXT, JPG, PNG · ขนาดไม่เกิน 10 MB · ใช้ {AUDIT_COST} ครีดิตต่อครั้ง
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Drop zone */}
                  {!file ? (
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleFileDrop}
                      onClick={() => document.getElementById('audit-file-input')?.click()}
                      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                        dragOver ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : 'border-border hover:border-amber-400 hover:bg-muted/40'
                      }`}
                    >
                      <input
                        id="audit-file-input"
                        type="file"
                        accept={ACCEPTED_TYPES.join(',')}
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
                      />
                      <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                      <div className="text-sm font-medium">ลากไฟล์มาวาง หรือคลิกเพื่อเลือก</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        PDF, DOCX, TXT, JPG, PNG · สูงสุด 10 MB
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-emerald-300 dark:border-emerald-800 rounded-lg p-4 bg-emerald-50/50 dark:bg-emerald-950/20">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-white dark:bg-background">
                          <FileText className="h-6 w-6 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{file.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(1)} KB · {file.type || 'ไม่ระบุประเภท'}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Category select */}
                  <div className="space-y-2">
                    <Label className="text-xs">หมวดกฎหมายที่จะตรวจสอบ</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label} ({c.short})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="audit-desc" className="text-xs">คำอธิบายเอกสาร (ไม่บังคับ)</Label>
                    <Textarea
                      id="audit-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="เช่น: สัญญาจ้างเหมาบริการ บริษัท ABC กับ XYZ จำกัด"
                      className="min-h-[80px] text-sm"
                    />
                  </div>

                  {/* Cost warning */}
                  <div className="flex items-center justify-between p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                    <div className="flex items-center gap-2 text-sm">
                      <Coins className="h-4 w-4 text-amber-600" />
                      <span className="text-amber-700 dark:text-amber-400">ใช้ {AUDIT_COST} ครีดิต</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      คงเหลือ {balance} cr {balance < AUDIT_COST && <span className="text-rose-600">· ไม่พอ</span>}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="border-t bg-muted/20 gap-2 justify-end">
                  <Button variant="outline" onClick={resetAudit} disabled={!file || uploading}>ล้าง</Button>
                  <Button
                    onClick={handleAuditUpload}
                    disabled={!file || uploading || balance < AUDIT_COST}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        กำลังตรวจสอบ...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4 mr-2" />
                        ตรวจสอบ Tax Compliance ({AUDIT_COST} cr)
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>

              {/* Result */}
              {result && (
                <Card className="border-emerald-300 dark:border-emerald-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ผลการตรวจสอบ
                    </CardTitle>
                    <CardDescription>
                      ไฟล์: {result.fileName} · ใช้ {result.creditsUsed} ครีดิต · พบ {result.auditResult.matchedCount} มาตราที่เกี่ยวข้อง
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs flex items-start gap-2">
                      <FileWarning className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-amber-700 dark:text-amber-400">คำเตือน:</strong>{' '}
                        ผลการตรวจสอบนี้เป็นการค้นหาเบื้องต้นจากคลังกฎหมาย ไม่ใช่ความเห็นทางกฎหมาย
                        ควรปรึกษาที่ปรึกษาภาษีหรือทนายความก่อนตัดสินใจ
                      </div>
                    </div>

                    <div className="ai-answer p-3 rounded-md bg-muted/40 text-sm whitespace-pre-wrap">
                      {result.auditResult.answer}
                    </div>

                    <Separator />

                    <div>
                      <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
                        <Quote className="h-3 w-3" />
                        มาตราที่ควรตรวจสอบ ({result.auditResult.citations.length})
                      </div>
                      <ScrollArea className="max-h-72 scrollbar-thin pr-2">
                        <div className="space-y-2">
                          {result.auditResult.citations.map((c, i) => (
                            <div key={c.id} className="p-3 rounded-md border border-border/60 bg-background hover:bg-muted/40 transition-colors">
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-muted-foreground">#{i + 1}</span>
                                  <Badge variant="secondary" className="text-[10px]">{c.documentCode}</Badge>
                                  <span className="text-sm font-semibold">{c.sectionLabel}</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs">
                                  <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500" style={{ width: `${c.relevance * 100}%` }} />
                                  </div>
                                  <span className="text-muted-foreground">{(c.relevance * 100).toFixed(0)}%</span>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2">{c.snippet}</p>
                              <div className="text-[10px] text-muted-foreground mt-1.5">
                                {c.documentTitle} · PDF หน้า {c.pageStart}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Side info */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                    วิธีการทำงาน
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  {[
                    { n: 1, t: 'อัปโหลดไฟล์', d: 'ลากวางหรือเลือกไฟล์ PDF/DOCX' },
                    { n: 2, t: 'เลือกหมวดกฎหมาย', d: 'เลือกหมวดที่ต้องการตรวจสอบ' },
                    { n: 3, t: 'ระบบค้นหามาตรา', d: 'เปรียบเทียบกับคลังกฎหมาย 15 chunks' },
                    { n: 4, t: 'ได้ผล + Citation', d: 'พร้อมเลขมาตราและหน้า PDF' },
                  ].map(s => (
                    <div key={s.n} className="flex gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {s.n}
                      </div>
                      <div>
                        <div className="font-medium">{s.t}</div>
                        <div className="text-muted-foreground">{s.d}</div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                    ข้อควรระวัง
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2 text-muted-foreground">
                  <p>• ไฟล์จะถูกประมวลผลในหน่วยความจำ ไม่จัดเก็บถาวรในเซิร์ฟเวอร์</p>
                  <p>• ผลการตรวจสอบเป็นการค้นหาเบื้องต้น ไม่ใช่ความเห็นทางกฎหมาย</p>
                  <p>• ควรใช้ควบคู่กับการปรึกษาผู้เชี่ยวชาญ</p>
                  <p>• ระบบจะไม่อ้างอิงมาตราที่ไม่มีในคลังข้อมูล (Zero-Hallucination)</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* LAW DOC TAB */}
        <TabsContent value="law_doc" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Scale className="h-4 w-4 text-violet-600" />
                เพิ่มเอกสารกฎหมายใหม่เข้าคลัง
              </CardTitle>
              <CardDescription>
                เพิ่มไฟล์กฎหมาย/ประกาศ/ข้อหารือ (PDF · DOCX · TXT) หรือวางข้อความ — ระบบจะให้ AI วิเคราะห์ แยกหมวดหมู่ และสกัดมาตราเข้าคลังให้ค้นหาได้ทันที
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="law-title" className="text-xs">ชื่อกฎหมาย <span className="text-rose-500">*</span></Label>
                  <Input
                    id="law-title"
                    value={lawTitle}
                    onChange={(e) => setLawTitle(e.target.value)}
                    placeholder="เช่น ประกาศกรมสรรพากรที่ ป.64/2567"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="law-url" className="text-xs">ที่มา (URL)</Label>
                  <Input
                    id="law-url"
                    type="url"
                    value={lawUrl}
                    onChange={(e) => setLawUrl(e.target.value)}
                    placeholder="วางลิงก์ เช่น https://www.rd.go.th/..."
                    className="text-sm font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    ระบบเก็บลิงก์นี้เป็นแหล่งอ้างอิง และถอดชื่อโดเมนมาเป็น &quot;แหล่งที่มา&quot; ให้อัตโนมัติ (ไม่บังคับ)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="law-edition" className="text-xs">ฉบับ</Label>
                  <Input
                    id="law-edition"
                    value={lawEdition}
                    onChange={(e) => setLawEdition(e.target.value)}
                    placeholder="เช่น ฉบับที่ 4 (ไม่บังคับ)"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">สถานะ</Label>
                  <Select value={lawStatus} onValueChange={setLawStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(options.law_status ?? []).map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="law-published" className="text-xs">วันที่ประกาศ</Label>
                  <Input
                    id="law-published"
                    type="date"
                    value={lawPublishedAt}
                    onChange={(e) => setLawPublishedAt(e.target.value)}
                    className="text-sm"
                  />
                  {lawPublishedAt && (
                    <p className="text-[10px] text-muted-foreground">
                      วันที่ประกาศ (พ.ศ.):{' '}
                      <span className="font-medium text-foreground">{formatThaiDateFromInput(lawPublishedAt)}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* File drop */}
              {!lawFile ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setLawDragOver(true) }}
                  onDragLeave={() => setLawDragOver(false)}
                  onDrop={handleLawFileDrop}
                  onClick={() => document.getElementById('law-file-input')?.click()}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                    lawDragOver ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30' : 'border-border hover:border-violet-400 hover:bg-muted/40'
                  }`}
                >
                  <input
                    id="law-file-input"
                    type="file"
                    accept={LAW_ACCEPTED_TYPES.join(',')}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) {
                        const ext = '.' + (f.name.split('.').pop() || '').toLowerCase()
                        if (!LAW_ACCEPTED_TYPES.includes(ext)) {
                          toast.error(`รองรับ ${LAW_ACCEPTED_TYPES.join(', ')}`)
                          return
                        }
                        setLawFile(f)
                        setLawResult(null)
                      }
                    }}
                  />
                  <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <div className="text-sm font-medium">เลือกไฟล์กฎหมาย (PDF · DOCX · TXT)</div>
                  <div className="text-xs text-muted-foreground mt-1">สูงสุด 10 MB · ส่งให้ AI วิเคราะห์ได้ไม่เกิน 4 MB</div>
                </div>
              ) : (
                <div className="border-2 border-violet-300 dark:border-violet-800 rounded-lg p-3 bg-violet-50/50 dark:bg-violet-950/20">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-violet-600" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{lawFile.name}</div>
                      <div className="text-xs text-muted-foreground">{(lawFile.size / 1024).toFixed(1)} KB</div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setLawFile(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* วางข้อความกฎหมาย (ใช้เมื่อไฟล์สแกน หรือต้องการแก้ข้อความ) */}
              <div className="space-y-2">
                <Label htmlFor="law-text" className="text-xs">ข้อความกฎหมาย (วางต่อได้เลย)</Label>
                <Textarea
                  id="law-text"
                  value={lawText}
                  onChange={(e) => setLawText(e.target.value)}
                  placeholder="วางข้อความกฎหมาย เช่น มาตรา 40 เงินได้พึงประเมินจากการจ้างแรงงาน..."
                  className="text-sm min-h-[120px]"
                />
                <p className="text-[10px] text-muted-foreground">
                  {lawText.trim().length.toLocaleString()} ตัวอักษร · ถ้ามีทั้งไฟล์และข้อความ ระบบจะใช้ข้อความที่วาง · ต้องมี ≥ 200 ตัวอักษรจึงให้ AI วิเคราะห์
                </p>
              </div>

              {/* หมวดหมู่ */}
              <div className="space-y-2">
                <Label className="text-xs">หมวดหมู่</Label>
                <Select value={lawCategory} onValueChange={setLawCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">ให้ AI วิเคราะห์อัตโนมัติ (แนะนำ)</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  AI ช่วยสกัดมาตราเสมอ · ถ้าเลือกหมวดเอง ระบบจะใช้หมวดที่เลือกแทนคำตอบของ AI
                </p>
              </div>

              {/* ผลวิเคราะห์ของ AI */}
              {lawResult && (
                <div className={`rounded-lg border p-3 space-y-2 ${lawResult.used ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20' : 'border-amber-300 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20'}`}>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {lawResult.used ? <Sparkles className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                    {lawResult.used ? 'AI วิเคราะห์เอกสารแล้ว' : 'ยังไม่ได้ใช้ AI วิเคราะห์'}
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    <Badge variant="outline">หมวด: {lawResult.categoryLabel}</Badge>
                    <Badge variant="outline">ประเภท: {lawResult.type}</Badge>
                    <Badge variant="outline">มาตรา: {lawResult.sections}</Badge>
                    <Badge variant="outline">โทเคน: {lawResult.tokens.toLocaleString()}</Badge>
                    <Badge variant="outline">หัก: {lawResult.creditsUsed} cr</Badge>
                    {lawResult.providerCredits ? <Badge variant="outline">ต้นทุนค่าย: {lawResult.providerCredits} cr</Badge> : null}
                    {lawResult.provider ? <Badge variant="outline">{lawResult.provider}</Badge> : null}
                  </div>
                  {lawResult.summary && <p className="text-xs text-muted-foreground">{lawResult.summary}</p>}
                  {!lawResult.used && lawResult.skippedReason && (
                    <p className="text-[10px] text-amber-700 dark:text-amber-400">เหตุผล: {lawResult.skippedReason}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">อ่านข้อความได้ {lawResult.textLength.toLocaleString()} ตัวอักษร</p>
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t bg-muted/20 justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setLawFile(null)
                setLawTitle('')
                setLawUrl('')
                setLawEdition('')
                setLawStatus('in_force')
                setLawPublishedAt('')
              }}>
                ล้าง
              </Button>
              <Button
                onClick={handleLawDocUpload}
                disabled={!lawFile || !lawTitle.trim() || lawUploading}
                className="bg-violet-600 hover:bg-violet-700"
              >
                {lawUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    กำลังเพิ่ม...
                  </>
                ) : (
                  <>
                    <FileCheck2 className="h-4 w-4 mr-2" />
                    เพิ่มเข้าคลังกฎหมาย
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-muted-foreground" />
                ประวัติการตรวจสอบเอกสาร
              </CardTitle>
              <CardDescription>รายการไฟล์ที่เคยอัปโหลดเพื่อตรวจสอบ Tax Compliance</CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 rounded-md bg-muted/40 animate-pulse" />
                  ))}
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                  <div className="text-sm text-muted-foreground">ยังไม่มีประวัติการอัปโหลด</div>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setTab('audit')}>
                    ไปอัปโหลดไฟล์
                  </Button>
                </div>
              ) : (
                <ScrollArea className="max-h-[28rem] scrollbar-thin pr-2">
                  <div className="space-y-2">
                    {history.map((h) => (
                      <div key={h.id} className="flex items-start gap-3 p-3 rounded-md border border-border/60 hover:bg-muted/40 transition-colors">
                        <div className="p-1.5 rounded bg-amber-50 dark:bg-amber-950/30">
                          <FileText className="h-4 w-4 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{h.fileName}</div>
                          <div className="text-xs text-muted-foreground line-clamp-1">{h.description}</div>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Quote className="h-2.5 w-2.5" />
                              {h.matchedCount} มาตรา
                            </span>
                            <span>· {h.creditsUsed} cr</span>
                            <span>· {h.durationMs}ms</span>
                            <span>· {formatThaiDateTime(h.createdAt)}</span>
                          </div>
                        </div>
                        <Badge variant="outline" className={
                          h.status === 'success'
                            ? 'text-emerald-600 border-emerald-200 dark:border-emerald-900'
                            : 'text-amber-600 border-amber-200 dark:border-amber-900'
                        }>
                          {h.status === 'success' ? 'สำเร็จ' : 'ไม่พบ'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
