'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Scale, Landmark, BookOpen, Gavel, Calculator, Globe, ExternalLink, FileText, ChevronRight } from 'lucide-react'
import type { LawDocumentSummary } from '@/lib/types'
import { CATEGORY_ICONS, CATEGORY_COLORS } from '@/lib/category-visuals'
import { useAppState } from '@/lib/app-state'

const ICONS: Record<string, React.ElementType> = {
  ...CATEGORY_ICONS,
  scale: Scale,
  landmark: Landmark,
  'book-open': BookOpen,
  gavel: Gavel,
  calculator: Calculator,
  globe: Globe,
}

const COLOR_CLASSES: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  ...CATEGORY_COLORS,
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-900', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-900', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' },
  sky: { bg: 'bg-sky-50 dark:bg-sky-950/40', text: 'text-sky-700 dark:text-sky-400', border: 'border-sky-200 dark:border-sky-900', badge: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400' },
  rose: { bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-900', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400' },
  violet: { bg: 'bg-violet-50 dark:bg-violet-950/40', text: 'text-violet-700 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-900', badge: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400' },
  cyan: { bg: 'bg-cyan-50 dark:bg-cyan-950/40', text: 'text-cyan-700 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-900', badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400' },
}

interface Props {
  categories: LawDocumentSummary[]
}

export function CategoryOverview({ categories }: Props) {
  const { categories: categoryDefs } = useAppState()
  // Group documents by category
  const byCategory = React.useMemo(() => {
    const map: Record<string, LawDocumentSummary[]> = {}
    for (const doc of categories) {
      if (!map[doc.category]) map[doc.category] = []
      map[doc.category].push(doc)
    }
    return map
  }, [categories])

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-emerald-600" />
          คลังกฎหมาย 6 หมวดหลัก
        </CardTitle>
        <CardDescription>แหล่งข้อมูลจาก krisdika.go.th · rd.go.th · ratchakitcha.soc.go.th</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[28rem] pr-3 scrollbar-thin">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {categoryDefs.map((meta) => {
              const docs = byCategory[meta.value] || []
              const chunkCount = docs.reduce((s, d) => s + d.chunkCount, 0)
              const color = COLOR_CLASSES[meta.color]
              const Icon = ICONS[meta.icon] || FileText
              return (
                <div
                  key={meta.value}
                  className={`p-4 rounded-lg border ${color.border} ${color.bg} flex flex-col gap-2 transition-all hover:shadow-md`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-md bg-background/70 ${color.text}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold leading-tight">{meta.label}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{meta.short}</div>
                      </div>
                    </div>
                    <Badge variant="outline" className={`${color.badge} border-0 text-[10px]`}>
                      {docs.length} เล่ม
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{meta.description}</p>
                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border/40">
                    <span className="text-muted-foreground">{chunkCount} มาตรา/ข้อหารือ</span>
                    {docs[0]?.sourceUrl && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs px-2" asChild>
                        <a href={docs[0].sourceUrl} target="_blank" rel="noopener noreferrer">
                          แหล่งที่มา <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Document list */}
          <div className="mt-4 pt-4 border-t border-border/60">
            <div className="text-sm font-medium mb-2 text-muted-foreground">รายการเอกสาร ({categories.length} เล่ม)</div>
            <div className="space-y-1.5">
              {categories.map((doc) => {
                const meta = categoryDefs.find(m => m.value === doc.category)
                const color = COLOR_CLASSES[meta?.color || 'emerald']
                const Icon = ICONS[meta?.icon || 'scale'] || FileText
                return (
                  <div key={doc.code} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/60 transition-colors cursor-pointer group">
                    <div className={`p-1 rounded ${color.bg} ${color.text}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium line-clamp-1">{doc.shortTitle || doc.title}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        <span className="font-mono">{doc.code}</span>
                        <span>· {doc.chunkCount} มาตรา</span>
                        <span>· {doc.pageCount} หน้า</span>
                        <span>· {doc.source}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className={`${color.badge} border-0 text-[10px]`}>
                      {doc.type === 'act' ? 'พ.ร.บ.' : doc.type === 'treaty' ? 'สนธิสัญญา' : doc.type === 'decree' ? 'พ.ร.ฎ.' : doc.type}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                )
              })}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
