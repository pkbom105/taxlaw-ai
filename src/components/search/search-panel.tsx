'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, Sparkles, Loader2, ShieldCheck, AlertTriangle, FileText, ExternalLink, Quote, Coins, Clock, Lightbulb } from 'lucide-react'
import { toast } from 'sonner'
import { PRICING_TIERS, type SearchMode, type SearchResult } from '@/lib/types'

interface Props {
  balance: number
  onTopUpNeeded: () => void
  onSearchComplete: (result: SearchResult) => void
}

const SUGGESTIONS = [
  'เงินเดือนคำนวณภาษีอย่างไร',
  'หัก ณ ที่จ่ายค่าบริการ 3%',
  'ขายของออนไลน์ต้องเสีย VAT ไหม',
  'ภาษีมรดกคำนวณอย่างไร',
  'ค่าสิทธิ์จ่ายต่างประเทศถูกหักกี่เปอร์เซ็นต์',
  'บริษัทจำกัดความรับผิดตามกฎหมาย',
  'ทำบัญชีปลอมมีโทษอย่างไร',
]

function renderAnswer(answer: string) {
  // Render the simple markdown-like answer
  return answer.split('\n').map((line, i) => {
    if (line.startsWith('**') && line.endsWith('**')) {
      return <p key={i} className="font-semibold text-primary mt-2">{line.slice(2, -2)}</p>
    }
    if (line.startsWith('> ')) {
      return <blockquote key={i} className="border-l-2 border-amber-400 pl-3 italic text-muted-foreground my-2 text-sm">{line.slice(2)}</blockquote>
    }
    if (line.startsWith('📄 ')) {
      return <p key={i} className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1"><FileText className="h-3 w-3" />{line.slice(2)}</p>
    }
    if (line.trim() === '') return <div key={i} className="h-2" />
    return <p key={i} className="text-sm">{line}</p>
  })
}

