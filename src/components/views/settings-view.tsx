'use client'

import * as React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Scale, Landmark, BookOpen, Gavel, Calculator, Globe, FileText, Layers,
  Plus, Pencil, Trash2, Loader2, Settings as SettingsIcon, Save, SlidersHorizontal,
  Eye, EyeOff, PlugZap, Coins, Activity,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAppState } from '@/lib/app-state'
import { CATEGORY_ICONS, CATEGORY_COLORS } from '@/lib/category-visuals'
import { OPTION_GROUPS, DEFAULT_OPTIONS } from '@/lib/option-defaults'
import {
  AI_PRICE_BASELINE_ID,
  AI_PRICING_SOURCE,
  AI_PRICING_UPDATED,
  AI_TIER_LIST,
  TOKENS_PER_CREDIT,
  findModelOption,
  modelGroupsForProvider,
  priceRatioVs,
  providerSettingKeys,
} from '@/lib/ai-pricing'
import type { CategoryRecord, OptionRecord } from '@/lib/types'

const ICONS: Record<string, React.ElementType> = {
  ...CATEGORY_ICONS,
  scale: Scale,
  landmark: Landmark,
  'book-open': BookOpen,
  gavel: Gavel,
  calculator: Calculator,
  globe: Globe,
}

const ICON_OPTIONS: Array<{ value: string; label: string }> = DEFAULT_OPTIONS
  .filter(o => o.group === 'category_icon')
  .map(o => ({ value: o.value, label: o.label }))

const COLOR_OPTIONS: Array<{ value: string; label: string }> = DEFAULT_OPTIONS
  .filter(o => o.group === 'category_color')
  .map(o => ({ value: o.value, label: o.label }))

const COLOR_CLASSES: Record<string, { bg: string; text: string; border: string }> = {
  ...CATEGORY_COLORS,
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-900' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-900' },
  sky: { bg: 'bg-sky-50 dark:bg-sky-950/40', text: 'text-sky-700 dark:text-sky-400', border: 'border-sky-200 dark:border-sky-900' },
  rose: { bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-900' },
  violet: { bg: 'bg-violet-50 dark:bg-violet-950/40', text: 'text-violet-700 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-900' },
  cyan: { bg: 'bg-cyan-50 dark:bg-cyan-950/40', text: 'text-cyan-700 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-900' },
}

interface FormState {
  id: string | null
  value: string
  label: string
  short: string
  description: string
  icon: string
  color: string
}

const EMPTY_FORM: FormState = {
  id: null,
  value: '',
  label: '',
  short: '',
  description: '',
  icon: 'scale',
  color: 'emerald',
}

// ---- form option lists (dropdown ตัวเลือกของทั้งระบบ) ----
interface OptionFormState {
  id: string | null
  group: string
  value: string
  label: string
  meta: Record<string, unknown>
}

const EMPTY_OPTION_FORM: OptionFormState = {
  id: null,
  group: 'law_type',
  value: '',
  label: '',
  meta: {},
}

interface ProviderView {
  id: string
  label: string
  hint: string
  presetUrl: string
  presetModel: string
  url: string
  model: string
  protocol: string
  hasKey: boolean
  masked: string
  updatedAt: string | null
  active: boolean
}

interface ApiUsage {
  days: number
  queries: number
  tokens: number
  credits: number
  balance: number
}

function optionMetaSummary(group: string, o: OptionRecord): string {
  const meta = (o.meta ?? {}) as Record<string, unknown>
  if (group === 'search_mode') {
    return `${Number(meta.credits ?? 0)} เครดิต · ${String(meta.description ?? '')}`
  }
  if (group === 'topup_preset') {
    return `฿${Number(meta.amount ?? 0)} · โบนัส +${Number(meta.bonus ?? 0)} cr (${Number(meta.bonusPct ?? 0)}%)`
  }
  return ''
}

