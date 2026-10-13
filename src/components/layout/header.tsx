'use client'

import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Scale, Wallet, Plus, ShieldCheck, Database, Phone } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { ViewKey } from '@/components/layout/sidebar'

interface Props {
  balance: number | null
  userName: string | null
  userRole: string | null
  loading: boolean
  onTopUp: () => void
  activeView: ViewKey
  onNavigate: (v: ViewKey) => void
}

const VIEW_TITLES: Record<ViewKey, { title: string; sub: string }> = {
  dashboard: { title: 'Dashboard', sub: 'ภาพรวมระบบ' },
  profile: { title: 'โปรไฟล์', sub: 'ข้อมูลผู้ใช้' },
  upload: { title: 'อัปโหลด', sub: 'ตรวจสอบเอกสาร' },
  documents: { title: 'คลังกฎหมาย', sub: 'แยกตามหมวด' },
}

export function Header({ balance, userName, userRole, loading, onTopUp, activeView, onNavigate }: Props) {
  const roleLabels: Record<string, string> = {
    user: 'ผู้ใช้ทั่วไป',
    accountant: 'นักบัญชี',
    lawyer: 'ทนายความ',
    admin: 'ผู้ดูแลระบบ',
  }
  const viewMeta = VIEW_TITLES[activeView]

  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo + current view (mobile shows logo + view title) */}
        <div className="flex items-center gap-3">
          {/* Mobile logo - tap to go dashboard */}
          <button
            onClick={() => onNavigate('dashboard')}
            className="lg:hidden relative"
            aria-label="Go to dashboard"
          >
            <div className="absolute inset-0 bg-emerald-500/20 blur-md rounded-full" />
            <div className="relative p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-white">
              <Scale className="h-5 w-5" />
            </div>
          </button>

          {/* Desktop logo */}
          <div className="hidden lg:flex items-center gap-2.5">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 blur-md rounded-full" />
              <div className="relative p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-white">
                <Scale className="h-5 w-5" />
              </div>
            </div>
            <div>
              <div className="text-base font-bold tracking-tight leading-none">
                TaxLaw <span className="text-emerald-600">AI</span>
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <ShieldCheck className="h-2.5 w-2.5" />
                Zero-Hallucination RAG
              </div>
            </div>
          </div>

          {/* Current view title (mobile) */}
          <div className="lg:hidden">
            <div className="text-sm font-semibold leading-tight">{viewMeta.title}</div>
            <div className="text-[10px] text-muted-foreground">{viewMeta.sub}</div>
          </div>
        </div>

        {/* Status badges (desktop only) */}
        <div className="hidden lg:flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900">
            <Database className="h-3 w-3" />
            6 หมวด · 20+ มาตรา
          </Badge>
          <Badge variant="outline" className="gap-1.5 bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-900">
            <ShieldCheck className="h-3 w-3" />
            rd.go.th · krisdika.go.th
          </Badge>
        </div>

        {/* Right side: user + wallet */}
        <div className="flex items-center gap-3">
          {/* User info - desktop only */}
          <div className="hidden sm:block text-right">
            {loading ? (
              <Skeleton className="h-3 w-28 mb-1" />
            ) : (
              <div className="text-xs font-medium leading-tight">{userName}</div>
            )}
            {loading ? (
              <Skeleton className="h-2.5 w-20" />
            ) : (
              <div className="text-[10px] text-muted-foreground">{roleLabels[userRole || 'user'] || 'ผู้ใช้'}</div>
            )}
          </div>

          {/* Wallet */}
          {loading ? (
            <Skeleton className="h-9 w-28 rounded-md" />
          ) : (
            <Button
              variant="outline"
              onClick={onTopUp}
              className="h-9 gap-2 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900 dark:hover:bg-emerald-950/50"
            >
              <Wallet className="h-4 w-4 text-emerald-600" />
              <div className="flex items-baseline gap-1">
                <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">{balance?.toLocaleString() ?? 0}</span>
                <span className="text-[10px] text-muted-foreground hidden sm:inline">cr</span>
              </div>
              <Plus className="h-3.5 w-3.5 text-emerald-600" />
            </Button>
          )}
        </div>
      </div>

      {/* Compliance strip - desktop only */}
      <div className="hidden lg:block bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-600 text-white text-[10px] py-1 px-4 text-center flex items-center justify-center gap-3 flex-wrap">
        <span className="flex items-center gap-1">
          <ShieldCheck className="h-2.5 w-2.5" />
          ตอบจาก Context ที่ดึงมาเท่านั้น
        </span>
        <span>·</span>
        <span>อ้างอิงมาตรา + หน้า PDF ทุกประโยค</span>
        <span>·</span>
        <span>หากไม่พบในเอกสาร จะแจ้งว่า &quot;ไม่พบข้อมูล&quot;</span>
        <span className="hidden xl:inline">·</span>
        <span className="hidden xl:flex items-center gap-1">
          <Phone className="h-2.5 w-2.5" />
          สนับสนุน 088-888-8888
        </span>
      </div>
    </header>
  )
}
