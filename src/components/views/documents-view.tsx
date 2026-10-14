'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Scale, Landmark, BookOpen, Gavel, Calculator, Globe, FileText,
  ChevronDown, ChevronRight, ExternalLink, Calendar, Files, Hash, Layers, Filter, Sparkles
} from 'lucide-react'
import { toast } from 'sonner'
import { type LawCategory } from '@/lib/types'
import { CATEGORY_ICONS, CATEGORY_COLORS, type CategoryColorClasses } from '@/lib/category-visuals'
import { useAppState, optionLabel } from '@/lib/app-state'
import { formatThaiDate } from '@/lib/thai-date'

interface Chunk {
  id: string
  chunkId: string | null
  sectionNumber: string
  sectionLabel: string
  pageStart: number
  keywords: string | null
  content: string
}

interface DocumentItem {
  id: string
  code: string
  title: string
  shortTitle: string | null
  summary: string | null
  type: string
  category: LawCategory
  categoryLabel: string
  source: string
  sourceUrl: string | null
  pdfFile: string | null
  fileUrl: string | null
  pageCount: number
  chunkCount: number
  status: string
  effectiveDate: string | null
  chunks: Chunk[]
}

const ICONS: Record<string, React.ElementType> = {
  ...CATEGORY_ICONS,
  scale: Scale,
  landmark: Landmark,
  'book-open': BookOpen,
  gavel: Gavel,
  calculator: Calculator,
  globe: Globe,
}

