'use client'

import * as React from 'react'
import { Header } from '@/components/layout/header'
import { Sidebar, MobileNav, type ViewKey } from '@/components/layout/sidebar'
import { TopUpModal } from '@/components/wallet/topup-modal'
import { DashboardView } from '@/components/views/dashboard-view'
import { ProfileView } from '@/components/views/profile-view'
import { UploadView } from '@/components/views/upload-view'
import { DocumentsView } from '@/components/views/documents-view'

export default function HomePage() {
  const [activeView, setActiveView] = React.useState<ViewKey>('dashboard')
  const [topUpOpen, setTopUpOpen] = React.useState(false)
  const [balance, setBalance] = React.useState<number>(0)
  const [userName, setUserName] = React.useState<string | null>(null)
  const [userRole, setUserRole] = React.useState<string | null>(null)
  const [userLoading, setUserLoading] = React.useState(true)

  // Load user info once on mount
  React.useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(data => {
        setBalance(data.wallet?.balance ?? 0)
        setUserName(data.user?.name ?? null)
        setUserRole(data.user?.role ?? null)
      })
      .catch(() => {})
      .finally(() => setUserLoading(false))
  }, [])

  // Scroll to top on view change
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activeView])

  function handleTopUpSuccess(newBalance: number) {
    setBalance(newBalance)
    setTopUpOpen(false)
  }

  function handleCreditsChange(newBalance: number) {
    setBalance(newBalance)
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header
        balance={balance}
        userName={userName}
        userRole={userRole}
        loading={userLoading}
        onTopUp={() => setTopUpOpen(true)}
        activeView={activeView}
        onNavigate={setActiveView}
      />

      <div className="flex flex-1">
        <Sidebar
          active={activeView}
          onChange={setActiveView}
          balance={balance}
          userName={userName}
          loading={userLoading}
          onTopUp={() => setTopUpOpen(true)}
        />

        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-6 space-y-6 max-w-7xl mx-auto w-full">
          {activeView === 'dashboard' && (
            <DashboardView
              balance={balance}
              onTopUpNeeded={() => setTopUpOpen(true)}
              onCreditsChange={handleCreditsChange}
            />
          )}
          {activeView === 'profile' && <ProfileView />}
          {activeView === 'upload' && (
            <UploadView
              balance={balance}
              onTopUpNeeded={() => setTopUpOpen(true)}
              onCreditsChange={handleCreditsChange}
            />
          )}
          {activeView === 'documents' && <DocumentsView />}
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
      <MobileNav active={activeView} onChange={setActiveView} />

      <TopUpModal
        open={topUpOpen}
        onOpenChange={setTopUpOpen}
        onSuccess={handleTopUpSuccess}
      />
    </div>
  )
}