export function SearchPanel({ balance, onTopUpNeeded, onSearchComplete }: Props) {
  const [query, setQuery] = React.useState('')
  const [mode, setMode] = React.useState<SearchMode>('deep')
  const [loading, setLoading] = React.useState(false)
  const [result, setResult] = React.useState<SearchResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const selectedTier = PRICING_TIERS.find(t => t.mode === mode)!
  const canSearch = query.trim().length >= 5 && balance >= selectedTier.credits && !loading

  async function handleSearch() {
    if (!query.trim()) {
      toast.error('กรุณาพิมพ์คำถาม')
      return
    }
    if (query.trim().length < 5) {
      toast.error('คำถามสั้นเกินไป กรุณาใส่อย่างน้อย 5 ตัวอักษร')
      return
    }
    if (balance < selectedTier.credits) {
      toast.error(`ยอดเครดิตไม่เพียงพอ ต้องการ ${selectedTier.credits} ครีดิต คงเหลือ ${balance}`)
      onTopUpNeeded()
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), mode }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'INSUFFICIENT_CREDITS') {
          toast.error(data.message)
          onTopUpNeeded()
          return
        }
        throw new Error(data.message || data.error || 'Search failed')
      }
      setResult(data)
      onSearchComplete(data)
      if (data.status === 'no_match') {
        toast.info('ไม่พบข้อกฎหมายที่เกี่ยวข้องในคลังข้อมูล')
      } else {
        toast.success(`พบ ${data.citations.length} มาตราที่เกี่ยวข้อง · ใช้ ${data.creditsUsed} ครีดิต`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg)
      toast.error('ค้นหาไม่สำเร็จ: ' + msg)
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSearch()
    }
  }

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              AI ค้นหากฎหมายภาษี (Zero-Hallucination RAG)
            </CardTitle>
            <CardDescription className="mt-1">
              คำตอบมาจากเอกสารทางการ 100% · อ้างอิงมาตราและหน้า PDF ทุกครั้ง · หากไม่พบจะแจ้งตรงๆ ไม่มโน
            </CardDescription>
          </div>
          <Badge variant="outline" className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900">
            <ShieldCheck className="h-3 w-3" />
            RAG Verified
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode selection */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {PRICING_TIERS.map((tier) => {
            const isActive = mode === tier.mode
            return (
              <button
                key={tier.mode}
                onClick={() => setMode(tier.mode)}
                className={`text-left p-3 rounded-lg border-2 transition-all ${
                  isActive
                    ? `border-${tier.color}-500 bg-${tier.color}-50 dark:bg-${tier.color}-950/30`
                    : 'border-border hover:border-muted-foreground/50 bg-background'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{tier.name}</span>
                  <Badge variant={isActive ? 'default' : 'secondary'} className="text-[10px]">{tier.credits} cr</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tier.description}</p>
              </button>
            )
          })}
        </div>

        {/* Query input */}
        <div className="space-y-2">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="เช่น: หัก ณ ที่จ่ายค่าบริการ 3% ตามมาตราใด และต้องนำส่งภายในกี่วัน?"
            className="min-h-[100px] resize-y text-sm"
            disabled={loading}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{query.length} ตัวอักษร · กด Cmd/Ctrl + Enter เพื่อค้นหา</span>
            <span className="flex items-center gap-1">
              <Coins className="h-3 w-3" />
              จะใช้ {selectedTier.credits} ครีดิต (คงเหลือ {balance})
            </span>
          </div>
        </div>

        {/* Suggestions */}
        {!result && !loading && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Lightbulb className="h-3 w-3" />
              ตัวอย่างคำถามที่นิยม
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setQuery(s)}
                  className="text-xs px-2.5 py-1 rounded-full border border-border hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search button */}
        <Button
          onClick={handleSearch}
          disabled={!canSearch}
          className="w-full h-11 text-sm font-medium"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              กำลังค้นหาในคลังกฎหมาย...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              ค้นหาด้วย {selectedTier.name} ({selectedTier.credits} ครีดิต)
            </>
          )}
        </Button>

        {balance < selectedTier.credits && (
          <div className="text-xs flex items-center gap-1.5 text-rose-600 bg-rose-50 dark:bg-rose-950/30 dark:text-rose-400 p-2 rounded-md">
            <AlertTriangle className="h-3 w-3" />
            เครดิตไม่เพียงพอ กรุณาเติมเงินก่อนค้นหา
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-sm text-rose-700 dark:text-rose-400">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <Separator className="my-4" />
        )}

        {result && (
          <div className="space-y-3">
            {/* Status header */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {result.status === 'success' ? (
                  <Badge variant="outline" className="text-emerald-600 border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30">
                    <ShieldCheck className="h-3 w-3 mr-1" /> พบข้อกฎหมาย
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30">
                    <AlertTriangle className="h-3 w-3 mr-1" /> ไม่พบในคลังข้อมูล
                  </Badge>
                )}
                {result.citations.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    <Quote className="h-3 w-3 mr-1" />
                    {result.citations.length} มาตราที่อ้างอิง
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Coins className="h-3 w-3" />
                  {result.creditsUsed} cr
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {result.durationMs}ms
                </span>
              </div>
            </div>

            {/* Answer */}
            <div className="ai-answer p-4 rounded-lg bg-muted/40 border border-border/60 text-sm leading-relaxed">
              {renderAnswer(result.answer)}
            </div>

            {/* Citations */}
            {result.citations.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Quote className="h-3 w-3" />
                  แหล่งอ้างอิง ({result.citations.length} รายการ)
                </div>
                <ScrollArea className="max-h-72 scrollbar-thin pr-2">
                  <div className="space-y-2">
                    {result.citations.map((c, i) => (
                      <div key={c.id} className="p-3 rounded-md border border-border/60 bg-background hover:bg-muted/40 transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">#{i + 1}</span>
                            <Badge variant="secondary" className="text-[10px]">{c.documentCode}</Badge>
                            <span className="text-sm font-semibold">{c.sectionLabel}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="flex items-center gap-1 text-xs">
                              <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500" style={{ width: `${c.relevance * 100}%` }} />
                              </div>
                              <span className="text-muted-foreground">{(c.relevance * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">{c.snippet}</p>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-3">
                          <span>{c.documentTitle}</span>
                          <span>· PDF หน้า {c.pageStart}</span>
                          <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5" asChild>
                            <a href="#" onClick={(e) => { e.preventDefault(); toast.info(`เปิดไฟล์ PDF: ${c.documentCode} หน้า ${c.pageStart}`) }}>
                              <ExternalLink className="h-2.5 w-2.5 mr-1" />
                              เปิด PDF
                            </a>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
