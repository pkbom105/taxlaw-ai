'use client'

import * as React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Activity, Coins, Cpu, RefreshCw, Sparkles, Upload, Search, Timer, Wallet, AlertTriangle } from 'lucide-react'
import { formatThaiDateTime } from '@/lib/thai-date'

interface LogRow {
  id: string
  createdAt: string
  action: string
  kind: 'ai' | 'keyword' | 'upload'
  engine: string | null
  provider: string | null
  providerLabel: string | null
  protocol: string | null
  tokens: number
  credits: number
  providerCredits: number | null
  durationMs: number | null
  status: string | null
  category: string | null
  sections: number | null
  fileName: string | null
  detail: string
}

interface Summary {
  totalRequests: number
  aiRequests: number
  keywordRequests: number
  uploadRequests: number
  tokens: number
  credits: number
  providerCredits: number
  avgDurationMs: number
  lastUsedAt: string | null
}

interface ProviderStat {
  id: string
  label: string
  requests: number
  tokens: number
  credits: number
  providerCredits: number
}

const FILTERS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'ai', label: 'AI ตอบ' },
  { key: 'keyword', label: 'keyword (สำรอง)' },
  { key: 'upload', label: 'อัปโหลด/ประมวลผล' },
]

export function AiLogView() {
  const [data, setData] = React.useState<{ logs: LogRow[]; summary: Summary; byProvider: ProviderStat[]; balance: number } | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [filter, setFilter] = React.useState('all')

  const load = React.useCallback(async (kind: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ai-log?kind=${kind}&limit=100`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'โหลดไม่สำเร็จ')
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    load(filter)
  }, [filter, load])

  const summary = data?.summary
  const cards = [
    {
      title: 'คำขอทั้งหมด',
      value: (summary?.totalRequests ?? 0).toLocaleString(),
      sub: `AI ${summary?.aiRequests ?? 0} · keyword ${summary?.keywordRequests ?? 0} · อัปโหลด ${summary?.uploadRequests ?? 0}`,
      icon: Activity,
      color: 'text-sky-600',
    },
    {
      title: 'โทเคนที่ใช้รวม',
      value: (summary?.tokens ?? 0).toLocaleString(),
      sub: summary?.lastUsedAt ? `ล่าสุด ${formatThaiDateTime(summary.lastUsedAt)}` : 'ยังไม่มีการใช้งาน',
      icon: Cpu,
      color: 'text-violet-600',
    },
    {
      title: 'เครดิตที่หัก',
      value: (summary?.credits ?? 0).toLocaleString(),
      sub: `คงเหลือ ${(data?.balance ?? 0).toLocaleString()} เครดิต`,
      icon: Coins,
      color: 'text-amber-600',
    },
    {
      title: 'ต้นทุนค่าย (จริง)',
      value: (summary?.providerCredits ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 }),
      sub: `เวลาเฉลี่ย ${((summary?.avgDurationMs ?? 0) / 1000).toFixed(1)} วินาที`,
      icon: Wallet,
      color: 'text-emerald-600',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-600" />
            AI log Usage
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            ประวัติการเรียก AI ทุกครั้ง — โทเคนจริง · เครดิตที่หัก · ต้นทุนของผู้ให้บริการ
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(filter)} disabled={loading} className="gap-1.5">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          รีเฟรช
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(c => {
          const Icon = c.icon
          return (
            <Card key={c.title} className="border-border/60">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Icon className={`h-3 w-3 ${c.color}`} />
                  {c.title}
                </div>
                {loading ? (
                  <Skeleton className="h-7 w-20 mt-1" />
                ) : (
                  <div className="text-lg font-bold mt-0.5">{c.value}</div>
                )}
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{c.sub}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Per provider */}
      {data?.byProvider && data.byProvider.some(p => p.requests > 0) && (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600" />
              แยกตามผู้ให้บริการ
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.byProvider.map(p => (
              <div key={p.id} className="rounded-lg border border-border/60 p-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{p.label}</span>
                  <Badge variant="outline" className="text-[10px]">{p.requests} คำขอ</Badge>
                </div>
                <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                  <span>โทเคน {p.tokens.toLocaleString()}</span>
                  <span>·</span>
                  <span>หัก {p.credits.toLocaleString()} cr</span>
                  <span>·</span>
                  <span>ต้นทุนค่าย {p.providerCredits.toLocaleString(undefined, { maximumFractionDigits: 4 })} cr</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Filters + table */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm">ประวัติการใช้งาน</CardTitle>
            <div className="flex flex-wrap gap-1">
              {FILTERS.map(f => (
                <Button
                  key={f.key}
                  size="sm"
                  variant={filter === f.key ? 'default' : 'outline'}
                  className="h-6 text-[10px]"
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : !data?.logs.length ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <AlertTriangle className="h-6 w-6 mx-auto mb-2 opacity-60" />
              ยังไม่มีประวัติการใช้งาน
              <div className="text-[10px] mt-1">ลองค้นหาคำถามภาษี หรืออัปโหลดเอกสารให้ AI ประมวลผล</div>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-xs min-w-[900px]">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                    <th className="py-2 px-2 font-medium">เวลา</th>
                    <th className="py-2 px-2 font-medium">งาน</th>
                    <th className="py-2 px-2 font-medium">รายละเอียด</th>
                    <th className="py-2 px-2 font-medium">เอนจิน</th>
                    <th className="py-2 px-2 font-medium">เจ้า / โปรโตคอล</th>
                    <th className="py-2 px-2 font-medium text-right">โทเคน</th>
                    <th className="py-2 px-2 font-medium text-right">เครดิต</th>
                    <th className="py-2 px-2 font-medium text-right">ต้นทุนค่าย</th>
                    <th className="py-2 px-2 font-medium text-right">เวลา</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map(l => (
                    <tr key={l.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                      <td className="py-2 px-2 whitespace-nowrap font-mono text-[10px]">{formatThaiDateTime(l.createdAt)}</td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          {l.kind === 'upload' ? (
                            <Upload className="h-3 w-3 text-violet-600" />
                          ) : (
                            <Search className="h-3 w-3 text-sky-600" />
                          )}
                          {l.action}
                        </span>
                      </td>
                      <td className="py-2 px-2 max-w-[280px] truncate" title={l.detail}>{l.detail}</td>
                      <td className="py-2 px-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${l.engine === 'ai' ? 'border-emerald-300 text-emerald-700 dark:text-emerald-400' : ''}`}
                        >
                          {l.engine === 'ai' ? 'AI' : l.engine === 'keyword' ? 'keyword' : '—'}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-[10px] whitespace-nowrap">
                        {l.providerLabel ?? '—'}{l.protocol ? ` · ${l.protocol}` : ''}
                      </td>
                      <td className="py-2 px-2 text-right font-mono">{l.tokens ? l.tokens.toLocaleString() : '—'}</td>
                      <td className="py-2 px-2 text-right font-mono">{l.credits || '—'}</td>
                      <td className="py-2 px-2 text-right font-mono">{l.providerCredits !== null ? l.providerCredits : '—'}</td>
                      <td className="py-2 px-2 text-right font-mono text-[10px]">{l.durationMs ? `${(l.durationMs / 1000).toFixed(1)}s` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-3 flex items-start gap-1">
            <Timer className="h-3 w-3 mt-0.5 shrink-0" />
            <span>
              “ต้นทุนค่าย” = เครดิตที่ผู้ให้บริการหักจริง (มีเฉพาะบางเจ้า เช่น kie.ai) · “เครดิต” = ที่ระบบหักผู้ใช้ ตามเรต 1 เครดิต : 1,000 tokens
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
