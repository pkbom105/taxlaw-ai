'use client'

import * as React from 'react'
import { StatsCards, UsageChartCard, ModeBreakdownCard, RecentQueriesCard } from '@/components/dashboard/stats-cards'
import { CategoryOverview } from '@/components/dashboard/category-overview'
import { SearchPanel } from '@/components/search/search-panel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Sparkles, BookOpen, ScrollText, FileSearch, TrendingUp } from 'lucide-react'
import type { DashboardStats, SearchResult } from '@/lib/types'
import { toast } from 'sonner'

interface Props {
  balance: number
  onTopUpNeeded: () => void
  onCreditsChange: (newBalance: number) => void
}

export function DashboardView({ balance, onTopUpNeeded, onCreditsChange }: Props) {
  const [stats, setStats] = React.useState<DashboardStats | null>(null)
  const [loading, setLoading] = React.useState(true)

  async function loadStats() {
    try {
      const res = await fetch('/api/stats')
      const data = await res.json()
      setStats(data)
      onCreditsChange(data.wallet?.balance ?? 0)
    } catch {
      toast.error('โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    loadStats()
  }, [])

  function handleSearchComplete(_result: SearchResult) {
    loadStats()
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard ระบบค้นหากฎหมายภาษี</h1>
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            <Sparkles className="h-3 w-3 mr-1" />
            สำหรับนักบัญชี · ทนายความ · SME
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
          ระบบ AI ค้นหากฎหมายและประมวลรัษฎากรไทย โดยใช้เทคนิค <strong>RAG (Retrieval-Augmented Generation)</strong> ป้องกัน AI มโนมาตรา
          อ้างอิงแหล่งที่มาจากเอกสารราชการ 100% · ทุกคำตอบมาพร้อมเลขมาตราและหน้า PDF ที่อ้างอิง
        </p>
      </section>

      {/* Stats cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="h-32 animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : (
        <StatsCards stats={stats?.stats ?? {} as DashboardStats['stats']} wallet={stats?.wallet ?? null} />
      )}

      {/* Search panel + side stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <SearchPanel
            balance={balance}
            onTopUpNeeded={onTopUpNeeded}
            onSearchComplete={handleSearchComplete}
          />
          {stats && <CategoryOverview categories={stats.categories} />}
        </div>

        <div className="space-y-6">
          {stats && <ModeBreakdownCard queriesByMode={stats.queriesByMode} />}
          {stats && <UsageChartCard dailyUsage={stats.dailyUsage} />}
          {stats && <RecentQueriesCard queries={stats.recentQueries} />}
        </div>
      </div>

      {/* Architecture section */}
      <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/50 to-amber-50/30 dark:from-emerald-950/20 dark:to-amber-950/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSearch className="h-4 w-4 text-emerald-600" />
            สถาปัตยกรรม Zero-Hallucination RAG
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { step: 1, title: 'PDF Extraction', desc: 'ดึงข้อมูลจาก PDF ราชการ → ตัดแยกตาม มาตรา/ข้อ/วรรค', icon: BookOpen, color: 'emerald' },
              { step: 2, title: 'Vector DB + Full-Text', desc: 'เก็บ chunks พร้อม metadata (chunkId, section, page)', icon: ScrollText, color: 'sky' },
              { step: 3, title: 'Strict Prompting', desc: 'AI ตอบจาก Context เท่านั้น · ห้ามใช้ความรู้ภายนอก', icon: Sparkles, color: 'amber' },
              { step: 4, title: 'Citation Output', desc: 'คำตอบพร้อมลิงก์อ้างอิงมาตรา + PDF หน้า', icon: TrendingUp, color: 'rose' },
            ].map((s) => {
              const Icon = s.icon
              return (
                <div key={s.step} className="p-4 rounded-lg border border-border/60 bg-background/80 backdrop-blur">
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-1.5 rounded-md bg-${s.color}-50 dark:bg-${s.color}-950/40`}>
                      <Icon className={`h-4 w-4 text-${s.color}-600`} />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">ขั้นที่ {s.step}</span>
                  </div>
                  <div className="text-sm font-semibold mb-1">{s.title}</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              )
            })}
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <div className="font-semibold text-sm flex items-center gap-1.5">
                <span className="text-emerald-600">🟢</span> โมเดลราคา (Usage-based)
              </div>
              <div className="text-muted-foreground">Basic: 1 cr · Deep: 5 cr · Audit: 10 cr</div>
              <div className="text-muted-foreground">ต้นทุนจริง 0.10–0.30 บาท/คำถาม · กำไร 80%+</div>
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-sm flex items-center gap-1.5">
                <span className="text-amber-600">🟡</span> แหล่งข้อมูล
              </div>
              <div className="text-muted-foreground">rd.go.th · krisdika.go.th</div>
              <div className="text-muted-foreground">ratchakitcha.soc.go.th · Tax Rulings</div>
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-sm flex items-center gap-1.5">
                <span className="text-sky-600">🔵</span> ระบบการเงิน
              </div>
              <div className="text-muted-foreground">PromptPay Dynamic QR · SlipOK</div>
              <div className="text-muted-foreground">ขั้นต่ำ 100 บาท · โบนัสสูงสุด 15%</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
