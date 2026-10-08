import React, { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Sun, Moon, Search, Calendar, GitCompare, Upload,
  ChevronDown, Menu, X, MoreHorizontal,
  LayoutDashboard, CalendarDays, CheckCircle2, Building2,
  Globe2, Clock, Table2, Lightbulb, Sparkles,
  Printer, History, Activity,
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { getSnapshots } from '@/api/client'
import { formatDate } from '@/utils/format'

// ── Tab definitions ───────────────────────────────────────────────────────────
const LEFT_TABS = [
  { to: '/',               icon: LayoutDashboard, label: 'Overview' },
  { to: '/expiry',         icon: CalendarDays,    label: 'Expiry' },
  { to: '/approvals',      icon: CheckCircle2,    label: 'Approvals' },
  { to: '/business-units', icon: Building2,       label: 'Business Units' },
  { to: '/regions',        icon: Globe2,          label: 'Regions' },
  { to: '/pipeline',       icon: Clock,           label: 'Delayed Renewals' },
  { to: '/opportunities',  icon: Table2,          label: 'Data Explorer' },
] as const

const RIGHT_TABS = [
  { to: '/insights',      icon: Lightbulb, label: 'Insights' },
  { to: '/assistant',     icon: Sparkles,  label: 'Assistant' },
  { to: '/executive',     icon: Printer,   label: 'Executive View', newTab: true },
  { to: '/history',       icon: History,   label: 'History' },
  { to: '/daily-changes', icon: Activity,  label: 'Daily Changes' },
] as const

// These stay always-visible (not pushed into More dropdown)
const ALWAYS_VISIBLE_RIGHT = ['/insights', '/assistant', '/executive']

// ── Upload Modal ──────────────────────────────────────────────────────────────
function UploadModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ background: 'var(--bg-primary)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="font-display font-bold text-sm text-[var(--text-primary)]">Upload Excel Files</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          {/* Inline the Upload page via iframe-like embed */}
          <UploadInline onDone={onClose} />
        </div>
      </div>
    </div>
  )
}

// Lazy import Upload component inline
import { lazy, Suspense } from 'react'
const UploadPage = lazy(() => import('@/pages/Upload'))
function UploadInline({ onDone }: { onDone: () => void }) {
  return (
    <Suspense fallback={<div className="py-12 text-center text-sm text-[var(--text-muted)]">Loading upload form…</div>}>
      <UploadPage />
    </Suspense>
  )
}

