'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { User, Mail, Building2, Briefcase, Save, Loader2, Wallet, TrendingUp, ShieldCheck, Search, Calendar, Award, Activity, Coins, Crown } from 'lucide-react'
import { toast } from 'sonner'
import { useAppState } from '@/lib/app-state'
import { formatThaiDate } from '@/lib/thai-date'

interface ProfileData {
  user: {
    id: string
    email: string
    name: string | null
    role: string
    company: string | null
    createdAt: string
  }
  wallet: {
    balance: number
    totalTopUp: number
    totalUsed: number
    bonusCredits: number
  } | null
  counts: {
    totalSearches: number
    totalTopUps: number
    totalActions: number
  }
  usage: {
    totalCreditsUsed: number
    successCount: number
    noMatchCount: number
    successRate: number
    actionsThisWeek: number
    creditsThisWeek: number
  }
  tier: { name: string; color: string; icon: string; totalUsed: number }
  topActions: Array<{ action: string; count: number; credits: number }>
}

const ROLE_OPTIONS = [
  { value: 'user', label: 'ผู้ใช้ทั่วไป' },
  { value: 'accountant', label: 'นักบัญชี' },
  { value: 'lawyer', label: 'ทนายความ' },
  { value: 'admin', label: 'ผู้ดูแลระบบ' },
]

const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  gray: { bg: 'bg-slate-50 dark:bg-slate-950/40', text: 'text-slate-700 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-900' },
  slate: { bg: 'bg-slate-50 dark:bg-slate-950/40', text: 'text-slate-700 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-900' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-900' },
  violet: { bg: 'bg-violet-50 dark:bg-violet-950/40', text: 'text-violet-700 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-900' },
  cyan: { bg: 'bg-cyan-50 dark:bg-cyan-950/40', text: 'text-cyan-700 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-900' },
}

const ACTION_LABELS: Record<string, string> = {
  search_basic: 'Basic Search',
  search_deep: 'Deep Analysis',
  search_audit: 'Document Audit',
  search_basic_no_match: 'Basic (ไม่พบ)',
  search_deep_no_match: 'Deep (ไม่พบ)',
  search_audit_no_match: 'Audit (ไม่พบ)',
  topup: 'เติมเครดิต',
  upload_law_doc: 'อัปโหลดกฎหมาย',
  view_doc: 'ดูเอกสาร',
}

