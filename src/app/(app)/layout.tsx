'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Sidebar, MobileNav } from '@/components/layout/sidebar'
import { TopUpModal } from '@/components/wallet/topup-modal'
import { AppStateProvider, useAppState } from '@/lib/app-state'

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const {
    balance,
    userName,
    userRole,
    userLoading,
    topUpOpen,
    setTopUpOpen,
    handleTopUpSuccess,
  } = useAppState()

  // Scroll to top on page change
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [pathname])

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header
        balance={balance}
        userName={userName}
        userRole={userRole}
        loading={userLoading}
        onTopUp={() => setTopUpOpen(true)}
      />

      <div className="flex flex-1">
        <Sidebar
          balance={balance}
          userName={userName}
          loading={userLoading}
          onTopUp={() => setTopUpOpen(true)}
        />

        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-6 space-y-6 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      <footer className="hidden lg:block border-t border-border bg-muted/30 mt-auto">
        <div className="px-4 sm:px-6 lg:px-8 py-4 max-w-7xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">TaxLaw AI</span>
              <span>·</span>
              <span>ระบบค้นหากฎหมายภาษีไทย ปี 2026–2027</span>
            </div>
            <div className="flex items-center gap-3">
              <span>ข้อมูลอ้างอิง: กรมสรรพากร · กฤษฎีกา · ราชกิจจานุเบกษา</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile bottom nav */}
      <MobileNav />

      <TopUpModal
        open={topUpOpen}
        onOpenChange={setTopUpOpen}
        onSuccess={handleTopUpSuccess}
      />
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppStateProvider>
      <Shell>{children}</Shell>
    </AppStateProvider>
  )
}