// ── Tab pill ─────────────────────────────────────────────────────────────────
function TabPill({
  to, icon: Icon, label, newTab = false, onClick,
}: { to: string; icon: React.ElementType; label: string; newTab?: boolean; onClick?: () => void }) {
  if (newTab) {
    return (
      <a
        href={to}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all whitespace-nowrap select-none"
      >
        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
        {label}
      </a>
    )
  }
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap select-none ${
          isActive
            ? 'bg-[#12284C] text-white dark:bg-teal-500/20 dark:text-teal-300 shadow-sm'
            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
        }`
      }
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      {label}
    </NavLink>
  )
}

// ── Main GlobalHeader ─────────────────────────────────────────────────────────
export default function GlobalHeader() {
  const {
    darkMode, toggleDarkMode,
    setCommandPaletteOpen,
    activeSnapshotId, setActiveSnapshotId,
    compareSnapshotId, setCompareSnapshotId,
    snapshots, setSnapshots,
    includeDeletedLost, setIncludeDeletedLost,
  } = useAppStore()

  const [uploadOpen, setUploadOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  const { isLoading } = useQuery({
    queryKey: ['snapshots'],
    queryFn: async () => {
      const res = await getSnapshots()
      setSnapshots(res)
      return res
    },
  })

  // Auto-init snapshot selection
  useEffect(() => {
    if (snapshots.length > 0) {
      if (!activeSnapshotId) {
        const todaySnap = snapshots.find((s: any) => s.is_active_today) ?? snapshots[0]
        setActiveSnapshotId(todaySnap.id)
      }
      if (!compareSnapshotId && snapshots.length > 1) {
        setCompareSnapshotId(snapshots[1].id)
      }
    }
  }, [snapshots, activeSnapshotId, compareSnapshotId, setActiveSnapshotId, setCompareSnapshotId])

  // Close More dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const activeSnap = snapshots.find((s: any) => s.id === activeSnapshotId) ?? snapshots[0]
  const compareSnap = snapshots.find((s: any) => s.id === compareSnapshotId)

  const getCompareLabel = () => {
    if (!compareSnap) return ''
    const d = new Date(compareSnap.snapshot_date + 'T00:00:00')
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' })
    const dayNum = d.getDate()
    const monthName = d.toLocaleDateString('en-US', { month: 'short' })
    const isYesterday = activeSnap?.yesterday_date === compareSnap.snapshot_date
    if (isYesterday) return `vs ${dayName} ${dayNum} ${monthName} (Prev Working Day)`
    return `vs ${dayName} ${dayNum} ${monthName}`
  }

  // Right tabs that might spill into More
  const alwaysVisibleRight = RIGHT_TABS.filter(t => ALWAYS_VISIBLE_RIGHT.includes(t.to))
  const overflowRight = RIGHT_TABS.filter(t => !ALWAYS_VISIBLE_RIGHT.includes(t.to))

  return (
    <>
      <header
        className="sticky top-0 z-40 flex-shrink-0 border-b border-[var(--border)] shadow-sm"
        style={{ background: 'var(--bg-card)' }}
      >
        {/* ── ROW 1: Logo + Controls ───────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 md:px-6 h-14 gap-3">
          {/* Logo + Name */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#12284C] p-1 flex items-center justify-center shadow-sm">
              <img src="/assets/logo.png" alt="Mobileum" className="w-full h-full object-contain" />
            </div>
            <div className="hidden sm:block leading-tight">
              <p className="font-display font-extrabold text-sm tracking-tight text-[var(--text-primary)]">
                Mobileum <span className="text-teal-600 dark:text-teal-400">Horizon</span>
              </p>
              <p className="text-[9px] font-semibold tracking-wider uppercase text-[var(--text-muted)]">
                Renewals Intelligence Platform
              </p>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1.5 md:gap-2 flex-wrap justify-end">
            {/* View as of */}
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-xs shadow-sm">
              <Calendar className="w-3 h-3 text-teal-500 flex-shrink-0" />
              <span className="font-medium text-[var(--text-muted)] hidden lg:inline">As of:</span>
              <select
                value={activeSnap?.id ?? ''}
                onChange={e => setActiveSnapshotId(e.target.value || null)}
                className="bg-transparent font-semibold text-[var(--text-primary)] outline-none cursor-pointer text-xs"
                id="header-view-as-of"
              >
                {isLoading && <option>Loading…</option>}
                {snapshots.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.label} ({formatDate(s.snapshot_date)})</option>
                ))}
              </select>
            </div>

            {/* Compare with */}
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-xs shadow-sm"
              title={getCompareLabel()}
            >
              <GitCompare className="w-3 h-3 text-violet-500 flex-shrink-0" />
              <span className="font-medium text-[var(--text-muted)] hidden lg:inline">vs:</span>
              <select
                value={compareSnapshotId ?? ''}
                onChange={e => setCompareSnapshotId(e.target.value || null)}
                className="bg-transparent font-semibold text-[var(--text-primary)] outline-none cursor-pointer text-xs"
                id="header-compare-with"
              >
                {snapshots
                  .filter((s: any) => s.id !== activeSnap?.id)
                  .map((s: any) => {
                    const isYest = activeSnap?.yesterday_date === s.snapshot_date
                    return (
                      <option key={s.id} value={s.id}>
                        {s.label} ({formatDate(s.snapshot_date)}){isYest ? ' ⚡' : ''}
                      </option>
                    )
                  })}
              </select>
            </div>

            {/* Upload button */}
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-teal-500 to-teal-600 text-white hover:from-teal-600 hover:to-teal-700 shadow-sm transition-all"
              id="header-upload-btn"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Upload</span>
            </button>

            {/* Search ⌘K */}
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] transition-all shadow-sm"
              id="header-search-btn"
            >
              <Search className="w-3.5 h-3.5 text-teal-500" />
              <span>Search</span>
              <kbd className="ml-1 px-1 py-0.5 rounded text-[10px] bg-[var(--bg-card)] border border-[var(--border)] font-mono text-[var(--text-muted)]">⌘K</kbd>
            </button>

            {/* Exclude deleted/lost */}
            <label
              className="hidden xl:flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer select-none px-2 py-1.5 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors border border-transparent hover:border-[var(--border)]"
              title="Toggle inclusion of Deleted and Lost opportunities"
            >
              <input
                type="checkbox"
                checked={includeDeletedLost}
                onChange={e => setIncludeDeletedLost(e.target.checked)}
                className="rounded border-[var(--border)] text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                id="header-include-deleted"
              />
              <span className="text-[11px] font-medium">Exclude Del/Lost</span>
            </label>

            {/* Theme toggle */}
            <button
              type="button"
              onClick={toggleDarkMode}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border)] transition-all shadow-sm"
              id="header-theme-toggle"
              title={darkMode ? 'Light mode' : 'Dark mode'}
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
            </button>

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex md:hidden w-8 h-8 rounded-lg items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border)]"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* ── ROW 2: Tab nav ───────────────────────────────────────────────── */}
        <nav className="hidden md:flex items-center gap-0.5 px-4 md:px-6 py-1.5 border-t border-[var(--border-subtle)] overflow-x-auto scrollbar-hide">
          {/* Left group */}
          {LEFT_TABS.map(t => <TabPill key={t.to} {...t} />)}

          {/* Divider */}
          <span className="mx-2 h-5 w-px bg-[var(--border)] flex-shrink-0" aria-hidden />

          {/* Always-visible right tabs */}
          {alwaysVisibleRight.map(t => <TabPill key={t.to} {...t} />)}

          {/* More dropdown for overflow right tabs */}
          {overflowRight.length > 0 && (
            <div className="relative flex-shrink-0" ref={moreRef}>
              <button
                type="button"
                onClick={() => setMoreOpen(!moreOpen)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all"
              >
                <MoreHorizontal className="w-4 h-4" />
                More
                <ChevronDown className={`w-3 h-3 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
              </button>
              {moreOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl p-1.5 z-50">
                  {overflowRight.map(t => (
                    <TabPill key={t.to} {...t} onClick={() => setMoreOpen(false)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* ── Mobile drawer ────────────────────────────────────────────────── */}
        {mobileOpen && (
          <div className="md:hidden border-t border-[var(--border)] p-3 grid grid-cols-2 gap-1">
            {[...LEFT_TABS, ...RIGHT_TABS].map(t => (
              <TabPill key={t.to} {...t} onClick={() => setMobileOpen(false)} />
            ))}
          </div>
        )}
      </header>

      {/* Upload modal */}
      {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} />}
    </>
  )
}
