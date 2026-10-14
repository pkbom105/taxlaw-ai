// Single source of truth for category icon + colour visuals.
// IMPORTANT: all Tailwind classes must appear as literal strings here so the JIT compiler keeps them.
import type * as React from 'react'
import {
  Scale, Landmark, BookOpen, Gavel, Calculator, Globe,
  FileText, ScrollText, Building2, ShieldCheck, Coins, BookMarked,
} from 'lucide-react'

export const CATEGORY_ICONS: Record<string, React.ElementType> = {
  scale: Scale,
  landmark: Landmark,
  'book-open': BookOpen,
  gavel: Gavel,
  calculator: Calculator,
  globe: Globe,
  'file-text': FileText,
  'scroll-text': ScrollText,
  building: Building2,
  'shield-check': ShieldCheck,
  coins: Coins,
  'book-marked': BookMarked,
}

export interface CategoryColorClasses {
  bg: string
  text: string
  border: string
  badge: string
  gradient: string
}

export const CATEGORY_COLORS: Record<string, CategoryColorClasses> = {
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-900', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400', gradient: 'from-emerald-500 to-emerald-700' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-900', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400', gradient: 'from-amber-500 to-amber-700' },
  sky: { bg: 'bg-sky-50 dark:bg-sky-950/40', text: 'text-sky-700 dark:text-sky-400', border: 'border-sky-200 dark:border-sky-900', badge: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400', gradient: 'from-sky-500 to-sky-700' },
  rose: { bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-900', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400', gradient: 'from-rose-500 to-rose-700' },
  violet: { bg: 'bg-violet-50 dark:bg-violet-950/40', text: 'text-violet-700 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-900', badge: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400', gradient: 'from-violet-500 to-violet-700' },
  cyan: { bg: 'bg-cyan-50 dark:bg-cyan-950/40', text: 'text-cyan-700 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-900', badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400', gradient: 'from-cyan-500 to-cyan-700' },
  teal: { bg: 'bg-teal-50 dark:bg-teal-950/40', text: 'text-teal-700 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-900', badge: 'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400', gradient: 'from-teal-500 to-teal-700' },
  indigo: { bg: 'bg-indigo-50 dark:bg-indigo-950/40', text: 'text-indigo-700 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-900', badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400', gradient: 'from-indigo-500 to-indigo-700' },
  lime: { bg: 'bg-lime-50 dark:bg-lime-950/40', text: 'text-lime-700 dark:text-lime-400', border: 'border-lime-200 dark:border-lime-900', badge: 'bg-lime-100 text-lime-700 dark:bg-lime-950/40 dark:text-lime-400', gradient: 'from-lime-500 to-lime-700' },
  fuchsia: { bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/40', text: 'text-fuchsia-700 dark:text-fuchsia-400', border: 'border-fuchsia-200 dark:border-fuchsia-900', badge: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-400', gradient: 'from-fuchsia-500 to-fuchsia-700' },
}

export function resolveColor(key: string | null | undefined): CategoryColorClasses {
  return CATEGORY_COLORS[key || ''] ?? CATEGORY_COLORS.emerald
}

export function resolveIcon(key: string | null | undefined): React.ElementType {
  return CATEGORY_ICONS[key || ''] ?? FileText
}
