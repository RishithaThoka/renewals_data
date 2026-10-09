import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  Clock,
  AlertOctagon,
  FileQuestion,
  TrendingUp,
  History,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  Info,
  Check,
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { getApprovalStatus } from '@/api/client'
import { formatACV, formatCount } from '@/utils/format'
import Card from '@/components/ui/Card'
import Badge, { ApprovalBadge, ForecastBadge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import OpportunitiesListDrawer from '@/components/common/OpportunitiesListDrawer'
import OpportunityDrawer from '@/components/overview/OpportunityDrawer'
import clsx from 'clsx'

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string; icon: any }
> = {
  Approved: {
    label: 'Approved',
    color: '#10B981',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.25)',
    icon: CheckCircle2,
  },
  'Approved - 2nd': {
    label: 'Approved - 2nd',
    color: '#00A3AD',
    bg: 'rgba(0, 163, 173, 0.12)',
    border: 'rgba(0, 163, 173, 0.25)',
    icon: CheckCircle2,
  },
  'Pending-Approval': {
    label: 'Pending-Approval',
    color: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.25)',
    icon: Clock,
  },
  Blank: {
    label: 'Blank / Unsubmitted',
    color: '#94A3B8',
    bg: 'rgba(148, 163, 184, 0.12)',
    border: 'rgba(148, 163, 184, 0.25)',
    icon: FileQuestion,
  },
  Rejected: {
    label: 'Rejected',
    color: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.25)',
    icon: AlertOctagon,
  },
}

