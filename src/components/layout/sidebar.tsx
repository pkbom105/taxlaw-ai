'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Scale, LayoutDashboard, User, Upload, FileText, Wallet, ShieldCheck, Settings, Activity } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export type ViewKey = 'dashboard' | 'profile' | 'upload' | 'documents' | 'ai-log' | 'settings'

interface MenuItem {
  key: ViewKey
  href: string
  label: string
  description: string
  icon: React.ElementType
  color: string
  short?: string
}

const MENU: MenuItem[] = [
  { key: 'dashboard', href: '/dashboard', label: 'Dashboard', description: 'ภาพรวมระบบ', icon: LayoutDashboard, color: 'emerald' },
  { key: 'profile', href: '/profile', label: 'โปรไฟล์', description: 'ข้อมูลผู้ใช้ + Wallet', icon: User, color: 'sky' },
  { key: 'upload', href: '/upload', label: 'อัปโหลดเอกสาร', description: 'ตรวจสอบ Tax Compliance', icon: Upload, color: 'amber' },
  { key: 'documents', href: '/documents', label: 'คลังกฎหมาย', description: 'แยกตาม 6 หมวด', icon: FileText, color: 'violet' },
  { key: 'ai-log', href: '/ai-log', label: 'AI log Usage', description: 'ประวัติใช้ AI + โทเคน', icon: Activity, color: 'rose', short: 'AI log' },
  { key: 'settings', href: '/settings', label: 'ตั้งค่า', description: 'หมวดหมู่เอกสาร', icon: Settings, color: 'cyan' },
]

interface Props {
  balance: number | null
  userName: string | null
  loading: boolean
  onTopUp: () => void
}

export function Sidebar({ balance, userName, loading, onTopUp }: Props) {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-sidebar/60 backdrop-blur-sm sticky top-[5.5rem] self-start max-h-[calc(100vh-5.5rem)]">
      {/* Logo + brand */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500/20 blur-md rounded-full" />
            <div className="relative p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-white">
              <Scale className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight leading-none">
              TaxLaw <span className="text-emerald-600">AI</span>
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
              <ShieldCheck className="h-2.5 w-2.5" />
              Zero-Hallucination
            </div>
          </div>
        </div>
      </div>

      {/* Menu items */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5">
          เมนูหลัก
        </div>
        {MENU.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                'w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-sm transition-all group',
                isActive
                  ? `bg-${item.color}-50 dark:bg-${item.color}-950/40 text-${item.color}-700 dark:text-${item.color}-400 font-medium`
                  : 'text-foreground/80 hover:bg-muted hover:text-foreground'
              )}
            >
              <div className={cn(
                'p-1.5 rounded-md transition-colors',
                isActive
                  ? `bg-${item.color}-100 dark:bg-${item.color}-900/40`
                  : 'bg-muted/60 group-hover:bg-muted'
              )}>
                <Icon className={cn('h-3.5 w-3.5', isActive && `text-${item.color}-600 dark:text-${item.color}-400`)} />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm leading-tight">{item.label}</div>
                <div className="text-[10px] text-muted-foreground">{item.description}</div>
              </div>
              {isActive && (
                <div className={`w-1 h-6 rounded-full bg-${item.color}-500`} />
              )}
            </Link>
          )
        })}

        <div className="pt-4">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5">
            สถานะระบบ
          </div>
          <div className="px-2 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">ฐานข้อมูล</span>
              <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900">
                Online
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">RAG Engine</span>
              <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900">
                Active
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">PromptPay</span>
              <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900">
                Sandbox
              </Badge>
            </div>
          </div>
        </div>
      </nav>

      {/* Wallet card */}
      <div className="p-3 border-t border-border">
        <div className="rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 p-3 text-white">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-90">
            <Wallet className="h-3 w-3" />
            Wallet
          </div>
          {loading ? (
            <Skeleton className="h-7 w-24 bg-white/20 mt-1" />
          ) : (
            <div className="text-xl font-bold mt-0.5">
              {balance?.toLocaleString() ?? 0}
              <span className="text-xs font-normal opacity-80 ml-1">credits</span>
            </div>
          )}
          <div className="text-[10px] opacity-80 mt-1">
            {loading ? <Skeleton className="h-2.5 w-20 bg-white/20" /> : userName}
          </div>
          <Button
            onClick={onTopUp}
            size="sm"
            className="w-full mt-2.5 h-7 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
          >
            <Upload className="h-3 w-3 mr-1" />
            เติมเครดิต
          </Button>
        </div>
      </div>
    </aside>
  )
}

// Mobile bottom nav for small screens
export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur border-t border-border">
      <div className="grid grid-cols-6 gap-1 p-1.5">
        {MENU.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 py-1.5 rounded-md text-[10px] transition-colors',
                isActive ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' : 'text-muted-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.short ?? item.label.split(' ')[0]}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
