'use client'

import * as React from 'react'
import { CATEGORY_META, type CategoryRecord, type OptionRecord } from '@/lib/types'
import { DEFAULT_OPTIONS } from '@/lib/option-defaults'

// Fallback option groups so every dropdown still works when the table is empty
const FALLBACK_OPTIONS: Record<string, OptionRecord[]> = DEFAULT_OPTIONS.reduce(
  (acc: Record<string, OptionRecord[]>, o) => {
    const list = acc[o.group] ?? (acc[o.group] = [])
    list.push({
      id: `fallback-${o.group}-${o.value}`,
      group: o.group,
      value: o.value,
      label: o.label,
      meta: (o.meta as Record<string, unknown> | undefined) ?? null,
      sortOrder: list.length,
      usageCount: 0,
    })
    return acc
  },
  {}
)

// Label lookup with graceful fallback
export function optionLabel(
  options: Record<string, OptionRecord[]>,
  group: string,
  value: string | null | undefined,
  fallback?: string
): string {
  if (!value) return fallback ?? ''
  return options[group]?.find(o => o.value === value)?.label ?? fallback ?? value
}

// Fallback so the 6 original groups stay visible when the categories table is empty
const FALLBACK_CATEGORIES: CategoryRecord[] = CATEGORY_META.map((meta, i) => ({
  id: `fallback-${meta.value}`,
  value: meta.value,
  label: meta.label,
  short: meta.short,
  description: meta.description,
  icon: meta.icon,
  color: meta.color,
  sortOrder: i,
  documentCount: 0,
}))

interface AppState {
  balance: number
  userName: string | null
  userRole: string | null
  userLoading: boolean
  topUpOpen: boolean
  setTopUpOpen: (open: boolean) => void
  categories: CategoryRecord[]
  categoriesLoading: boolean
  refreshCategories: () => Promise<void>
  options: Record<string, OptionRecord[]>
  optionsLoading: boolean
  refreshOptions: () => Promise<void>
  handleTopUpSuccess: (newBalance: number) => void
  handleCreditsChange: (newBalance: number) => void
}

const AppStateContext = React.createContext<AppState | null>(null)

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [balance, setBalance] = React.useState<number>(0)
  const [userName, setUserName] = React.useState<string | null>(null)
  const [userRole, setUserRole] = React.useState<string | null>(null)
  const [userLoading, setUserLoading] = React.useState(true)
  const [topUpOpen, setTopUpOpen] = React.useState(false)
  const [categories, setCategories] = React.useState<CategoryRecord[]>(FALLBACK_CATEGORIES)
  const [categoriesLoading, setCategoriesLoading] = React.useState(true)

  const refreshCategories = React.useCallback(async () => {
    try {
      const res = await fetch('/api/categories', { cache: 'no-store' })
      const json = await res.json()
      if (Array.isArray(json.categories) && json.categories.length > 0) {
        setCategories(json.categories)
      } else {
        setCategories(FALLBACK_CATEGORIES)
      }
    } catch {
      setCategories(FALLBACK_CATEGORIES)
    } finally {
      setCategoriesLoading(false)
    }
  }, [])

  React.useEffect(() => {
    refreshCategories()
  }, [refreshCategories])

  const [options, setOptions] = React.useState<Record<string, OptionRecord[]>>(FALLBACK_OPTIONS)
  const [optionsLoading, setOptionsLoading] = React.useState(true)

  const refreshOptions = React.useCallback(async () => {
    try {
      const res = await fetch('/api/options', { cache: 'no-store' })
      const json = await res.json()
      if (Array.isArray(json.options) && json.options.length > 0) {
        const grouped: Record<string, OptionRecord[]> = {}
        for (const o of json.options as OptionRecord[]) {
          if (!grouped[o.group]) grouped[o.group] = []
          grouped[o.group].push(o)
        }
        setOptions(grouped)
      } else {
        setOptions(FALLBACK_OPTIONS)
      }
    } catch {
      setOptions(FALLBACK_OPTIONS)
    } finally {
      setOptionsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    refreshOptions()
  }, [refreshOptions])

  // Load user info once on mount (shell lives across route changes, so this runs once)
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

  const handleTopUpSuccess = React.useCallback((newBalance: number) => {
    setBalance(newBalance)
    setTopUpOpen(false)
  }, [])

  const handleCreditsChange = React.useCallback((newBalance: number) => {
    setBalance(newBalance)
  }, [])

  const value = React.useMemo<AppState>(
    () => ({
      balance,
      userName,
      userRole,
      userLoading,
      topUpOpen,
      setTopUpOpen,
      categories,
      categoriesLoading,
      refreshCategories,
      options,
      optionsLoading,
      refreshOptions,
      handleTopUpSuccess,
      handleCreditsChange,
    }),
    [balance, userName, userRole, userLoading, topUpOpen, categories, categoriesLoading, refreshCategories, options, optionsLoading, refreshOptions, handleTopUpSuccess, handleCreditsChange]
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState() {
  const ctx = React.useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider')
  return ctx
}
