import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock,
  GitCompare,
  UploadCloud,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Layers,
  ArrowRight,
  Info,
  Calendar,
  CheckCircle2,
  Sparkles,
  BarChart3,
  LineChart,
} from 'lucide-react'
import { getHistoryOverview, getComparison, getSnapshots } from '@/api/client'
import { formatACV, formatDate, formatCount, formatPct } from '@/utils/format'
import DeltaChip from '@/components/ui/DeltaChip'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import Badge, { ForecastBadge, ApprovalBadge } from '@/components/ui/Badge'

type MetricChoice = 'total_acv' | 'count' | 'category_acv' | 'approval_counts'

export default function History() {
  const [selectedMetric, setSelectedMetric] = useState<MetricChoice>('total_acv')
  const [compareFromDate, setCompareFromDate] = useState<string>('2026-10-05')
  const [compareToDate, setCompareToDate] = useState<string>('2026-10-06')

  // Fetch History Overview
  const { data: histData, isLoading: histLoading } = useQuery({
    queryKey: ['history-overview'],
    queryFn: getHistoryOverview,
  })

  // Fetch Comparison for selected two dates
  const { data: compareData, isLoading: compareLoading } = useQuery({
    queryKey: ['history-compare', compareFromDate, compareToDate],
    queryFn: () => getComparison(compareFromDate, compareToDate),
    enabled: !!compareFromDate && !!compareToDate && compareFromDate !== compareToDate,
  })

  const snapshots: any[] = useMemo(() => histData?.snapshots ?? [], [histData])
  const trends: any = useMemo(() => histData?.trends ?? {}, [histData])
  const hasSufficientHistory = histData?.has_sufficient_history ?? false
  const historyNote = histData?.history_note ?? 'Collecting history — 3 data points available'

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <Clock className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black font-display text-[var(--text-primary)]">
              Snapshot & Upload History
            </h1>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Audit logs of every ingested workbook, two-date comparative diffs, and trend evolution
          </p>
        </div>

        {/* History status pill */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-medium">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{historyNote}</span>
        </div>
      </div>

      {/* SECTION 1: TREND CHARTS ACROSS SNAPSHOTS */}
      <div className="card p-6 space-y-5 border border-[var(--border)] bg-[var(--bg-card)] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-teal-500" />
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Snapshot Trend Charts
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Observed metric values across chronological database uploads
              </p>
            </div>
          </div>

          {/* Metric Selector Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-xs">
            <button
              type="button"
              onClick={() => setSelectedMetric('total_acv')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                selectedMetric === 'total_acv'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Total ACV
            </button>
            <button
              type="button"
              onClick={() => setSelectedMetric('count')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                selectedMetric === 'count'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Opportunities
            </button>
            <button
              type="button"
              onClick={() => setSelectedMetric('category_acv')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                selectedMetric === 'category_acv'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Category ACV
            </button>
            <button
              type="button"
              onClick={() => setSelectedMetric('approval_counts')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                selectedMetric === 'approval_counts'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Approval Counts
            </button>
          </div>
        </div>

        {/* Chart Visualization Container */}
        {histLoading ? (
          <Skeleton variant="card" height="200px" />
        ) : (
          <div className="pt-2">
            {/* 1. Total ACV Trend */}
            {selectedMetric === 'total_acv' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {trends.total_acv?.map((item: any, idx: number) => (
                    <div
                      key={item.date}
                      className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-teal-600 dark:text-teal-400">
                          {item.label}
                        </span>
                        <span className="text-[var(--text-muted)]">{formatDate(item.date)}</span>
                      </div>
                      <span className="font-display font-black text-xl text-[var(--text-primary)] tabular-nums">
                        {formatACV(item.value)}
                      </span>
                      {idx > 0 && (
                        <div className="mt-2 pt-2 border-t border-[var(--border)] text-[11px]">
                          <DeltaChip
                            value={item.value - trends.total_acv[idx - 1].value}
                            previousValue={trends.total_acv[idx - 1].value}
                            isCurrency
                            size="sm"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Opportunities Count Trend */}
            {selectedMetric === 'count' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {trends.count?.map((item: any, idx: number) => (
                  <div
                    key={item.date}
                    className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-teal-600 dark:text-teal-400">
                        {item.label}
                      </span>
                      <span className="text-[var(--text-muted)]">{formatDate(item.date)}</span>
                    </div>
                    <span className="font-display font-black text-xl text-[var(--text-primary)] tabular-nums">
                      {formatCount(item.value)} deals
                    </span>
                    {idx > 0 && (
                      <div className="mt-2 pt-2 border-t border-[var(--border)] text-[11px]">
                        <DeltaChip
                          value={item.value - trends.count[idx - 1].value}
                          previousValue={trends.count[idx - 1].value}
                          size="sm"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 3. Category ACV Multi-Series */}
            {selectedMetric === 'category_acv' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {Object.entries(trends.category_acv || {}).map(([cat, series]: [string, any]) => {
                    const latest = series[series.length - 1]?.value ?? 0
                    const prev = series[series.length - 2]?.value ?? 0
                    return (
                      <div
                        key={cat}
                        className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] space-y-2"
                      >
                        <ForecastBadge category={cat} />
                        <p className="font-display font-extrabold text-base text-[var(--text-primary)] tabular-nums">
                          {formatACV(latest)}
                        </p>
                        <div className="pt-1.5 border-t border-[var(--border)] text-[11px]">
                          <DeltaChip value={latest - prev} previousValue={prev} isCurrency size="sm" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 4. Approval Counts Multi-Series */}
            {selectedMetric === 'approval_counts' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {Object.entries(trends.approval_counts || {}).map(([status, series]: [string, any]) => {
                  const latest = series[series.length - 1]?.value ?? 0
                  const prev = series[series.length - 2]?.value ?? 0
                  return (
                    <div
                      key={status}
                      className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] space-y-2"
                    >
                      <ApprovalBadge status={status} />
                      <p className="font-display font-extrabold text-base text-[var(--text-primary)] tabular-nums">
                        {formatCount(latest)} deals
                      </p>
                      <div className="pt-1.5 border-t border-[var(--border)] text-[11px]">
                        <DeltaChip value={latest - prev} previousValue={prev} size="sm" />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Collecting history callout */}
            {!hasSufficientHistory && (
              <div className="mt-4 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center gap-3 text-xs text-[var(--text-muted)]">
                <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span>
                  <strong>Note:</strong> We are actively collecting snapshot history. 3 daily data points currently recorded. Full 30-day statistical smoothing and predictive run-rate models activate automatically at 7+ snapshot points.
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 2 & 3: GRID LAYOUT (Timeline on Left, Compare View on Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT: Timeline of Every Upload */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-teal-500" />
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              Upload Timeline
            </h2>
          </div>

          <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-3 before:bottom-3 before:w-0.5 before:bg-[var(--border)]">
            {snapshots.map((snap, idx) => {
              const isToday = snap.is_active_today
              return (
                <div key={snap.id} className="relative group">
                  {/* Indicator Dot */}
                  <div
                    className={`absolute -left-[23px] top-3.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--bg-card)] transition-colors ${
                      isToday
                        ? 'bg-teal-500 ring-4 ring-teal-500/20'
                        : 'bg-[var(--border)] group-hover:bg-teal-400'
                    }`}
                  />

                  <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] hover:border-teal-500/50 hover:shadow-md transition-all space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-[var(--text-primary)]">
                            {snap.label}
                          </h3>
                          {isToday && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-500/20 text-teal-700 dark:text-teal-300">
                              Active Today
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          {formatDate(snap.snapshot_date)}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="font-display font-black text-sm text-[var(--text-primary)] tabular-nums">
                          {formatACV(snap.total_acv)}
                        </span>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {formatCount(snap.row_count)} rows
                        </p>
                      </div>
                    </div>

                    {/* What changed highlight chip */}
                    <div className="p-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-xs flex items-center justify-between">
                      <span className="text-[var(--text-muted)]">Changes:</span>
                      <strong className="text-teal-600 dark:text-teal-400">
                        {snap.what_changed}
                      </strong>
                    </div>

                    {/* Source files info */}
                    <div className="pt-2 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)] space-y-1">
                      {snap.source_file_summary && (
                        <div className="flex items-center gap-1.5 truncate">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                          <span className="truncate">{snap.source_file_summary}</span>
                        </div>
                      )}
                      {snap.source_file_comparison && (
                        <div className="flex items-center gap-1.5 truncate">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                          <span className="truncate">{snap.source_file_comparison}</span>
                        </div>
                      )}
                    </div>

                    {/* Fast Compare Setters */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setCompareFromDate(snap.snapshot_date)}
                        className={`flex-1 py-1 px-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                          compareFromDate === snap.snapshot_date
                            ? 'bg-[#12284C] text-white border-[#12284C]'
                            : 'bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-secondary)] hover:border-teal-500/40'
                        }`}
                      >
                        Set Baseline
                      </button>
                      <button
                        type="button"
                        onClick={() => setCompareToDate(snap.snapshot_date)}
                        className={`flex-1 py-1 px-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                          compareToDate === snap.snapshot_date
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-secondary)] hover:border-teal-500/40'
                        }`}
                      >
                        Set Current
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT: Compare Any Two Dates View */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-indigo-500" />
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              Compare Any Two Dates
            </h2>
          </div>

          <div className="card p-5 space-y-5 border border-[var(--border)] bg-[var(--bg-card)] shadow-sm">
            {/* Selectors Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                  Baseline ("From") Date
                </label>
                <select
                  value={compareFromDate}
                  onChange={(e) => setCompareFromDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {snapshots.map((s) => (
                    <option key={s.id} value={s.snapshot_date}>
                      {s.label} ({formatDate(s.snapshot_date)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                  Target ("To") Date
                </label>
                <select
                  value={compareToDate}
                  onChange={(e) => setCompareToDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {snapshots.map((s) => (
                    <option key={s.id} value={s.snapshot_date}>
                      {s.label} ({formatDate(s.snapshot_date)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {compareFromDate === compareToDate ? (
              <div className="py-12 text-center text-xs text-amber-600 dark:text-amber-400">
                Please select two different snapshot dates to generate a comparative analysis.
              </div>
            ) : compareLoading ? (
              <div className="space-y-4">
                <Skeleton variant="card" height="90px" />
                <Skeleton variant="card" height="150px" />
              </div>
            ) : compareData ? (
              <div className="space-y-5">
                {/* Headline Banner */}
                {compareData.headline && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-500/10 via-[var(--bg-secondary)] to-indigo-500/10 border border-teal-500/20 space-y-2">
                    <p className="font-extrabold text-sm text-[var(--text-primary)]">
                      {compareData.headline.text}
                    </p>
                    {compareData.headline.chips && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {compareData.headline.chips.map((chip: any, i: number) => {
                          const label = typeof chip === 'string' ? chip : chip?.label
                          const value = typeof chip === 'string' ? '' : chip?.value
                          return (
                            <span
                              key={i}
                              className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)]"
                            >
                              {label}{value ? `: ${value}` : ''}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Diff Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
                    <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">
                      Total ACV Diff
                    </span>
                    <p className="font-display font-black text-base text-[var(--text-primary)] tabular-nums">
                      {compareData.diff?.acv >= 0 ? '+' : ''}
                      {formatACV(compareData.diff?.acv ?? 0)}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
                    <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">
                      Deal Count Diff
                    </span>
                    <p className="font-display font-black text-base text-teal-600 dark:text-teal-400 tabular-nums">
                      {compareData.diff?.count >= 0 ? '+' : ''}
                      {compareData.diff?.count ?? 0} deals
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
                    <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">
                      Commit Movement
                    </span>
                    <p className="font-display font-black text-base text-indigo-600 dark:text-indigo-400 tabular-nums">
                      {formatACV(compareData.kpi_strip?.find((k: any) => k.category === 'Commit')?.diff?.acv ?? 0)}
                    </p>
                  </div>
                </div>

                {/* Category Comparison Grid */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Category Breakdown (Baseline vs Current)
                  </h3>
                  <div className="space-y-1.5">
                    {compareData.forecast_category?.map((item: any) => (
                      <div
                        key={item.category}
                        className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <ForecastBadge category={item.category} />
                          <span className="text-[var(--text-muted)]">
                            {item.from_count} → {item.to_count} ({item.count_diff >= 0 ? '+' : ''}{item.count_diff})
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[var(--text-muted)]">
                            {formatACV(item.from_acv)} → <strong className="text-[var(--text-primary)]">{formatACV(item.to_acv)}</strong>
                          </span>
                          <DeltaChip
                            value={item.acv_diff}
                            previousValue={item.from_acv}
                            isCurrency
                            size="sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Region Comparison Preview */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Regional Net Deltas
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {compareData.region?.map((reg: any) => (
                      <div
                        key={reg.region}
                        className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-between"
                      >
                        <span className="font-semibold text-[var(--text-primary)] truncate max-w-[130px]">
                          {reg.region}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-display font-bold tabular-nums">
                            {formatACV(reg.to_acv)}
                          </span>
                          <DeltaChip
                            value={reg.acv_diff}
                            previousValue={reg.from_acv}
                            isCurrency
                            size="sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
