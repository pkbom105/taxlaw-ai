'use client'

import { UploadView } from '@/components/views/upload-view'
import { useAppState } from '@/lib/app-state'

export default function UploadPage() {
  const { balance, setTopUpOpen, handleCreditsChange } = useAppState()

  return (
    <UploadView
      balance={balance}
      onTopUpNeeded={() => setTopUpOpen(true)}
      onCreditsChange={handleCreditsChange}
    />
  )
}
