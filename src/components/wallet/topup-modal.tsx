'use client'

import * as React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Wallet, QrCode, Copy, CheckCircle2, Loader2, Clock, Coins, Gift, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { TOPUP_PRESETS } from '@/lib/types'
import { useAppState } from '@/lib/app-state'
import { formatThaiDateTime } from '@/lib/thai-date'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSuccess: (newBalance: number) => void
}

interface PendingTx {
  transactionId: string
  amount: number
  credits: number
  bonusCredits: number
  totalCredits: number
  promptPayRef: string
  qrPayload: string
  expiresAt: string
  paymentUrl: string
}

export function TopUpModal({ open, onOpenChange, onSuccess }: Props) {
  const { options } = useAppState()
  const presets = React.useMemo(() => {
    const fromDb = (options.topup_preset ?? []).map(o => ({
      amount: Number(o.meta?.amount ?? o.value),
      bonus: Number(o.meta?.bonus ?? 0),
      bonusPct: Number(o.meta?.bonusPct ?? 0),
      label: o.label,
    }))
    return fromDb.length > 0 ? fromDb : TOPUP_PRESETS
  }, [options])

  const [selectedAmount, setSelectedAmount] = React.useState<number>(500)
  const [customAmount, setCustomAmount] = React.useState<string>('')
  const [creating, setCreating] = React.useState(false)
  const [pending, setPending] = React.useState<PendingTx | null>(null)
  const [confirming, setConfirming] = React.useState(false)
  const [countdown, setCountdown] = React.useState<number>(0)
  const [history, setHistory] = React.useState<Array<{
    id: string
    amount: number
    credits: number
    bonusCredits: number
    status: string
    createdAt: string
    promptPayRef: string | null
  }>>([])

  // Countdown timer
  React.useEffect(() => {
    if (!pending) {
      setCountdown(0)
      return
    }
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(pending.expiresAt).getTime() - Date.now()) / 1000))
      setCountdown(remaining)
      if (remaining <= 0) {
        setPending(null)
        toast.warning('หมดเวลาชำระเงิน กรุณาสร้าง QR ใหม่')
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [pending])

  // Load history on open
  React.useEffect(() => {
    if (open) {
      loadHistory()
    } else {
      setPending(null)
      setCustomAmount('')
    }
  }, [open])

  async function loadHistory() {
    try {
      const res = await fetch('/api/wallet')
      const data = await res.json()
      setHistory(data.transactions || [])
    } catch {
      // ignore
    }
  }

  async function handleCreateTopUp(amount: number) {
    if (amount < 100) {
      toast.error('ยอดเติมขั้นต่ำ 100 บาท')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error)
      setPending(data)
      toast.success('สร้าง QR PromptPay แล้ว สแกนเพื่อชำระเงิน')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'สร้าง QR ไม่สำเร็จ')
    } finally {
      setCreating(false)
    }
  }

  async function handleConfirmPayment() {
    if (!pending) return
    setConfirming(true)
    try {
      const res = await fetch('/api/topup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: pending.transactionId, action: 'confirm' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'ยืนยันไม่สำเร็จ')
      toast.success(`เติมเงินสำเร็จ +${data.credited} ครีดิต`)
      onSuccess(data.wallet.balance)
      setPending(null)
      loadHistory()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ยืนยันไม่สำเร็จ')
    } finally {
      setConfirming(false)
    }
  }

  async function handleCancel() {
    if (!pending) return
    try {
      await fetch('/api/topup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: pending.transactionId, action: 'cancel' }),
      })
    } catch {
      // ignore
    }
    setPending(null)
  }

  function copyRef() {
    if (!pending) return
    navigator.clipboard.writeText(pending.promptPayRef)
    toast.success('คัดลอกเลขอ้างอิงแล้ว')
  }

  function copyPayload() {
    if (!pending) return
    navigator.clipboard.writeText(pending.qrPayload)
    toast.success('คัดลอก QR Payload แล้ว')
  }

  const minutes = Math.floor(countdown / 60)
  const seconds = countdown % 60
  const timeLeft = `${minutes}:${seconds.toString().padStart(2, '0')}`

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!confirming) onOpenChange(v) }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4 text-emerald-600" />
            เติมเครดิตผ่าน PromptPay
          </DialogTitle>
          <DialogDescription>
            1 บาท = 1 ครีดิต · ยอดเติมยิ่งสูง โบนัสยิ่งเพิ่ม · ชำระผ่าน QR ทุกธนาคาร
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="topup" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="topup">เติมเงิน</TabsTrigger>
            <TabsTrigger value="history">ประวัติ ({history.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="topup" className="flex-1 overflow-y-auto scrollbar-thin -mx-1 px-1">
            {!pending ? (
              <div className="space-y-4 py-2">
                {/* Preset amounts */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">เลือกแพ็คเกจ</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {presets.map((p) => {
                      const isActive = selectedAmount === p.amount && !customAmount
                      return (
                        <button
                          key={p.amount}
                          onClick={() => { setSelectedAmount(p.amount); setCustomAmount('') }}
                          className={`p-3 rounded-lg border-2 transition-all text-center relative ${
                            isActive
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                              : 'border-border hover:border-emerald-300'
                          }`}
                        >
                          {p.bonusPct > 0 && (
                            <Badge variant="secondary" className="absolute -top-2 -right-1 text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                              +{p.bonusPct}%
                            </Badge>
                          )}
                          <div className="text-base font-bold text-emerald-700 dark:text-emerald-400">฿{p.amount}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{p.label}</div>
                          {p.bonus > 0 && (
                            <div className="text-[10px] text-amber-600 mt-1 flex items-center justify-center gap-0.5">
                              <Gift className="h-2.5 w-2.5" />+{p.bonus} cr
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Custom amount */}
                <div>
                  <Label htmlFor="custom-amount" className="text-xs text-muted-foreground mb-2 block">
                    หรือระบุยอดเอง (ขั้นต่ำ 100 บาท)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">฿</span>
                    <Input
                      id="custom-amount"
                      type="number"
                      min={100}
                      step={50}
                      placeholder="เช่น 300"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      className="pl-7"
                    />
                  </div>
                </div>

                {/* Bonus info */}
                {(() => {
                  const amt = customAmount ? parseInt(customAmount) : selectedAmount
                  if (!amt || amt < 100) return null
                  let bonus = 0
                  let pct = 0
                  if (amt >= 1000) { bonus = Math.floor(amt * 0.15); pct = 15 }
                  else if (amt >= 500) { bonus = Math.floor(amt * 0.10); pct = 10 }
                  else if (amt >= 200) { bonus = Math.floor(amt * 0.05); pct = 5 }
                  return (
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                          <Gift className="h-3.5 w-3.5" />
                          โบนัสเครดิต {pct}%
                        </span>
                        <span className="font-semibold text-amber-700 dark:text-amber-400">+{bonus} cr</span>
                      </div>
                      <Separator className="my-2 bg-amber-200/50 dark:bg-amber-900/50" />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">ยอดที่จะได้รับทั้งหมด</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">{amt + bonus} ครีดิต</span>
                      </div>
                    </div>
                  )
                })()}

                <Button
                  onClick={() => handleCreateTopUp(customAmount ? parseInt(customAmount) : selectedAmount)}
                  disabled={creating || (!customAmount && !selectedAmount) || (customAmount ? parseInt(customAmount) < 100 : selectedAmount < 100)}
                  className="w-full h-11"
                  size="lg"
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      กำลังสร้าง QR...
                    </>
                  ) : (
                    <>
                      <QrCode className="h-4 w-4 mr-2" />
                      สร้าง QR PromptPay
                    </>
                  )}
                </Button>

                <div className="text-xs text-muted-foreground text-center space-y-1">
                  <p>💡 ระบบจำลอง PromptPay Dynamic QR · กด &quot;ยืนยันการชำระ&quot; เพื่อทดสอบ</p>
                  <p>ในการใช้งานจริง เชื่อมต่อกับ PromptPay API หรือ SlipOK</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-2">
                {/* QR display */}
                <div className="flex flex-col items-center gap-3 p-4 rounded-lg bg-muted/40 border border-border/60">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    QR หมดอายุใน <span className="font-mono font-semibold text-rose-600">{timeLeft}</span>
                  </div>

                  {/* Fake QR display */}
                  <div className="w-44 h-44 bg-white border-4 border-emerald-500 rounded-lg flex items-center justify-center relative">
                    <div className="absolute inset-2 grid grid-cols-12 grid-rows-12 gap-px">
                      {Array.from({ length: 144 }).map((_, i) => {
                        // Pseudo-random pattern based on qrPayload
                        const hash = (pending.qrPayload.charCodeAt(i % pending.qrPayload.length) + i * 7) % 3
                        return hash === 0 ? <div key={i} className="bg-black rounded-[1px]" /> : null
                      })}
                    </div>
                    {/* Corner markers */}
                    <div className="absolute top-1 left-1 w-8 h-8 border-t-4 border-l-4 border-black" />
                    <div className="absolute top-1 right-1 w-8 h-8 border-t-4 border-r-4 border-black" />
                    <div className="absolute bottom-1 left-1 w-8 h-8 border-b-4 border-l-4 border-black" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-white p-1 rounded">
                        <Wallet className="h-6 w-6 text-emerald-600" />
                      </div>
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">฿{pending.amount}</div>
                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                      <Sparkles className="h-3 w-3" />
                      ได้รับ {pending.totalCredits} ครีดิต (รวมโบนัส {pending.bonusCredits})
                    </div>
                  </div>

                  <button
                    onClick={copyRef}
                    className="text-xs font-mono px-2 py-1 rounded bg-muted hover:bg-muted-foreground/20 transition-colors flex items-center gap-1.5"
                  >
                    <Copy className="h-3 w-3" />
                    {pending.promptPayRef}
                  </button>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={handleCancel} disabled={confirming}>
                    <X className="h-4 w-4 mr-2" />
                    ยกเลิก
                  </Button>
                  <Button onClick={handleConfirmPayment} disabled={confirming} className="bg-emerald-600 hover:bg-emerald-700">
                    {confirming ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        กำลังยืนยัน...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        ยืนยันการชำระ (ทดสอบ)
                      </>
                    )}
                  </Button>
                </div>

                <button
                  onClick={copyPayload}
                  className="w-full text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
                >
                  <Copy className="h-2.5 w-2.5" />
                  คัดลอก QR Payload (สำหรับทดสอบ)
                </button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="flex-1 overflow-y-auto scrollbar-thin -mx-1 px-1">
            <ScrollArea className="max-h-[28rem]">
              <div className="space-y-2 py-2">
                {history.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-8">ยังไม่มีประวัติการเติมเงิน</div>
                )}
                {history.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 p-3 rounded-md border border-border/60 hover:bg-muted/40 transition-colors">
                    <div className="p-1.5 rounded bg-muted">
                      <Coins className="h-3.5 w-3.5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">฿{tx.amount}</span>
                        <span className="text-xs text-muted-foreground">→</span>
                        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{tx.credits + tx.bonusCredits} cr</span>
                        {tx.bonusCredits > 0 && (
                          <Badge variant="secondary" className="text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                            +{tx.bonusCredits} โบนัส
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {tx.promptPayRef} · {formatThaiDateTime(tx.createdAt)}
                      </div>
                    </div>
                    <Badge variant="outline" className={
                      tx.status === 'paid'
                        ? 'text-emerald-600 border-emerald-200 dark:border-emerald-900'
                        : tx.status === 'pending'
                        ? 'text-amber-600 border-amber-200 dark:border-amber-900'
                        : 'text-muted-foreground'
                    }>
                      {tx.status === 'paid' ? 'สำเร็จ' : tx.status === 'pending' ? 'รอชำระ' : 'หมดอายุ'}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirming || creating}>
            ปิด
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