export function ProfileView() {
  const { options } = useAppState()
  const roleOptions = options.role?.length ? options.role : ROLE_OPTIONS
  const [data, setData] = React.useState<ProfileData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState({ name: '', company: '', role: 'accountant' })

  async function load() {
    try {
      const res = await fetch('/api/profile')
      const json = await res.json()
      setData(json)
      setForm({
        name: json.user.name || '',
        company: json.user.company || '',
        role: json.user.role || 'user',
      })
    } catch {
      toast.error('โหลดข้อมูลโปรไฟล์ไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { load() }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success('บันทึกข้อมูลโปรไฟล์สำเร็จ')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 h-96 animate-pulse bg-muted/40" />
        <Card className="h-96 animate-pulse bg-muted/40" />
      </div>
    )
  }

  const tierColor = TIER_COLORS[data.tier.color] || TIER_COLORS.gray
  const initials = (data.user.name || 'User').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="space-y-6">
      {/* Header card */}
      <Card className={`border-2 ${tierColor.border} ${tierColor.bg}`}>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4 flex-wrap">
            <Avatar className="h-16 w-16 border-2 border-background shadow-md">
              <AvatarFallback className={`bg-gradient-to-br from-emerald-500 to-emerald-700 text-white text-xl font-bold`}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold">{data.user.name || 'ผู้ใช้'}</h2>
                <Badge variant="outline" className={`${tierColor.bg} ${tierColor.text} ${tierColor.border}`}>
                  <Crown className="h-3 w-3 mr-1" />
                  {data.tier.name}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                <Mail className="h-3.5 w-3.5" />
                {data.user.email}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-3 mt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {roleOptions.find(r => r.value === data.user.role)?.label || data.user.role}
                </span>
                {data.user.company && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {data.user.company}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  เข้าร่วมเมื่อ {formatThaiDate(data.user.createdAt)}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">เครดิตคงเหลือ</div>
              <div className="text-2xl font-bold text-emerald-600">{data.wallet?.balance?.toLocaleString() ?? 0}</div>
              <div className="text-[10px] text-muted-foreground">credits</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Edit form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-emerald-600" />
              แก้ไขข้อมูลส่วนตัว
            </CardTitle>
            <CardDescription>ข้อมูลนี้จะใช้สำหรับการออกใบเสร็จและการติดต่อ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs">ชื่อ-นามสกุล</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="สมชาย บัญชี"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs">อีเมล (ไม่สามารถแก้ไขได้)</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    value={data.user.email}
                    disabled
                    className="pl-9 bg-muted/40"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company" className="text-xs">บริษัท / สำนักงาน</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="company"
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    placeholder="สำนักงานบัญชี ABC"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">ประเภทผู้ใช้</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t bg-muted/20 justify-end gap-2">
            <Button variant="outline" onClick={load} disabled={saving}>ยกเลิก</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  บันทึกข้อมูล
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Wallet card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-emerald-600" />
              Wallet ของฉัน
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-white">
              <div className="text-[10px] uppercase tracking-wider opacity-90">ยอดคงเหลือ</div>
              <div className="text-3xl font-bold mt-0.5">{data.wallet?.balance?.toLocaleString() ?? 0}</div>
              <div className="text-[10px] opacity-80">credits (1 cr = 1 บาท)</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-md bg-muted/40">
                <div className="text-muted-foreground">เติมรวม</div>
                <div className="font-semibold text-emerald-600">{(data.wallet?.totalTopUp ?? 0).toLocaleString()}</div>
              </div>
              <div className="p-2 rounded-md bg-muted/40">
                <div className="text-muted-foreground">ใช้ไป</div>
                <div className="font-semibold text-rose-600">{(data.wallet?.totalUsed ?? 0).toLocaleString()}</div>
              </div>
              <div className="p-2 rounded-md bg-amber-50 dark:bg-amber-950/30">
                <div className="text-muted-foreground">โบนัส</div>
                <div className="font-semibold text-amber-600">{(data.wallet?.bonusCredits ?? 0).toLocaleString()}</div>
              </div>
              <div className="p-2 rounded-md bg-muted/40">
                <div className="text-muted-foreground">ครั้งที่เติม</div>
                <div className="font-semibold">{data.counts.totalTopUps}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <Search className="h-4 w-4 text-emerald-600" />
              <span className="text-2xl font-bold">{data.counts.totalSearches}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-2">การค้นหาทั้งหมด</div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <ShieldCheck className="h-4 w-4 text-sky-600" />
              <span className="text-2xl font-bold text-sky-600">{data.usage.successRate}%</span>
            </div>
            <div className="text-xs text-muted-foreground mt-2">อัตราความสำเร็จ</div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <Coins className="h-4 w-4 text-amber-600" />
              <span className="text-2xl font-bold text-amber-600">{data.usage.totalCreditsUsed.toLocaleString()}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-2">เครดิตที่ใช้ตลอดกาล</div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <Activity className="h-4 w-4 text-violet-600" />
              <span className="text-2xl font-bold text-violet-600">{data.usage.actionsThisWeek}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-2">การกระทำ 7 วันล่าสุด</div>
          </CardContent>
        </Card>
      </div>

      {/* Top actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            กิจกรรมการใช้งาน
          </CardTitle>
          <CardDescription>สรุปการกระทำทั้งหมดในระบบ แยกตามประเภท</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.topActions.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6">ยังไม่มีกิจกรรม</div>
            )}
            {data.topActions.map((a, i) => {
              const label = ACTION_LABELS[a.action] || a.action
              const isPositive = a.credits > 0
              const isTopup = a.action === 'topup'
              return (
                <div key={i} className="flex items-center gap-3 p-3 rounded-md bg-muted/40 hover:bg-muted/70 transition-colors">
                  <div className="text-xs font-mono text-muted-foreground w-6">#{i + 1}</div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">{a.count} ครั้ง</div>
                  </div>
                  <Badge variant="outline" className={isTopup ? 'text-emerald-600 border-emerald-200' : isPositive ? 'text-rose-600 border-rose-200' : 'text-muted-foreground'}>
                    {isTopup ? '+' : isPositive ? '-' : ''}{Math.abs(a.credits).toLocaleString()} cr
                  </Badge>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