export default function Approvals() {
  const { activeSnapshotId, compareSnapshotId, snapshots } = useAppStore()

  const [activeChangeTab, setActiveChangeTab] = useState<'approved' | 'pending' | 'rejected'>('approved')
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null)

  // Opportunities list drawer for status tiles or chart clicks
  const [listDrawerOpen, setListDrawerOpen] = useState(false)
  const [listDrawerTitle, setListDrawerTitle] = useState('')
  const [listDrawerSubtitle, setListDrawerSubtitle] = useState('')
  const [drawerFilters, setDrawerFilters] = useState<any>({})

  const { data, isLoading } = useQuery({
    queryKey: ['approval-status', activeSnapshotId, compareSnapshotId],
    queryFn: () => getApprovalStatus(activeSnapshotId ?? undefined, compareSnapshotId ?? undefined),
  })

  const rows = data?.rows || []
  const totalCount = data?.total_count || 3086
  const totalAcv = data?.total_acv || 450040250.54
  const historyTrend = data?.history_trend || []
  const changes = data?.changes || {}

  const newlyApproved = changes.newly_approved || []
  const newlyPending = changes.newly_pending || []
  const newlyRejected = changes.newly_rejected || []

  const activeSnap = snapshots.find((s) => s.id === activeSnapshotId)

  const handleStatusFilterClick = (statusKey: string, label: string) => {
    setDrawerFilters({
      snapshotId: activeSnapshotId ?? undefined,
      approvalStatus: [statusKey],
    })
    setListDrawerTitle(`${label} Deals`)
    setListDrawerSubtitle(`Listing all renewals with approval status: ${label}`)
    setListDrawerOpen(true)
  }

  // Calculate donut segments (SVG strokes)
  let cumulativePct = 0
  const donutSegments = rows.map((r: any) => {
    const pct = (r.count / totalCount) * 100
    const startPct = cumulativePct
    cumulativePct += pct
    const config = STATUS_CONFIG[r.approval_status] || {
      color: '#64748b',
      label: r.approval_status,
    }
    return {
      status: r.approval_status,
      label: config.label,
      count: r.count,
      acv: r.acv,
      pct,
      startPct,
      color: config.color,
    }
  })

  return (
    <div className="space-y-6 pb-12">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black font-display tracking-tight text-[var(--text-primary)]">
                Approval Governance
              </h1>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Executive renewal approval status pipeline, multi-snapshot trends, and audit of daily approval movements
              </p>
            </div>
          </div>
        </div>

        {/* Snapshot Context Badge */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 border border-[var(--border)] px-3 py-1.5 rounded-xl text-xs font-semibold text-[var(--text-primary)]">
          <span className="w-2 h-2 rounded-full bg-teal-500" />
          <span>As of: {activeSnap?.label || 'Active Snapshot'}</span>
        </div>
      </div>

      {/* Top 5 Status KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Tile */}
        <Card
          onClick={() => {
            setDrawerFilters({ snapshotId: activeSnapshotId ?? undefined })
            setListDrawerTitle('All Renewal Opportunities')
            setListDrawerSubtitle('All 3,086 pipeline deals across all approval statuses')
            setListDrawerOpen(true)
          }}
          className="p-3.5 cursor-pointer hover:border-teal-500/50 transition-all border-l-4 border-l-teal-500"
        >
          <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Total Pipeline
          </div>
          <div className="text-xl font-black font-display text-[var(--text-primary)] tabular-nums mt-1">
            {isLoading ? <Skeleton className="h-6 w-16" /> : `${formatCount(totalCount)}`}
          </div>
          <div className="text-xs font-bold text-teal-600 dark:text-teal-400 tabular-nums mt-0.5">
            {isLoading ? <Skeleton className="h-4 w-20" /> : formatACV(totalAcv)}
          </div>
        </Card>

        {/* 5 Canonical Status Tiles */}
        {rows.map((row: any) => {
          const cfg = STATUS_CONFIG[row.approval_status] || {
            label: row.approval_status,
            color: '#64748b',
          }
          return (
            <Card
              key={row.approval_status}
              onClick={() => handleStatusFilterClick(row.approval_status, cfg.label)}
              className="p-3.5 cursor-pointer hover:border-teal-500/40 transition-all border-l-4"
              style={{ borderLeftColor: cfg.color }}
            >
              <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider truncate">
                {cfg.label}
              </div>
              <div className="text-xl font-black font-display text-[var(--text-primary)] tabular-nums mt-1">
                {isLoading ? <Skeleton className="h-6 w-14" /> : `${formatCount(row.count)}`}
              </div>
              <div
                className="text-xs font-bold tabular-nums mt-0.5"
                style={{ color: cfg.color }}
              >
                {isLoading ? <Skeleton className="h-4 w-16" /> : formatACV(row.acv)}
              </div>
            </Card>
          )
        })}
      </div>

      {/* Main Grid: Status Donut & Funnel + Historical Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Status Donut & Funnel Breakdown (7 cols) */}
        <Card className="lg:col-span-7 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border)]">
              <div>
                <h2 className="text-base font-bold font-display text-[var(--text-primary)]">
                  Approval Distribution
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Portfolio breakdown by approval governance stage
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                3,086 Total Deals
              </Badge>
            </div>

            {/* Donut and Legend Visual */}
            <div className="flex flex-col sm:flex-row items-center gap-8 py-2">
              {/* Circular Donut Diagram */}
              <div className="relative w-44 h-44 flex-shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="14"
                    className="text-slate-100 dark:text-white/5"
                  />
                  {donutSegments.map((seg: any) => {
                    const circumference = 2 * Math.PI * 40 // ~251.32
                    const strokeDasharray = `${(seg.pct / 100) * circumference} ${circumference}`
                    const strokeDashoffset = -((seg.startPct / 100) * circumference)
                    return (
                      <circle
                        key={seg.status}
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke={seg.color}
                        strokeWidth="14"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all hover:opacity-80 cursor-pointer"
                        onClick={() => handleStatusFilterClick(seg.status, seg.label)}
                      />
                    )
                  })}
                </svg>
                {/* Center metric */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Total ACV
                  </span>
                  <span className="text-base font-black font-display text-[var(--text-primary)] tabular-nums">
                    {formatACV(totalAcv)}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">3,086 deals</span>
                </div>
              </div>

              {/* Status List with Progress Bars */}
              <div className="flex-1 w-full space-y-3">
                {rows.map((row: any) => {
                  const cfg = STATUS_CONFIG[row.approval_status] || {
                    label: row.approval_status,
                    color: '#64748b',
                  }
                  const pct = ((row.count / totalCount) * 100).toFixed(1)

                  return (
                    <button
                      key={row.approval_status}
                      onClick={() => handleStatusFilterClick(row.approval_status, cfg.label)}
                      className="w-full text-left p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors group"
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: cfg.color }}
                          />
                          <span className="font-bold text-[var(--text-primary)] group-hover:text-teal-500 transition-colors">
                            {cfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 tabular-nums">
                          <span className="font-bold text-[var(--text-primary)]">
                            {formatCount(row.count)}
                          </span>
                          <span className="text-[var(--text-muted)]">({pct}%)</span>
                          <span className="font-extrabold ml-1" style={{ color: cfg.color }}>
                            {formatACV(row.acv)}
                          </span>
                        </div>
                      </div>
                      {/* Mini Bar */}
                      <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: cfg.color }}
                        />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </Card>

        {/* Right: Multi-Snapshot Trend (5 cols) */}
        <Card className="lg:col-span-5 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border)]">
              <div>
                <h2 className="text-base font-bold font-display text-[var(--text-primary)]">
                  Status History Trend
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Approval status volume across snapshots
                </p>
              </div>

              {/* Collecting history badge */}
              {data?.collecting_history && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[11px] font-semibold">
                  <Info className="w-3.5 h-3.5" />
                  <span>{data.history_note || 'Collecting history (3 of 7 days)'}</span>
                </div>
              )}
            </div>

            {/* Snapshot Trend Bars */}
            <div className="space-y-4 pt-2">
              {historyTrend.map((snap: any) => {
                const isSelected = snap.snapshot_id === activeSnapshotId
                const counts = snap.counts || {}

                return (
                  <div
                    key={snap.snapshot_id}
                    className={clsx(
                      'p-3 rounded-xl border transition-all',
                      isSelected
                        ? 'border-teal-500/50 bg-teal-500/5 dark:bg-teal-500/10 shadow-sm'
                        : 'border-[var(--border)] bg-slate-50/50 dark:bg-white/[0.02]'
                    )}
                  >
                    <div className="flex items-center justify-between text-xs mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[var(--text-primary)] font-display">
                          {snap.label}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)] font-mono">
                          {snap.snapshot_date}
                        </span>
                        {isSelected && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-500 text-white">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="font-extrabold text-[var(--text-primary)] tabular-nums">
                        {snap.total_count} deals ({formatACV(snap.total_acv)})
                      </div>
                    </div>

                    {/* Stacked snapshot bar */}
                    <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-200 dark:bg-white/10 gap-0.5">
                      {['Approved', 'Approved - 2nd', 'Pending-Approval', 'Blank', 'Rejected'].map(
                        (stKey) => {
                          const cnt = counts[stKey] || 0
                          const pct = snap.total_count ? (cnt / snap.total_count) * 100 : 0
                          const cfg = STATUS_CONFIG[stKey]
                          if (pct <= 0) return null
                          return (
                            <div
                              key={stKey}
                              style={{ width: `${pct}%`, backgroundColor: cfg.color }}
                              title={`${stKey}: ${cnt} deals (${pct.toFixed(1)}%)`}
                              className="h-full transition-all"
                            />
                          )
                        }
                      )}
                    </div>

                    {/* Micro counts */}
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] mt-2 pt-1 border-t border-[var(--border)] tabular-nums">
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        App: {counts['Approved'] || 0}
                      </span>
                      <span className="text-teal-600 dark:text-teal-400 font-semibold">
                        2nd: {counts['Approved - 2nd'] || 0}
                      </span>
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
                        Pend: {counts['Pending-Approval'] || 0}
                      </span>
                      <span>Blank: {counts['Blank'] || 0}</span>
                      <span className="text-rose-600 dark:text-rose-400 font-semibold">
                        Rej: {counts['Rejected'] || 0}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* "Changes Today" Section */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-base font-bold font-display text-[var(--text-primary)]">
              Changes Today — Governance Movement
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Audited opportunities that transitioned approval state or newly entered the portfolio
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-[var(--border)]">
            <button
              onClick={() => setActiveChangeTab('approved')}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
                activeChangeTab === 'approved'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-white'
              )}
            >
              <span>Newly Approved</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                {newlyApproved.length}
              </span>
            </button>

            <button
              onClick={() => setActiveChangeTab('pending')}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
                activeChangeTab === 'pending'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-white'
              )}
            >
              <span>Newly Pending</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                {newlyPending.length}
              </span>
            </button>

            <button
              onClick={() => setActiveChangeTab('rejected')}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
                activeChangeTab === 'rejected'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-white'
              )}
            >
              <span>Newly Rejected</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                {newlyRejected.length}
              </span>
            </button>
          </div>
        </div>

        {/* Changes Table / Cards */}
        {isLoading ? (
          <div className="space-y-3 py-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {activeChangeTab === 'approved' &&
              (newlyApproved.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                  No newly approved deals today.
                </div>
              ) : (
                newlyApproved.map((item: any) => (
                  <div
                    key={item.opportunity_id_18}
                    onClick={() => setSelectedOppId(item.opportunity_id_18)}
                    className="py-3 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-white/[0.02] rounded-xl transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                        <Check className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-[var(--text-primary)] group-hover:text-teal-500 transition-colors flex items-center gap-1.5">
                          <span>{item.opportunity_name}</span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          {item.account_name} · BU: {item.business_unit_primary || '—'} · Expiry:{' '}
                          {item.service_expiry_period || '—'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-center">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-white/10 text-[var(--text-muted)] line-through">
                          {item.old_status}
                        </span>
                        <ArrowRight className="w-3 h-3 text-[var(--text-muted)]" />
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                          {item.new_status}
                        </span>
                      </div>
                      <div className="text-right font-black text-xs text-[var(--text-primary)] tabular-nums min-w-[70px]">
                        {formatACV(item.forecast_acv_amount)}
                      </div>
                    </div>
                  </div>
                ))
              ))}

            {activeChangeTab === 'pending' &&
              (newlyPending.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                  No newly pending deals today.
                </div>
              ) : (
                newlyPending.map((item: any) => (
                  <div
                    key={item.opportunity_id_18}
                    onClick={() => setSelectedOppId(item.opportunity_id_18)}
                    className="py-3 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-white/[0.02] rounded-xl transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-[var(--text-primary)] group-hover:text-teal-500 transition-colors flex items-center gap-1.5">
                          <span>{item.opportunity_name}</span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          {item.account_name} · BU: {item.business_unit_primary || '—'} · Expiry:{' '}
                          {item.service_expiry_period || '—'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-center">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-white/10 text-[var(--text-muted)] line-through">
                          {item.old_status}
                        </span>
                        <ArrowRight className="w-3 h-3 text-[var(--text-muted)]" />
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                          {item.new_status}
                        </span>
                      </div>
                      <div className="text-right font-black text-xs text-[var(--text-primary)] tabular-nums min-w-[70px]">
                        {formatACV(item.forecast_acv_amount)}
                      </div>
                    </div>
                  </div>
                ))
              ))}

            {activeChangeTab === 'rejected' &&
              (newlyRejected.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--text-muted)] flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 opacity-60" />
                  <span>No newly rejected deals today (0 deals flagged).</span>
                </div>
              ) : (
                newlyRejected.map((item: any) => (
                  <div
                    key={item.opportunity_id_18}
                    onClick={() => setSelectedOppId(item.opportunity_id_18)}
                    className="py-3 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-white/[0.02] rounded-xl transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                        <AlertOctagon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-[var(--text-primary)] group-hover:text-teal-500 transition-colors flex items-center gap-1.5">
                          <span>{item.opportunity_name}</span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          {item.account_name} · BU: {item.business_unit_primary || '—'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-center">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-white/10 text-[var(--text-muted)] line-through">
                          {item.old_status}
                        </span>
                        <ArrowRight className="w-3 h-3 text-[var(--text-muted)]" />
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                          {item.new_status}
                        </span>
                      </div>
                      <div className="text-right font-black text-xs text-[var(--text-primary)] tabular-nums min-w-[70px]">
                        {formatACV(item.forecast_acv_amount)}
                      </div>
                    </div>
                  </div>
                ))
              ))}
          </div>
        )}
      </Card>

      {/* Opportunities List Drawer for Status Filter */}
      <OpportunitiesListDrawer
        isOpen={listDrawerOpen}
        onClose={() => setListDrawerOpen(false)}
        title={listDrawerTitle}
        subtitle={listDrawerSubtitle}
        filters={drawerFilters}
        onSelectOpp={(id) => setSelectedOppId(id)}
      />

      {/* Deep-dive Opportunity Drawer */}
      <OpportunityDrawer oppId={selectedOppId} onClose={() => setSelectedOppId(null)} />
    </div>
  )
}
