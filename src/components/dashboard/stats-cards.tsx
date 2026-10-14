'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Wallet, FileText, Search, ShieldCheck, TrendingUp, Clock, Coins } from 'lucide-react'
import type { DashboardStats } from '@/lib/types'
import { formatThaiDateTime } from '@/lib/thai-date'

interface Props {
  stats: DashboardStats['stats']
  wallet: DashboardStats['wallet']
}

export function StatsCards({ stats, wallet }: Props) {
  const accuracyColor = stats.accuracyRate >= 90 ? 'text-emerald-600' : stats.accuracyRate >= 70 ? 'text-amber-600' : 'text-rose-600'

  const cards = [
    {
      title: 'เครดิตคงเหลือ',
      value: wallet?.balance?.toLocaleString() ?? '0',
      suffix: 'credits',
      icon: Wallet,
      sub: `ใช้ไปแล้ว ${(wallet?.totalUsed ?? 0).toLocaleString()} · เติมรวม ${(wallet?.totalTopUp ?? 0).toLocaleString()}`,
      accent: 'emerald',
    },
    {
      title: 'คลังกฎหมาย',
      value: stats.totalDocuments.toLocaleString(),
      suffix: 'เล่ม',
      icon: FileText,
      sub: `${stats.totalChunks.toLocaleString()} มาตรา/ข้อหารือ`,
      accent: 'sky',
    },
    {
      title: 'การค้นหาทั้งหมด',
      value: stats.totalQueries.toLocaleString(),
      suffix: 'ครั้ง',
      icon: Search,
      sub: `30 วันล่าสุด ${stats.queriesLast30} · 7 วันล่าสุด ${stats.queriesLast7}`,
      accent: 'amber',
    },
    {
      title: 'อัตราความแม่นยำ',
      value: stats.accuracyRate.toFixed(1),
      suffix: '%',
      icon: ShieldCheck,
      sub: 'อ้างอิงมาตราได้ถูกต้อง (Zero-Hallucination)',
      accent: 'rose',
      customValueColor: accuracyColor,
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c, i) => {
        const Icon = c.icon
        return (
          <Card key={i} className="relative overflow-hidden border-border/60 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
              <div className={`p-1.5 rounded-md bg-${c.accent}-50 dark:bg-${c.accent}-950/40`}>
                <Icon className={`h-4 w-4 text-${c.accent}-600 dark:text-${c.accent}-400`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-2xl font-bold tracking-tight ${c.customValueColor ?? ''}`}>{c.value}</span>
                <span className="text-xs text-muted-foreground font-medium">{c.suffix}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{c.sub}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export function UsageChartCard({ dailyUsage }: { dailyUsage: DashboardStats['dailyUsage'] }) {
  const totalQueries = dailyUsage.reduce((s, d) => s + d.queries, 0)
  const totalCredits = dailyUsage.reduce((s, d) => s + d.credits, 0)
  const maxQueries = Math.max(...dailyUsage.map(d => d.queries), 1)
  const maxCredits = Math.max(...dailyUsage.map(d => d.credits), 1)

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              การใช้งาน 30 วันล่าสุด
            </CardTitle>
            <CardDescription className="mt-1">การค้นหาและเครดิตที่ใช้รายวัน</CardDescription>
          </div>
          <div className="flex gap-4 text-right">
            <div>
              <div className="text-xs text-muted-foreground">คำค้น</div>
              <div className="text-lg font-semibold text-emerald-600">{totalQueries}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">เครดิต</div>
              <div className="text-lg font-semibold text-amber-600">{totalCredits}</div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-48 flex items-end gap-1">
          {dailyUsage.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div className="w-full flex-1 flex flex-col justify-end gap-0.5">
                <div
                  className="w-full bg-amber-400/70 dark:bg-amber-500/60 rounded-t-sm transition-all hover:bg-amber-500"
                  style={{ height: `${(d.credits / maxCredits) * 100}%`, minHeight: d.credits > 0 ? '4px' : '0' }}
                  title={`${d.credits} credits`}
                />
                <div
                  className="w-full bg-emerald-500/80 dark:bg-emerald-600/70 rounded-b-sm transition-all hover:bg-emerald-600"
                  style={{ height: `${(d.queries / maxQueries) * 100}%`, minHeight: d.queries > 0 ? '4px' : '0' }}
                  title={`${d.queries} queries`}
                />
              </div>
              {i % 5 === 0 && (
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{d.dateLabel}</span>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/60">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-emerald-500/80" />
            <span className="text-xs text-muted-foreground">การค้นหา</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-amber-400/70" />
            <span className="text-xs text-muted-foreground">เครดิตที่ใช้</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ModeBreakdownCard({ queriesByMode }: { queriesByMode: DashboardStats['queriesByMode'] }) {
  const total = queriesByMode.reduce((s, m) => s + m.count, 0) || 1
  const totalCredits = queriesByMode.reduce((s, m) => s + m.credits, 0)
  const labels: Record<string, { name: string; color: string; icon: React.ElementType }> = {
    basic: { name: 'Basic Search', color: 'emerald', icon: Search },
    deep: { name: 'Deep Analysis', color: 'amber', icon: TrendingUp },
    audit: { name: 'Document Audit', color: 'rose', icon: ShieldCheck },
  }

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Coins className="h-4 w-4 text-amber-600" />
          สัดส่วนการใช้งานตามโหมด
        </CardTitle>
        <CardDescription>การกระจายคำค้นและเครดิตที่ใช้</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {queriesByMode.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-6">ยังไม่มีการใช้งาน</div>
        )}
        {queriesByMode.map((m) => {
          const meta = labels[m.mode] || { name: m.mode, color: 'gray', icon: Search }
          const pct = (m.count / total) * 100
          const Icon = meta.icon
          return (
            <div key={m.mode}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 text-${meta.color}-600`} />
                  <span className="text-sm font-medium">{meta.name}</span>
                  <Badge variant="secondary" className="text-[10px]">{m.credits} cr/ครั้ง</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {m.count} ครั้ง <span className="text-xs">· {pct.toFixed(0)}%</span>
                </div>
              </div>
              <Progress value={pct} className="h-2" />
            </div>
          )
        })}
        <div className="pt-3 border-t border-border/60 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">เครดิตรวมที่ใช้</span>
          <span className="text-sm font-semibold text-amber-600">{totalCredits.toLocaleString()} credits</span>
        </div>
      </CardContent>
    </Card>
  )
}