export function SettingsView() {
  const { categories, categoriesLoading, refreshCategories, options, optionsLoading, refreshOptions } = useAppState()

  const iconChoices = options.category_icon?.length ? options.category_icon : ICON_OPTIONS
  const colorChoices = options.category_color?.length ? options.category_color : COLOR_OPTIONS
  const [formOpen, setFormOpen] = React.useState(false)
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<CategoryRecord | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  const isEdit = form.id !== null

  function openCreate() {
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEdit(c: CategoryRecord) {
    setForm({
      id: c.id,
      value: c.value,
      label: c.label,
      short: c.short,
      description: c.description,
      icon: c.icon,
      color: c.color,
    })
    setFormOpen(true)
  }

  async function handleSave() {
    if (!form.label.trim()) {
      toast.error('กรุณากรอกชื่อหมวด')
      return
    }
    if (!form.short.trim()) {
      toast.error('กรุณากรอกตัวย่อ')
      return
    }
    if (!isEdit && !/^[a-z0-9_]{2,40}$/.test(form.value.trim().toLowerCase())) {
      toast.error('รหัสหมวดใช้ได้เฉพาะ a-z, 0-9, _ ความยาว 2-40 ตัว')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(isEdit ? `/api/categories/${form.id}` : '/api/categories', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: form.value.trim().toLowerCase(),
          label: form.label.trim(),
          short: form.short.trim(),
          description: form.description.trim(),
          icon: form.icon,
          color: form.color,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'บันทึกไม่สำเร็จ')
        return
      }
      await refreshCategories()
      toast.success(isEdit ? 'แก้ไขหมวดหมู่แล้ว' : 'เพิ่มหมวดหมู่แล้ว')
      setFormOpen(false)
    } catch {
      toast.error('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/categories/${deleteTarget.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'ลบไม่สำเร็จ')
        return
      }
      await refreshCategories()
      toast.success(`ลบหมวด "${deleteTarget.label}" แล้ว`)
      setDeleteTarget(null)
    } catch {
      toast.error('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ')
    } finally {
      setDeleting(false)
    }
  }

  // ---- OpenAI Compatibility (ผู้ให้บริการ + Base URL + API key + AI Model) ----
  const [apiProviders, setApiProviders] = React.useState<ProviderView[]>([])
  const [apiActive, setApiActive] = React.useState('')
  const [apiProvider, setApiProvider] = React.useState('')
  const [apiUrl, setApiUrl] = React.useState('')
  const [apiUrlDefault, setApiUrlDefault] = React.useState('')
  const [apiKeyInput, setApiKeyInput] = React.useState('')
  const [apiKeyMasked, setApiKeyMasked] = React.useState('')
  const [apiKeySet, setApiKeySet] = React.useState(false)
  const [apiLoading, setApiLoading] = React.useState(true)
  const [apiSaving, setApiSaving] = React.useState(false)
  const [showApiKey, setShowApiKey] = React.useState(false)
  const [apiModel, setApiModel] = React.useState('')
  const [apiModelDefault, setApiModelDefault] = React.useState('')
  const [apiProtocol, setApiProtocol] = React.useState('auto')
  const [apiUsage, setApiUsage] = React.useState<ApiUsage | null>(null)
  const [apiTesting, setApiTesting] = React.useState(false)
  const [apiTestResult, setApiTestResult] = React.useState<string | null>(null)

  // เมนูกลุ่มโมเดลของเจ้าที่เลือก — มีเฉพาะเจ้าที่มีข้อมูลใน AI_MODEL_GROUPS (kie.ai = Kai AI)
  const modelGroups = modelGroupsForProvider(apiProvider)
  /** รุ่นที่พิมพ์/เลือกไว้ ตรงกับเมนูกลุ่มไหม (ไม่ตรง = ให้ Select โชว์ placeholder) */
  const pickedModelFromMenu = modelGroups.some(g => g.models.some(m => m.id === apiModel)) ? apiModel : ''

  // โหลดค่าของเจ้านั้นขึ้นฟอร์ม (ค่าที่บันทึกไว้ หรือค่าเริ่มต้นของเจ้า) — ยังไม่บันทึก
  const fillForm = React.useCallback((provider: ProviderView | undefined) => {
    if (!provider) return
    setApiUrl(provider.url || provider.presetUrl || '')
    setApiUrlDefault(provider.presetUrl || '')
    setApiModel(provider.model || '')
    setApiModelDefault(provider.presetModel || '')
    setApiProtocol(provider.protocol || 'auto')
    setApiKeySet(!!provider.hasKey)
    setApiKeyMasked(provider.masked || '')
    setApiKeyInput('')
    setShowApiKey(false)
    setApiTestResult(null)
  }, [])

  const loadApiSettings = React.useCallback(async (selectId?: string) => {
    try {
      const res = await fetch('/api/app-settings', { cache: 'no-store' })
      const json = await res.json()
      const list: ProviderView[] = Array.isArray(json.providers) ? json.providers : []
      setApiProviders(list)
      setApiActive(json.active || '')
      const target = list.find(p => p.id === (selectId || json.active)) || list[0]
      if (target) {
        setApiProvider(target.id)
        fillForm(target)
      }
      setApiUsage(json.usage ?? null)
    } catch {
      // ignore — หน้า settings ยังใช้งานส่วนอื่นได้
    } finally {
      setApiLoading(false)
    }
  }, [fillForm])

  React.useEffect(() => {
    loadApiSettings()
  }, [loadApiSettings])

  // เลือกผู้ให้บริการจาก radio — โหลดค่าขึ้นฟอร์ม ยังไม่มีผลจนกว่าจะกด "บันทึกการเชื่อมต่อ"
  function selectProvider(id: string) {
    const provider = apiProviders.find(p => p.id === id)
    setApiProvider(id)
    fillForm(provider)
    if (id !== apiActive) {
      toast.info(`เลือก ${provider?.label ?? id} — กด "บันทึกการเชื่อมต่อ" เพื่อเริ่มใช้งานเจ้านี้`)
    }
  }

  /** เลือกรุ่นจากเมนูกลุ่ม → เติมลงช่อง AI Model (ยังไม่บันทึกจนกว่าจะกด "บันทึกการเชื่อมต่อ") */
  function selectModelFromMenu(modelId: string) {
    setApiModel(modelId)
    const picked = findModelOption(modelId)
    if (picked) toast.info(`เลือกรุ่น ${picked.label} (${modelId}) — กด "บันทึกการเชื่อมต่อ" เพื่อใช้งาน`)
  }

  // บันทึกชุดของเจ้าที่เลือก + ตั้งเป็นเจ้าที่ใช้งาน (คีย์ว่าง = ไม่เปลี่ยนคีย์เดิม)
  async function saveConnection() {
    const provider = apiProviders.find(p => p.id === apiProvider)
    if (!provider) return
    if (!apiUrl.trim()) {
      toast.error('กรุณากรอก Base URL ก่อน')
      return
    }
    if (!apiKeySet && !apiKeyInput.trim()) {
      toast.error('กรุณากรอก API Key ก่อน')
      return
    }

    setApiSaving(true)
    try {
      const keys = providerSettingKeys(apiProvider)
      const payload: Array<{ key: string; value: string }> = [
        { key: keys.url, value: apiUrl.trim() },
        { key: keys.model, value: apiModel.trim() },
        { key: keys.protocol, value: apiProtocol },
      ]
      if (apiKeyInput.trim()) payload.push({ key: keys.apiKey, value: apiKeyInput.trim() })

      for (const item of payload) {
        const res = await fetch('/api/app-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        })
        const json = await res.json()
        if (!res.ok) {
          toast.error(json.error || 'บันทึกไม่สำเร็จ')
          return
        }
      }

      // ตั้งเจ้านี้เป็นผู้ให้บริการที่ใช้งาน
      const resActive = await fetch('/api/app-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'ai_provider', value: apiProvider }),
      })
      const jsonActive = await resActive.json()
      if (!resActive.ok) {
        toast.error(jsonActive.error || 'ตั้งผู้ให้บริการไม่สำเร็จ')
        return
      }

      await loadApiSettings(apiProvider)
      toast.success(`บันทึกและใช้ ${provider.label} แล้ว`)
    } catch {
      toast.error('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ')
    } finally {
      setApiSaving(false)
    }
  }

  // ลบคีย์ของเจ้าที่เลือก
  async function clearProviderKey() {
    const provider = apiProviders.find(p => p.id === apiProvider)
    if (!provider) return
    setApiSaving(true)
    try {
      const res = await fetch('/api/app-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: providerSettingKeys(apiProvider).apiKey, value: '' }),
      })
      if (!res.ok) {
        toast.error('ลบไม่สำเร็จ')
        return
      }
      await loadApiSettings(apiProvider)
      toast.success(`ลบ API Key ของ ${provider.label} แล้ว`)
    } catch {
      toast.error('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ')
    } finally {
      setApiSaving(false)
    }
  }

  // ทดสอบค่าที่บันทึกไว้ของเจ้าที่เลือก (ไม่หักเครดิตของผู้ใช้)
  async function testConnection() {
    setApiTesting(true)
    setApiTestResult(null)
    try {
      const res = await fetch('/api/app-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: apiProvider }),
      })
      const json = await res.json()
      setApiTestResult(
        json.ok
          ? `เชื่อมต่อสำเร็จ · ${json.protocol === 'responses' ? 'Responses API' : 'Chat Completions'} · ${json.model} · ${json.latencyMs} ms${json.tokens ? ` · ${json.tokens} tokens` : ''}${json.providerCredits ? ` · หัก ${json.providerCredits} cr` : ''}`
          : `ไม่สำเร็จ: ${json.error || 'ไม่ทราบสาเหตุ'}`
      )
    } catch {
      setApiTestResult('ไม่สำเร็จ: เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')
    } finally {
      setApiTesting(false)
    }
  }

  const previewColor = COLOR_CLASSES[form.color] ?? COLOR_CLASSES.emerald
  const PreviewIcon = ICONS[form.icon] ?? FileText

  // ---- option list state ----
  const [optGroup, setOptGroup] = React.useState<string>('law_type')
  const [optFormOpen, setOptFormOpen] = React.useState(false)
  const [optForm, setOptForm] = React.useState<OptionFormState>(EMPTY_OPTION_FORM)
  const [optSaving, setOptSaving] = React.useState(false)
  const [optDeleteTarget, setOptDeleteTarget] = React.useState<OptionRecord | null>(null)
  const [optDeleting, setOptDeleting] = React.useState(false)

  const isOptEdit = optForm.id !== null
  const optItems = options[optGroup] ?? []
  const optGroupMeta = OPTION_GROUPS.find(g => g.group === optGroup)

  function openOptionCreate() {
    setOptForm({ ...EMPTY_OPTION_FORM, group: optGroup })
    setOptFormOpen(true)
  }

  function openOptionEdit(o: OptionRecord) {
    setOptForm({
      id: o.id,
      group: o.group,
      value: o.value,
      label: o.label,
      meta: (o.meta as Record<string, unknown>) ?? {},
    })
    setOptFormOpen(true)
  }

  function setOptMeta(key: string, value: unknown) {
    setOptForm(f => ({ ...f, meta: { ...f.meta, [key]: value } }))
  }

  async function saveOption() {
    if (!optForm.label.trim()) {
      toast.error('กรุณากรอกชื่อที่แสดง')
      return
    }
    if (!isOptEdit && !/^[a-zA-Z0-9._-]{1,60}$/.test(optForm.value.trim())) {
      toast.error('รหัสตัวเลือกใช้ได้เฉพาะ a-z, A-Z, 0-9, . _ - (1-60 ตัว)')
      return
    }

    setOptSaving(true)
    try {
      const res = await fetch(isOptEdit ? `/api/options/${optForm.id}` : '/api/options', {
        method: isOptEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group: optForm.group,
          value: optForm.value.trim(),
          label: optForm.label.trim(),
          meta: optForm.meta,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'บันทึกไม่สำเร็จ')
        return
      }
      await refreshOptions()
      toast.success(isOptEdit ? 'แก้ไขตัวเลือกแล้ว' : 'เพิ่มตัวเลือกแล้ว')
      setOptFormOpen(false)
    } catch {
      toast.error('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ')
    } finally {
      setOptSaving(false)
    }
  }

  async function deleteOption() {
    if (!optDeleteTarget) return
    setOptDeleting(true)
    try {
      const res = await fetch(`/api/options/${optDeleteTarget.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'ลบไม่สำเร็จ')
        return
      }
      await refreshOptions()
      toast.success(`ลบตัวเลือก "${optDeleteTarget.label}" แล้ว`)
      setOptDeleteTarget(null)
    } catch {
      toast.error('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ')
    } finally {
      setOptDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight">ตั้งค่า</h1>
          <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-900">
            <SettingsIcon className="h-3 w-3 mr-1" />
            ตั้งค่าระบบ
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
          จัดการหมวดหมู่เอกสารกฎหมาย — เพิ่ม แก้ไข หรือลบหมวดที่ใช้จัดกลุ่มเอกสารในคลังกฎหมายและหน้าอัปโหลด
          หมวดที่มีเอกสารอยู่จะถูกล็อกไม่ให้ลบ
        </p>
      </div>

      {/* Categories */}
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4 text-cyan-600" />
                หมวดหมู่เอกสาร
              </CardTitle>
              <CardDescription>
                ทั้งหมด {categories.length} หมวด · รหัสหมวด (value) แก้ไม่ได้หลังสร้าง เพราะเอกสารอ้างถึงอยู่
              </CardDescription>
            </div>
            <Button onClick={openCreate} size="sm" className="h-9 gap-1.5 shrink-0">
              <Plus className="h-4 w-4" />
              เพิ่มหมวดหมู่
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {categoriesLoading ? (
            [1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)
          ) : categories.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              ยังไม่มีหมวดหมู่ — กด &quot;เพิ่มหมวดหมู่&quot; เพื่อเริ่มต้น
            </div>
          ) : (
            categories.map((c) => {
              const color = COLOR_CLASSES[c.color] ?? COLOR_CLASSES.emerald
              const Icon = ICONS[c.icon] ?? FileText
              const locked = c.documentCount > 0
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 flex-wrap p-3 rounded-lg border border-border/60 hover:bg-muted/40 transition-colors"
                >
                  <div className={`p-2 rounded-md shrink-0 ${color.bg} ${color.text}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-[9rem]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{c.label}</span>
                      <Badge variant="outline" className={`text-[9px] border-0 ${color.bg} ${color.text}`}>{c.short}</Badge>
                      <Badge variant="secondary" className="text-[9px] font-mono">{c.value}</Badge>
                      {locked && <Badge variant="outline" className="text-[9px]">{c.documentCount} เอกสาร</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.description}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => openEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                      แก้ไข
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900 dark:hover:bg-rose-950/40"
                      onClick={() => setDeleteTarget(c)}
                      disabled={locked}
                      title={locked ? 'หมวดนี้ยังมีเอกสาร ลบไม่ได้' : 'ลบหมวดนี้'}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      ลบ
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Form option lists */}
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-emerald-600" />
                ตัวเลือกในแบบฟอร์ม
              </CardTitle>
              <CardDescription>
                ตัวเลือกที่ใช้ใน dropdown ของทั้งระบบ ({OPTION_GROUPS.length} กลุ่ม) — เพิ่ม แก้ไข ลบ ได้เอง
                รหัส (value) แก้ไม่ได้หลังสร้าง และลบไม่ได้ถ้ามีข้อมูลอ้างถึงอยู่
              </CardDescription>
            </div>
            <Button onClick={openOptionCreate} size="sm" variant="outline" className="h-9 gap-1.5 shrink-0">
              <Plus className="h-4 w-4" />
              เพิ่มตัวเลือก
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* group selector */}
          <div className="flex flex-wrap gap-1.5">
            {OPTION_GROUPS.map(g => {
              const isActive = optGroup === g.group
              const count = (options[g.group] ?? []).length
              return (
                <button
                  key={g.group}
                  onClick={() => setOptGroup(g.group)}
                  className={`text-xs px-3 py-1.5 rounded-full border-2 transition-all ${
                    isActive
                      ? 'border-foreground bg-foreground text-background font-medium'
                      : 'border-border hover:border-foreground/40'
                  }`}
                >
                  {g.label} ({count})
                </button>
              )
            })}
          </div>
          {optGroupMeta && (
            <p className="text-xs text-muted-foreground">{optGroupMeta.description}</p>
          )}

          {optionsLoading ? (
            [1, 2].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)
          ) : optItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              ยังไม่มีตัวเลือกในกลุ่มนี้ — กด &quot;เพิ่มตัวเลือก&quot; เพื่อเริ่มต้น
            </div>
          ) : (
            optItems.map(o => {
              const locked = o.usageCount > 0
              const summary = optionMetaSummary(o.group, o)
              return (
                <div
                  key={o.id}
                  className="flex items-center gap-3 flex-wrap p-3 rounded-lg border border-border/60 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex-1 min-w-[9rem] selectable-text">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{o.label}</span>
                      <Badge variant="secondary" className="text-[9px] font-mono">{o.value}</Badge>
                      {locked && (
                        <Badge variant="outline" className="text-[9px]">ใช้อยู่ {o.usageCount} รายการ</Badge>
                      )}
                    </div>
                    {summary && <p className="text-xs text-muted-foreground mt-0.5">{summary}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => openOptionEdit(o)}>
                      <Pencil className="h-3.5 w-3.5" />
                      แก้ไข
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900 dark:hover:bg-rose-950/40"
                      onClick={() => setOptDeleteTarget(o)}
                      disabled={locked}
                      title={locked ? 'ตัวเลือกนี้ถูกใช้อยู่ ลบไม่ได้' : 'ลบตัวเลือกนี้'}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      ลบ
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* API / keys */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            <PlugZap className="h-4 w-4 text-amber-600" />
            OpenAI Compatibility
            {apiKeySet && apiUrl ? (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 text-[10px] hover:bg-emerald-100">
                พร้อมใช้งาน
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                ยังไม่เชื่อมต่อ
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            ต่อได้ทุกค่าย/โมเดลที่พูดสเปก OpenAI (POST /chat/completions + Bearer) — ใช้งานจริงหักเป็น <span className="font-medium text-foreground">Token credits</span> ตามโทเคนที่ใช้
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {apiLoading ? (
            <Skeleton className="h-20 w-full rounded-lg" />
          ) : (
            <>
              {/* เลือกผู้ให้บริการ (radio) — เลือกแล้วค่าของเจ้านั้นจะขึ้นฟอร์มให้พร้อมแก้ */}
              <div className="space-y-2">
                <Label className="text-xs">ผู้ให้บริการ AI (เลือกแล้วกด &quot;บันทึกการเชื่อมต่อ&quot; เพื่อใช้งานเจ้านั้น)</Label>
                <RadioGroup
                  value={apiProvider}
                  onValueChange={selectProvider}
                  className="grid gap-2 sm:grid-cols-2"
                >
                  {apiProviders.map(p => (
                    <label
                      key={p.id}
                      htmlFor={`provider-${p.id}`}
                      className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition-colors ${
                        apiProvider === p.id
                          ? 'border-amber-400 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/20'
                          : 'border-border/60 hover:bg-muted/40'
                      }`}
                    >
                      <RadioGroupItem value={p.id} id={`provider-${p.id}`} className="mt-0.5" />
                      <span className="space-y-0.5">
                        <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                          {p.label}
                          {p.active && (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 text-[10px]">
                              ใช้งานอยู่
                            </Badge>
                          )}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">{p.hint}</span>
                        <span className="block text-[10px] text-muted-foreground">
                          {p.hasKey ? `คีย์: ${p.masked}` : 'ยังไม่ตั้งคีย์'}
                        </span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-url" className="text-xs">Base URL</Label>
                <Input
                  id="api-url"
                  type="url"
                  value={apiUrl}
                  onChange={e => setApiUrl(e.target.value)}
                  placeholder={apiUrlDefault || 'https://api.openai.com/v1'}
                  className="text-sm font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  ใส่ถึงระดับ /v1 (ระบบจะต่อ <span className="font-mono">/chat/completions</span> ให้เอง) · เว้นว่างแล้วกดบันทึก = ลบ URL
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-model" className="text-xs">AI Model</Label>
                <Input
                  id="api-model"
                  value={apiModel}
                  onChange={e => setApiModel(e.target.value)}
                  placeholder={apiModelDefault || 'gpt-4o-mini'}
                  className="text-sm font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  เว้นว่าง = ใช้ค่าเริ่มต้น {apiModelDefault || 'gpt-4o-mini'}
                </p>
              </div>

              {/* เมนูกลุ่มโมเดล (kie.ai) — แสดงเฉพาะเจ้าที่มีข้อมูลใน AI_MODEL_GROUPS + เทียบราคากับ DeepSeek */}
              {modelGroups.length > 0 && (
                <div className="space-y-2 rounded-lg border border-amber-200/70 bg-amber-50/40 p-3 dark:border-amber-900/40 dark:bg-amber-950/10">
                  <Label htmlFor="api-model-group" className="text-xs">
                    เมนูกลุ่มโมเดล — {apiProviders.find(p => p.id === apiProvider)?.label ?? apiProvider}
                  </Label>
                  <Select value={pickedModelFromMenu} onValueChange={selectModelFromMenu}>
                    <SelectTrigger id="api-model-group" className="text-sm">
                      <SelectValue placeholder="เลือกรุ่นจากเมนูกลุ่ม (DeepSeek / Gemini Flash)" />
                    </SelectTrigger>
                    <SelectContent>
                      {modelGroups.map(group => (
                        <SelectGroup key={group.id}>
                          <SelectLabel>
                            {group.label}
                            {group.note ? ` · ${group.note}` : ''}
                          </SelectLabel>
                          {group.models.map(model => (
                            <SelectItem key={model.id} value={model.id}>
                              <span className="flex items-center gap-2">
                                <span className="font-medium">{model.label}</span>
                                <span className="font-mono text-[10px] text-muted-foreground">{model.id}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* เทียบราคากับรุ่นฐาน (DeepSeek) — ราคาต่อ 1M tokens จาก kie.ai */}
                  <div className="divide-y divide-border/60 rounded-lg border border-border/60 bg-background/60">
                    {modelGroups.flatMap(group => group.models).map(model => {
                      const ratio = priceRatioVs(model.id, AI_PRICE_BASELINE_ID)
                      const isBaseline = model.id === AI_PRICE_BASELINE_ID
                      return (
                        <div key={model.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-medium">{model.label}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">{model.id}</span>
                            {apiModel === model.id && (
                              <Badge className="bg-emerald-100 text-[10px] text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400">
                                เลือกอยู่
                              </Badge>
                            )}
                          </span>
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[11px]">
                              ${model.inputUsd} / ${model.outputUsd} per 1M
                            </span>
                            {isBaseline ? (
                              <Badge variant="outline" className="text-[10px]">ฐานเทียบ (ถูกสุด)</Badge>
                            ) : ratio ? (
                              <Badge variant="outline" className="text-[10px]">
                                เทียบ DeepSeek ×{ratio.input.toFixed(1)} in · ×{ratio.output.toFixed(1)} out
                              </Badge>
                            ) : null}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    ราคา input/output ต่อ 1M tokens ณ {AI_PRICING_UPDATED} — ตรวจราคาล่าสุดที่{' '}
                    <a href={AI_PRICING_SOURCE} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                      {AI_PRICING_SOURCE}
                    </a>
                    {' '}· เลือกจากเมนูแล้วต้องกด &quot;บันทึกการเชื่อมต่อ&quot; อีกครั้งเพื่อใช้งานจริง
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="api-protocol" className="text-xs">Protocol</Label>
                <Select value={apiProtocol} onValueChange={setApiProtocol}>
                  <SelectTrigger id="api-protocol" className="text-sm">
                    <SelectValue placeholder="auto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (ตรวจจาก Base URL)</SelectItem>
                    <SelectItem value="chat">Chat Completions (/chat/completions)</SelectItem>
                    <SelectItem value="responses">Responses API (/responses — kie.ai ฯลฯ)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Auto: เจอ <span className="font-mono">/openai/v1</span> → Responses API · อื่น ๆ → Chat Completions
                  {apiUrl.trim() && ` · ตอนนี้ตรวจได้: ${/\/openai\/v1|responses\/?$/.test(apiUrl.trim().toLowerCase()) ? 'Responses API' : 'Chat Completions'}`}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-key" className="text-xs">API key</Label>
                <div className="flex gap-2 flex-wrap">
                  <Input
                    id="api-key"
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={e => setApiKeyInput(e.target.value)}
                    placeholder={apiKeySet ? `ตั้งค่าไว้แล้ว (${apiKeyMasked}) — พิมพ์ทับเพื่อเปลี่ยน` : 'วาง API key ที่นี่'}
                    className="text-sm font-mono flex-1 min-w-[15rem]"
                    autoComplete="off"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowApiKey(v => !v)}
                    title={showApiKey ? 'ซ่อนคีย์' : 'แสดงคีย์'}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button onClick={saveConnection} disabled={apiSaving} className="gap-1.5">
                    {apiSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    บันทึกการเชื่อมต่อ
                  </Button>
                  {apiKeySet && (
                    <Button
                      onClick={clearProviderKey}
                      disabled={apiSaving}
                      variant="outline"
                      className="gap-1.5 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      ลบ key
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground selectable-text">
                  สถานะ {apiProviders.find(p => p.id === apiProvider)?.label ?? ''}: {apiKeySet ? `ตั้งค่าแล้ว (${apiKeyMasked})` : 'ยังไม่ตั้งค่า'} ·
                  เก็บในฐานข้อมูลเป็นข้อความ (ปัจจุบันยังไม่มีการเข้ารหัส)
                </p>
              </div>

              {/* ทดสอบการเชื่อมต่อ */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={testConnection}
                  disabled={apiTesting || !apiUrl || !apiKeySet}
                  className="gap-1.5"
                >
                  {apiTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                  ทดสอบการเชื่อมต่อ
                </Button>
                {apiTestResult && (
                  <span className={`text-[10px] ${apiTestResult.startsWith('เชื่อมต่อสำเร็จ') ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {apiTestResult}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground">
                  ทดสอบใช้ค่าที่บันทึกไว้ · ใช้โทเคนเล็กน้อยจากคีย์ของคุณ · ไม่หักเครดิต
                </span>
              </div>

              {/* Token credits */}
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-semibold flex items-center gap-1.5">
                    <Coins className="h-3.5 w-3.5 text-amber-600" />
                    การคิด Token credits
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    1 เครดิต : {TOKENS_PER_CREDIT.toLocaleString()} tokens
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {AI_TIER_LIST.map(t => (
                    <div key={t.mode} className="rounded-md border border-border/60 bg-background p-2 text-center">
                      <div className="text-[10px] text-muted-foreground">{t.label}</div>
                      <div className="text-xs font-semibold">≤ {t.maxTokens.toLocaleString()} tokens</div>
                      <div className="text-[10px] text-muted-foreground">โหมดสำรอง {t.credits} cr</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'เครดิตคงเหลือ', value: apiUsage?.balance ?? 0, unit: 'cr' },
                    { label: `คำค้น ${apiUsage?.days ?? 30} วัน`, value: apiUsage?.queries ?? 0, unit: '' },
                    { label: 'โทเคนที่ใช้', value: apiUsage?.tokens ?? 0, unit: '' },
                    { label: 'เครดิตที่หัก', value: apiUsage?.credits ?? 0, unit: 'cr' },
                  ].map(item => (
                    <div key={item.label} className="rounded-md border border-border/60 bg-background p-2 text-center">
                      <div className="text-[10px] text-muted-foreground">{item.label}</div>
                      <div className="text-sm font-semibold">
                        {item.value.toLocaleString()}
                        {item.unit && <span className="text-[10px] text-muted-foreground"> {item.unit}</span>}
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-[10px] text-muted-foreground">
                  ตอนค้นหา: เชื่อมต่อ AI ได้ = หักตามโทเคนจริง (ปัดขึ้น ขั้นต่ำ 1) · เรียก AI ไม่ได้ = ใช้เส้นทาง keyword และหักตามราคาโหมดสำรอง
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่ใหม่'}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? 'แก้ชื่อ รายละเอียด ไอคอน และสี (รหัสหมวดแก้ไม่ได้)'
                : 'กำหนดรหัสหมวดเป็นภาษาอังกฤษเพื่อใช้อ้างอิงกับเอกสาร'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5">
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-muted/30">
              <div className={`p-2 rounded-md ${previewColor.bg} ${previewColor.text}`}>
                <PreviewIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{form.label || 'ชื่อหมวด'}</div>
                <div className="text-[10px] text-muted-foreground font-mono truncate">
                  {form.value || 'value'} · {form.short || 'SHORT'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cat-value" className="text-xs">รหัสหมวด (value) *</Label>
                <Input
                  id="cat-value"
                  value={form.value}
                  disabled={isEdit}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder="เช่น land_tax"
                  className="font-mono"
                />
                {isEdit && <p className="text-[10px] text-muted-foreground">แก้ไม่ได้หลังสร้าง</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-short" className="text-xs">ตัวย่อ *</Label>
                <Input
                  id="cat-short"
                  value={form.short}
                  onChange={(e) => setForm({ ...form, short: e.target.value })}
                  placeholder="เช่น LT"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cat-label" className="text-xs">ชื่อหมวด *</Label>
              <Input
                id="cat-label"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="เช่น ภาษีที่ดินและสิ่งปลูกสร้าง"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cat-desc" className="text-xs">คำอธิบาย</Label>
              <Textarea
                id="cat-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                placeholder="อธิบายขอบเขตของหมวดนี้"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">ไอคอน</Label>
                <Select value={form.icon} onValueChange={(v) => setForm({ ...form, icon: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {iconChoices.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">สี</Label>
                <Select value={form.color} onValueChange={(v) => setForm({ ...form, color: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {colorChoices.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>ยกเลิก</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มหมวดหมู่'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบหมวดหมู่</AlertDialogTitle>
            <AlertDialogDescription>
              ลบหมวด &quot;{deleteTarget?.label}&quot; ({deleteTarget?.short}) ออกจากระบบ?
              การลบนี้ย้อนกลับไม่ได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete() }}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {deleting ? 'กำลังลบ...' : 'ลบหมวดนี้'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Option add / edit dialog */}
      <Dialog open={optFormOpen} onOpenChange={setOptFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isOptEdit ? 'แก้ไขตัวเลือก' : 'เพิ่มตัวเลือกใหม่'}</DialogTitle>
            <DialogDescription>
              กลุ่ม: {OPTION_GROUPS.find(g => g.group === optForm.group)?.label}
              {isOptEdit ? ' · รหัส (value) แก้ไม่ได้' : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="opt-value" className="text-xs">รหัส (value) *</Label>
                <Input
                  id="opt-value"
                  value={optForm.value}
                  disabled={isOptEdit}
                  onChange={e => setOptForm({ ...optForm, value: e.target.value })}
                  placeholder="เช่น rd.go.th"
                  className="font-mono"
                />
                {isOptEdit && <p className="text-[10px] text-muted-foreground">แก้ไม่ได้หลังสร้าง</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="opt-label" className="text-xs">ชื่อที่แสดง *</Label>
                <Input
                  id="opt-label"
                  value={optForm.label}
                  onChange={e => setOptForm({ ...optForm, label: e.target.value })}
                  placeholder="เช่น ภาษีที่ดิน"
                />
              </div>
            </div>

            {optForm.group === 'search_mode' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="opt-credits" className="text-xs">เครดิตที่ใช้</Label>
                  <Input
                    id="opt-credits"
                    type="number"
                    value={Number(optForm.meta.credits ?? 0)}
                    onChange={e => setOptMeta('credits', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">สีการ์ด</Label>
                  <Select value={String(optForm.meta.color ?? 'emerald')} onValueChange={v => setOptMeta('color', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {colorChoices.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="opt-desc" className="text-xs">คำอธิบาย</Label>
                  <Input
                    id="opt-desc"
                    value={String(optForm.meta.description ?? '')}
                    onChange={e => setOptMeta('description', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="opt-features" className="text-xs">จุดเด่น (บรรทัดละ 1 ข้อ)</Label>
                  <Textarea
                    id="opt-features"
                    rows={3}
                    value={Array.isArray(optForm.meta.features) ? (optForm.meta.features as string[]).join('\n') : ''}
                    onChange={e => setOptMeta('features', e.target.value.split('\n').filter(Boolean))}
                  />
                </div>
              </div>
            )}

            {optForm.group === 'topup_preset' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="opt-amount" className="text-xs">ยอดเงิน (บาท)</Label>
                  <Input
                    id="opt-amount"
                    type="number"
                    value={Number(optForm.meta.amount ?? 0)}
                    onChange={e => setOptMeta('amount', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="opt-bonus" className="text-xs">โบนัส (เครดิต)</Label>
                  <Input
                    id="opt-bonus"
                    type="number"
                    value={Number(optForm.meta.bonus ?? 0)}
                    onChange={e => setOptMeta('bonus', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="opt-bonuspct" className="text-xs">โบนัส (%)</Label>
                  <Input
                    id="opt-bonuspct"
                    type="number"
                    value={Number(optForm.meta.bonusPct ?? 0)}
                    onChange={e => setOptMeta('bonusPct', Number(e.target.value))}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOptFormOpen(false)} disabled={optSaving}>ยกเลิก</Button>
            <Button onClick={saveOption} disabled={optSaving} className="gap-1.5">
              {optSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isOptEdit ? 'บันทึกการแก้ไข' : 'เพิ่มตัวเลือก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Option delete confirm */}
      <AlertDialog
        open={optDeleteTarget !== null}
        onOpenChange={(open) => { if (!open) setOptDeleteTarget(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบตัวเลือก</AlertDialogTitle>
            <AlertDialogDescription>
              ลบตัวเลือก &quot;{optDeleteTarget?.label}&quot; ({optDeleteTarget?.value}) ออกจากกลุ่มนี้?
              การลบนี้ย้อนกลับไม่ได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={optDeleting}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); deleteOption() }}
              disabled={optDeleting}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {optDeleting ? 'กำลังลบ...' : 'ลบตัวเลือกนี้'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


    </div>
  )
}
