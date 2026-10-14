'use client'

import { DashboardView } from '@/components/views/dashboard-view'
import { useAppState } from '@/lib/app-state'

export default function DashboardPage() {
  const { balance, setTopUpOpen, handleCreditsChange } = useAppState()

  return (
    <DashboardView
      balance={balance}
      onTopUpNeeded={() => setTopUpOpen(true)}
      onCreditsChange={handleCreditsChange}
    />
  )
}