export function RecentQueriesCard({ queries }: { queries: DashboardStats['recentQueries'] }) {
  const modeMeta: Record<string, { label: string; color: string }> = {
    basic: { label: 'Basic', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' },
    deep: { label: 'Deep', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' },
    audit: { label: 'Audit', color: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400' },
  }

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-muted-foreground" />
          คำค้นล่าสุด
        </CardTitle>
        <CardDescription>5 รายการล่าสุด พร้อมสถานะการอ้างอิงมาตรา</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {queries.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-6">ยังไม่มีประวัติการค้นหา</div>
        )}
        {queries.map((q) => {
          const meta = modeMeta[q.mode] || modeMeta.basic
          return (
            <div key={q.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${meta.color}`}>
                {meta.label}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-1">{q.query}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    {q.citationsCount} มาตรา
                  </span>
                  <span>· {q.creditsUsed} cr</span>
                  <span>· {q.durationMs}ms</span>
                  <span>· {formatThaiDateTime(q.createdAt)}</span>
                </div>
              </div>
              {q.status === 'success' ? (
                <Badge variant="outline" className="text-emerald-600 border-emerald-200 dark:border-emerald-900 whitespace-nowrap">สำเร็จ</Badge>
              ) : q.status === 'no_match' ? (
                <Badge variant="outline" className="text-amber-600 border-amber-200 dark:border-amber-900 whitespace-nowrap">ไม่พบ</Badge>
              ) : (
                <Badge variant="outline" className="text-rose-600 border-rose-200 dark:border-rose-900 whitespace-nowrap">ผิดพลาด</Badge>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