const COLOR_CLASSES: Record<string, CategoryColorClasses> = {
  ...CATEGORY_COLORS,
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-900', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400', gradient: 'from-emerald-500 to-emerald-700' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-900', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400', gradient: 'from-amber-500 to-amber-700' },
  sky: { bg: 'bg-sky-50 dark:bg-sky-950/40', text: 'text-sky-700 dark:text-sky-400', border: 'border-sky-200 dark:border-sky-900', badge: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400', gradient: 'from-sky-500 to-sky-700' },
  rose: { bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-900', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400', gradient: 'from-rose-500 to-rose-700' },
  violet: { bg: 'bg-violet-50 dark:bg-violet-950/40', text: 'text-violet-700 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-900', badge: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400', gradient: 'from-violet-500 to-violet-700' },
  cyan: { bg: 'bg-cyan-50 dark:bg-cyan-950/40', text: 'text-cyan-700 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-900', badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400', gradient: 'from-cyan-500 to-cyan-700' },
}

const TYPE_LABELS: Record<string, string> = {
  act: 'พ.ร.บ.',
  decree: 'พ.ร.ฎ.',
  regulation: 'กฎกระทรวง',
  announcement: 'ประกาศ',
  ruling: 'ข้อหารือ',
  treaty: 'สนธิสัญญา',
}

export function DocumentsView() {
  const { categories, options } = useAppState()
  const [documents, setDocuments] = React.useState<DocumentItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [activeCategory, setActiveCategory] = React.useState<LawCategory | 'all'>('all')
  const [expandedDocs, setExpandedDocs] = React.useState<Set<string>>(new Set())

  async function load() {
    try {
      const res = await fetch('/api/documents')
      const json = await res.json()
      setDocuments(json.documents || [])
    } catch {
      toast.error('โหลดรายการเอกสารไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { load() }, [])

  function toggleDoc(docId: string) {
    setExpandedDocs(prev => {
      const next = new Set(prev)
      if (next.has(docId)) next.delete(docId)
      else next.add(docId)
      return next
    })
  }

  // Filter documents (ตามหมวดที่เลือก)
  const filteredDocs = React.useMemo(() => {
    if (activeCategory === 'all') return documents
    return documents.filter(d => d.category === activeCategory)
  }, [documents, activeCategory])

  // Group by category
  const groupedByCategory = React.useMemo(() => {
    const map: Record<string, DocumentItem[]> = {}
    for (const d of filteredDocs) {
      if (!map[d.category]) map[d.category] = []
      map[d.category].push(d)
    }
    return map
  }, [filteredDocs])

  // Total stats per category
  const categoryStats = React.useMemo(() => {
    const stats: Record<string, { docs: number; chunks: number }> = {}
    for (const d of documents) {
      if (!stats[d.category]) stats[d.category] = { docs: 0, chunks: 0 }
      stats[d.category].docs += 1
      stats[d.category].chunks += d.chunkCount
    }
    return stats
  }, [documents])

  const totalChunks = documents.reduce((s, d) => s + d.chunkCount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight">คลังกฎหมาย</h1>
          <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-900">
            <Layers className="h-3 w-3 mr-1" />
            แยกตาม 6 หมวด
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
          คลังเอกสารกฎหมายไทยจากแหล่งราชการ (rd.go.th, krisdika.go.th, ratchakitcha.soc.go.th)
          แบ่งตาม 6 หมวดหลัก ครอบคลุมประมวลรัษฎากร, ภาษีเฉพาะด้าน, แพ่งฯ, อาญา, บัญชี และ DTA
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <FileText className="h-4 w-4 text-violet-600" />
              <span className="text-2xl font-bold">{documents.length}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">เอกสารทั้งหมด</div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <Hash className="h-4 w-4 text-emerald-600" />
              <span className="text-2xl font-bold text-emerald-600">{totalChunks}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">มาตรา/ข้อหารือ</div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <Layers className="h-4 w-4 text-sky-600" />
              <span className="text-2xl font-bold text-sky-600">6</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">หมวดหลัก</div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <Files className="h-4 w-4 text-amber-600" />
              <span className="text-2xl font-bold text-amber-600">{documents.reduce((s, d) => s + d.pageCount, 0)}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">หน้า PDF รวม</div>
          </CardContent>
        </Card>
      </div>

      {/* Category filter pills */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Filter className="h-3 w-3" />
          กรองตามหมวด:
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory('all')}
            className={`text-xs px-3 py-1.5 rounded-full border-2 transition-all ${
              activeCategory === 'all'
                ? 'border-foreground bg-foreground text-background'
                : 'border-border hover:border-foreground/50'
            }`}
          >
            ทั้งหมด ({documents.length})
          </button>
          {categories.map((meta) => {
            const stats = categoryStats[meta.value] || { docs: 0, chunks: 0 }
            const color = COLOR_CLASSES[meta.color]
            const isActive = activeCategory === meta.value
            const Icon = ICONS[meta.icon] || FileText
            return (
              <button
                key={meta.value}
                onClick={() => setActiveCategory(meta.value)}
                className={`text-xs px-3 py-1.5 rounded-full border-2 transition-all flex items-center gap-1.5 ${
                  isActive ? `${color.border} ${color.bg} ${color.text} font-medium` : 'border-border hover:border-foreground/30'
                }`}
              >
                <Icon className="h-3 w-3" />
                {meta.label} ({stats.docs})
              </button>
            )
          })}
        </div>
      </div>

      {/* Documents grouped by category */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="h-32 animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : filteredDocs.length === 0 && documents.length > 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <div className="text-sm text-muted-foreground">ยังไม่มีเอกสารในหมวดที่เลือก</div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {categories.map((meta) => {
            const docs = groupedByCategory[meta.value] || []
            const color = COLOR_CLASSES[meta.color]
            const Icon = ICONS[meta.icon] || FileText
            const totalChunksInCat = docs.reduce((s, d) => s + d.chunkCount, 0)
            const totalDocsInCat = docs.length

            return (
              <Card key={meta.value} className={`border-2 ${color.border} overflow-hidden`}>
                {/* Category header */}
                <div className={`p-4 ${color.bg} border-b ${color.border}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-gradient-to-br ${color.gradient} text-white shadow-sm`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-bold">{meta.label}</h2>
                          <Badge variant="outline" className={`${color.badge} border-0 text-[10px]`}>
                            {meta.short}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">{meta.description}</p>
                      </div>
                    </div>
                    <div className="flex gap-3 text-right">
                      <div>
                        <div className="text-lg font-bold">{totalDocsInCat}</div>
                        <div className="text-[10px] text-muted-foreground">เอกสาร</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold">{totalChunksInCat}</div>
                        <div className="text-[10px] text-muted-foreground">มาตรา</div>
                      </div>
                    </div>
                  </div>
                </div>

                <CardContent className="p-4 space-y-2">
                  {docs.length === 0 && (
                    <div className="py-6 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-lg">
                      ยังไม่มีเอกสารในหมวดนี้ — เพิ่มเอกสารจริงได้ที่หน้าอัปโหลด
                    </div>
                  )}
                  {docs.map((doc) => {
                    const isExpanded = expandedDocs.has(doc.id)
                    return (
                      <div key={doc.id} className="border border-border/60 rounded-lg overflow-hidden bg-background">
                        {/* Doc header - clickable */}
                        <button
                          onClick={() => toggleDoc(doc.id)}
                          className="w-full p-3 flex items-center gap-3 hover:bg-muted/40 transition-colors text-left"
                        >
                          <div className={`p-1.5 rounded ${color.bg} ${color.text}`}>
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold">{doc.shortTitle || doc.title}</span>
                              <Badge variant="outline" className="text-[9px] font-mono">{doc.code}</Badge>
                              <Badge variant="outline" className={`${color.badge} border-0 text-[9px]`}>
                                {optionLabel(options, 'law_type', doc.type, TYPE_LABELS[doc.type] || doc.type)}
                              </Badge>
                            </div>
                            {doc.summary ? (
                              <div className="text-xs text-muted-foreground mt-1 flex items-start gap-1.5">
                                <Sparkles className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                                <span className="line-clamp-3">{doc.summary}</span>
                              </div>
                            ) : doc.chunkCount === 0 ? (
                              <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                                ยังไม่มีคำอธิบาย — อัปโหลด/ประมวลผลด้วย AI เพื่อให้มีสรุปและค้นหาได้
                              </div>
                            ) : null}
                            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                              <span>{doc.chunkCount} มาตรา</span>
                              <span>· {doc.pageCount} หน้า</span>
                              <span>· {doc.source}</span>
                              {doc.effectiveDate && (
                                <span className="flex items-center gap-1">
                                  · <Calendar className="h-2.5 w-2.5" />
                                  {formatThaiDate(doc.effectiveDate)}
                                </span>
                              )}
                            </div>
                          </div>
                          {doc.fileUrl && (
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1 shrink-0"
                            >
                              <FileText className="h-3 w-3" />
                              เปิดไฟล์
                            </a>
                          )}
                          {doc.sourceUrl && (
                            <a
                              href={doc.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              แหล่งที่มา
                            </a>
                          )}
                        </button>

                        {/* Expanded chunks */}
                        {isExpanded && (
                          <div className="border-t border-border/60 bg-muted/20 p-3 space-y-3">
                            {doc.chunks.length === 0 ? (
                              <div className="text-xs text-muted-foreground text-center py-4">
                                ยังไม่มีมาตราในเอกสารนี้
                              </div>
                            ) : (
                              <ScrollArea className="max-h-96 scrollbar-thin pr-2">
                                <div className="space-y-2">
                                  {doc.chunks.map((chunk) => (
                                    <div key={chunk.id} className="p-3 rounded-md bg-background border border-border/60 hover:border-foreground/30 transition-colors">
                                      <div className="flex items-center justify-between gap-2 mb-1.5">
                                        <div className="flex items-center gap-2">
                                          <Badge variant="secondary" className="text-[10px] font-mono">{chunk.chunkId || chunk.id.slice(-8)}</Badge>
                                          <span className="text-sm font-semibold">{chunk.sectionLabel}</span>
                                        </div>
                                        <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                                          <span>หน้า {chunk.pageStart}</span>
                                        </div>
                                      </div>
                                      <p className="text-xs leading-relaxed text-foreground/80">{chunk.content}</p>
                                      {chunk.keywords && (
                                        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/40">
                                          {chunk.keywords.split(',').slice(0, 5).map((kw, i) => (
                                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                              {kw.trim()}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Sources footer */}
      <Card className="bg-gradient-to-br from-sky-50/50 to-emerald-50/30 dark:from-sky-950/20 dark:to-emerald-950/10 border-sky-200/60 dark:border-sky-900/60">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-sky-600" />
            แหล่งข้อมูลทางการ
          </CardTitle>
          <CardDescription>เอกสารทั้งหมดมาจากแหล่งราชการที่เชื่อถือได้ 100%</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-md bg-background/70 border border-border/60">
              <div className="font-semibold text-sm mb-1">กรมสรรพากร</div>
              <div className="text-muted-foreground">rd.go.th</div>
              <div className="text-muted-foreground mt-1">ประมวลรัษฎากร, กฎกระทรวง, ประกาศ, ข้อหารือ</div>
            </div>
            <div className="p-3 rounded-md bg-background/70 border border-border/60">
              <div className="font-semibold text-sm mb-1">กฤษฎีกา</div>
              <div className="text-muted-foreground">krisdika.go.th</div>
              <div className="text-muted-foreground mt-1">ตัวบทกฎหมายฉบับปรับปรุงล่าสุด</div>
            </div>
            <div className="p-3 rounded-md bg-background/70 border border-border/60">
              <div className="font-semibold text-sm mb-1">ราชกิจจานุเบกษา</div>
              <div className="text-muted-foreground">ratchakitcha.soc.go.th</div>
              <div className="text-muted-foreground mt-1">ฉบับออฟฟิเชียลของกฎหมายไทย</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
