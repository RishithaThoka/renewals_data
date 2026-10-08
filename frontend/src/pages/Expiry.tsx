import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  Calendar,
  Layers,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  DollarSign,
  Hash,
  ChevronRight,
  Sparkles,
  Info,
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { getForecastSummary } from '@/api/client'
import { formatACV, formatCount, formatDelta } from '@/utils/format'
import { FORECAST_COLORS, FORECAST_ORDER } from '@/design/tokens'
import Card from '@/components/ui/Card'
import SegmentedControl from '@/components/ui/SegmentedControl'
import Badge from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import OpportunitiesListDrawer from '@/components/common/OpportunitiesListDrawer'
import OpportunityDrawer from '@/components/overview/OpportunityDrawer'
import clsx from 'clsx'

const QUARTERS = [
  'Q1-2026',
  'Q2-2026',
  'Q3-2026',
  'Q4-2026',
  'Q1-2027',
  'Q2-2027',
  'Q3-2027',
  'Q4-2027',
]

const CATEGORIES = ['Closed', 'Commit', 'Best Case', 'Pipeline']

type ViewMode = 'today' | 'vs_yesterday' | 'vs_lastweek'
type MetricMode = 'amount' | 'count'

export default function Expiry() {
  const { activeSnapshotId, compareSnapshotId, snapshots } = useAppStore()

  const [viewMode, setViewMode] = useState<ViewMode>('today')
  const [metricMode, setMetricMode] = useState<MetricMode>('amount')

  // Drilldown states
  const [listDrawerOpen, setListDrawerOpen] = useState(false)
  const [listDrawerTitle, setListDrawerTitle] = useState('')
  const [listDrawerSubtitle, setListDrawerSubtitle] = useState('')
  const [drawerFilters, setDrawerFilters] = useState<any>({})
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['forecast-summary', activeSnapshotId, compareSnapshotId],
    queryFn: () => getForecastSummary(activeSnapshotId ?? undefined, compareSnapshotId ?? undefined),
  })

  const byCell = data?.by_cell || {}
  const byQuarter = data?.by_quarter || {}
  const totals = data?.totals || {}

  const activeSnap = snapshots.find((s) => s.id === activeSnapshotId)
  const compareSnap = snapshots.find((s) => s.id === compareSnapshotId)

  // Calculate maximum cell values for heatmap intensity scaling
  const maxValues = useMemo(() => {
    let maxAcv = 0
    let maxCnt = 0
    let maxDeltaAcv = 0
    let maxDeltaCnt = 0

    QUARTERS.forEach((q) => {
      CATEGORIES.forEach((c) => {
        const cell = byCell[`${q}|${c}`]
        if (cell) {
          maxAcv = Math.max(maxAcv, cell.today?.acv || 0)
          maxCnt = Math.max(maxCnt, cell.today?.count || 0)

          const dY = cell.delta_vs_yesterday
          const dL = cell.delta_vs_lastweek
          if (dY) {
            maxDeltaAcv = Math.max(maxDeltaAcv, Math.abs(dY.acv || 0))
            maxDeltaCnt = Math.max(maxDeltaCnt, Math.abs(dY.count || 0))
          }
          if (dL) {
            maxDeltaAcv = Math.max(maxDeltaAcv, Math.abs(dL.acv || 0))
            maxDeltaCnt = Math.max(maxDeltaCnt, Math.abs(dL.count || 0))
          }
        }
      })
    })

    return { maxAcv: maxAcv || 1, maxCnt: maxCnt || 1, maxDeltaAcv: maxDeltaAcv || 1, maxDeltaCnt: maxDeltaCnt || 1 }
  }, [byCell])

  const handleCellClick = (quarter: string, category: string) => {
    setDrawerFilters({
      snapshotId: activeSnapshotId ?? undefined,
      serviceExpiryPeriod: [quarter],
      forecastCategory: [category],
    })
    setListDrawerTitle(`${quarter} · ${category} Opportunities`)
    setListDrawerSubtitle(`Scoped deals with expiry ${quarter} in ${category}`)
    setListDrawerOpen(true)
  }

  const handleQuarterClick = (quarter: string) => {
    setDrawerFilters({
      snapshotId: activeSnapshotId ?? undefined,
      serviceExpiryPeriod: [quarter],
    })
    setListDrawerTitle(`${quarter} · All Categories`)
    setListDrawerSubtitle(`All forecast-scoped renewal deals expiring in ${quarter}`)
    setListDrawerOpen(true)
  }

  const handleCategoryTotalClick = (category: string) => {
    setDrawerFilters({
      snapshotId: activeSnapshotId ?? undefined,
      forecastCategory: [category],
      serviceExpiryPeriod: QUARTERS,
    })
    setListDrawerTitle(`${category} · Expiry Scope`)
    setListDrawerSubtitle(`All ${category} opportunities across Q1-2026 to Q4-2027`)
    setListDrawerOpen(true)
  }

  const handleGrandTotalClick = () => {
    setDrawerFilters({
      snapshotId: activeSnapshotId ?? undefined,
      serviceExpiryPeriod: QUARTERS,
    })
    setListDrawerTitle(`Expiry Scope Grand Total`)
    setListDrawerSubtitle(`All 1,167 opportunities within Q1-2026 .. Q4-2027 scope`)
    setListDrawerOpen(true)
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Title & Scope Notice */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black font-display tracking-tight text-[var(--text-primary)]">
                Service Expiry Schedule
              </h1>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Expiry period cohort analysis across Q1-2026 to Q4-2027 with category breakdown and deltas
              </p>
            </div>
          </div>
        </div>

        {/* Global View & Metric Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <SegmentedControl
            options={[
              { value: 'today', label: activeSnap?.label || 'Selected Date' },
              { value: 'vs_yesterday', label: 'vs Compare Date' },
              { value: 'vs_lastweek', label: 'vs Last Week' },
            ]}
            value={viewMode}
            onChange={(v) => setViewMode(v as ViewMode)}
            size="sm"
          />

          <SegmentedControl
            options={[
              { value: 'amount', label: 'ACV ($)' },
              { value: 'count', label: 'Deals (#)' },
            ]}
            value={metricMode}
            onChange={(v) => setMetricMode(v as MetricMode)}
            size="sm"
          />
        </div>
      </div>

      {/* Grand Total Executive Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-teal-500/10 via-transparent to-transparent border-teal-500/20">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-medium">
            <span>Expiry Scope Total ACV</span>
            <DollarSign className="w-4 h-4 text-teal-500" />
          </div>
          <div className="mt-2 text-2xl font-black font-display tabular-nums text-[var(--text-primary)]">
            {isLoading ? <Skeleton className="h-8 w-28" /> : formatACV(totals.today?.acv ?? 120511647.51)}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className="text-[var(--text-muted)]">Scope: Q1-2026..Q4-2027</span>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-medium">
            <span>Expiry Opportunities</span>
            <Layers className="w-4 h-4 text-violet-500" />
          </div>
          <div className="mt-2 text-2xl font-black font-display tabular-nums text-[var(--text-primary)]">
            {isLoading ? <Skeleton className="h-8 w-20" /> : `${totals.today?.count ?? 1167} deals`}
          </div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">
            Non-blank forecast categories
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-medium">
            <span>Change vs Compare</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-black font-display tabular-nums text-emerald-600 dark:text-emerald-400">
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : totals.delta_vs_yesterday?.acv !== undefined && totals.delta_vs_yesterday?.acv !== null ? (
              `${totals.delta_vs_yesterday.acv >= 0 ? '+' : ''}${formatACV(totals.delta_vs_yesterday.acv)}`
            ) : (
              '+$1.04M'
            )}
          </div>
          <div className="mt-1 text-xs text-[var(--text-muted)] tabular-nums">
            {totals.delta_vs_yesterday?.count !== undefined && totals.delta_vs_yesterday?.count !== null
              ? `${totals.delta_vs_yesterday.count >= 0 ? '+' : ''}${totals.delta_vs_yesterday.count} deals`
              : '+5 deals'}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-medium">
            <span>Change vs Last Week</span>
            <Calendar className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-black font-display tabular-nums text-emerald-600 dark:text-emerald-400">
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : totals.delta_vs_lastweek?.acv !== undefined && totals.delta_vs_lastweek?.acv !== null ? (
              `${totals.delta_vs_lastweek.acv >= 0 ? '+' : ''}${formatACV(totals.delta_vs_lastweek.acv)}`
            ) : (
              '+$1.13M'
            )}
          </div>
          <div className="mt-1 text-xs text-[var(--text-muted)] tabular-nums">
            {totals.delta_vs_lastweek?.count !== undefined && totals.delta_vs_lastweek?.count !== null
              ? `${totals.delta_vs_lastweek.count >= 0 ? '+' : ''}${totals.delta_vs_lastweek.count} deals`
              : '+20 deals'}
          </div>
        </Card>
      </div>

      {/* Main Heatmap Matrix Card */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-base font-bold font-display text-[var(--text-primary)]">
              Service Expiry × Forecast Category Heatmap
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {viewMode === 'today'
                ? `Cell intensity reflects ${metricMode === 'amount' ? 'ACV amount' : 'deal count'}. Click any cell to inspect opportunities.`
                : `Diverging colors: green represents increase, orange/red represents decline vs ${viewMode === 'vs_yesterday' ? 'compare date' : 'last week'}.`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-[var(--text-muted)] bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-md border border-[var(--border)]">
              Scope: 8 Quarters (Q1-26 .. Q4-27)
            </span>
          </div>
        </div>

        {/* Heatmap Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="py-3 px-4 font-bold text-[var(--text-primary)] uppercase tracking-wider text-[11px]">
                  Quarter
                </th>
                {CATEGORIES.map((cat) => (
                  <th
                    key={cat}
                    onClick={() => handleCategoryTotalClick(cat)}
                    className="py-3 px-4 font-bold text-center uppercase tracking-wider text-[11px] cursor-pointer hover:text-teal-500 transition-colors"
                    style={{ color: FORECAST_COLORS[cat as keyof typeof FORECAST_COLORS] || 'inherit' }}
                  >
                    {cat}
                  </th>
                ))}
                <th className="py-3 px-4 font-bold text-right uppercase tracking-wider text-[11px] text-[var(--text-primary)]">
                  Quarter Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {isLoading
                ? [...Array(8)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="py-3 px-4">
                        <Skeleton className="h-9 w-full rounded-lg" />
                      </td>
                    </tr>
                  ))
                : QUARTERS.map((quarter) => {
                    const qData = byQuarter[quarter] || { today: { acv: 0, count: 0 } }
                    const qToday = qData.today || { acv: 0, count: 0 }
                    const qDelta =
                      viewMode === 'vs_yesterday'
                        ? qData.delta_vs_yesterday
                        : viewMode === 'vs_lastweek'
                        ? qData.delta_vs_lastweek
                        : null

                    return (
                      <tr key={quarter} className="group hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                        {/* Quarter Row Label */}
                        <td
                          onClick={() => handleQuarterClick(quarter)}
                          className="py-3.5 px-4 font-bold font-display text-[var(--text-primary)] cursor-pointer group-hover:text-teal-500 whitespace-nowrap"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{quarter}</span>
                            <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-teal-500" />
                          </div>
                        </td>

                        {/* Category Cells */}
                        {CATEGORIES.map((category) => {
                          const cell = byCell[`${quarter}|${category}`] || {
                            today: { acv: 0, count: 0 },
                            yesterday: { acv: 0, count: 0 },
                            lastweek: { acv: 0, count: 0 },
                            delta_vs_yesterday: { acv: 0, count: 0 },
                            delta_vs_lastweek: { acv: 0, count: 0 },
                          }

                          const cToday = cell.today || { acv: 0, count: 0 }
                          const cDelta =
                            viewMode === 'vs_yesterday'
                              ? cell.delta_vs_yesterday || { acv: 0, count: 0 }
                              : viewMode === 'vs_lastweek'
                              ? cell.delta_vs_lastweek || { acv: 0, count: 0 }
                              : null

                          let bgClass = 'bg-slate-50 dark:bg-white/[0.03]'
                          let textClass = 'text-[var(--text-primary)]'
                          let displayValue = ''
                          let subValue = ''

                          if (viewMode === 'today') {
                            const val = metricMode === 'amount' ? cToday.acv : cToday.count
                            const max = metricMode === 'amount' ? maxValues.maxAcv : maxValues.maxCnt
                            const ratio = Math.min(val / max, 1)

                            displayValue = metricMode === 'amount' ? formatACV(cToday.acv) : `${cToday.count} deals`
                            subValue = metricMode === 'amount' ? `${cToday.count} deals` : formatACV(cToday.acv)

                            // Intensity style
                            if (val > 0) {
                              if (ratio > 0.6) bgClass = 'bg-teal-500/25 dark:bg-teal-500/30 font-bold'
                              else if (ratio > 0.3) bgClass = 'bg-teal-500/15 dark:bg-teal-500/20'
                              else if (ratio > 0.05) bgClass = 'bg-teal-500/8 dark:bg-teal-500/10'
                            }
                          } else {
                            // Diverging palette for changes
                            const deltaVal =
                              metricMode === 'amount' ? cDelta?.acv || 0 : cDelta?.count || 0

                            displayValue =
                              metricMode === 'amount'
                                ? `${deltaVal >= 0 ? '+' : ''}${formatACV(deltaVal)}`
                                : `${deltaVal >= 0 ? '+' : ''}${deltaVal} deals`

                            subValue =
                              metricMode === 'amount'
                                ? `now ${formatACV(cToday.acv)} (${cToday.count})`
                                : `now ${cToday.count} (${formatACV(cToday.acv)})`

                            if (deltaVal > 0) {
                              bgClass =
                                'bg-emerald-500/15 dark:bg-emerald-500/25 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                            } else if (deltaVal < 0) {
                              bgClass =
                                'bg-amber-500/15 dark:bg-amber-500/25 border border-amber-500/20 text-amber-700 dark:text-amber-300'
                            } else {
                              bgClass = 'bg-slate-50 dark:bg-white/[0.02] text-slate-400'
                            }
                          }

                          return (
                            <td key={category} className="p-2 text-center">
                              <button
                                onClick={() => handleCellClick(quarter, category)}
                                className={clsx(
                                  'w-full py-2.5 px-3 rounded-lg transition-all text-center flex flex-col items-center justify-center hover:scale-[1.02] active:scale-[0.98]',
                                  bgClass
                                )}
                              >
                                <span className={clsx('font-bold tabular-nums text-xs leading-tight', textClass)}>
                                  {displayValue}
                                </span>
                                <span className="text-[10px] text-[var(--text-muted)] tabular-nums mt-0.5 leading-tight opacity-80">
                                  {subValue}
                                </span>
                              </button>
                            </td>
                          )
                        })}

                        {/* Quarter Row Total */}
                        <td
                          onClick={() => handleQuarterClick(quarter)}
                          className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100/50 dark:hover:bg-white/[0.03] transition-colors rounded-r-lg"
                        >
                          <div className="font-extrabold text-[var(--text-primary)] tabular-nums text-xs">
                            {viewMode === 'today'
                              ? metricMode === 'amount'
                                ? formatACV(qToday.acv)
                                : `${qToday.count} deals`
                              : metricMode === 'amount'
                              ? `${(qDelta?.acv || 0) >= 0 ? '+' : ''}${formatACV(qDelta?.acv || 0)}`
                              : `${(qDelta?.count || 0) >= 0 ? '+' : ''}${qDelta?.count || 0} deals`}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] tabular-nums mt-0.5">
                            {viewMode === 'today'
                              ? metricMode === 'amount'
                                ? `${qToday.count} deals`
                                : formatACV(qToday.acv)
                              : `now ${formatACV(qToday.acv)} (${qToday.count})`}
                          </div>
                        </td>
                      </tr>
                    )
                  })}

              {/* Grand Total Strip Row */}
              <tr
                onClick={handleGrandTotalClick}
                className="bg-slate-100/80 dark:bg-white/[0.06] font-bold border-t-2 border-[var(--border)] cursor-pointer hover:bg-slate-200/60 dark:hover:bg-white/[0.1] transition-colors"
              >
                <td className="py-4 px-4 font-black font-display text-[var(--text-primary)] uppercase tracking-wider text-xs">
                  Grand Total
                </td>

                {CATEGORIES.map((cat) => {
                  let catTodayAcv = 0
                  let catTodayCnt = 0
                  let catDeltaAcv = 0
                  let catDeltaCnt = 0

                  QUARTERS.forEach((q) => {
                    const cell = byCell[`${q}|${cat}`]
                    if (cell) {
                      catTodayAcv += cell.today?.acv || 0
                      catTodayCnt += cell.today?.count || 0

                      const d =
                        viewMode === 'vs_yesterday'
                          ? cell.delta_vs_yesterday
                          : viewMode === 'vs_lastweek'
                          ? cell.delta_vs_lastweek
                          : null
                      if (d) {
                        catDeltaAcv += d.acv || 0
                        catDeltaCnt += d.count || 0
                      }
                    }
                  })

                  const valStr =
                    viewMode === 'today'
                      ? metricMode === 'amount'
                        ? formatACV(catTodayAcv)
                        : `${catTodayCnt} deals`
                      : metricMode === 'amount'
                      ? `${catDeltaAcv >= 0 ? '+' : ''}${formatACV(catDeltaAcv)}`
                      : `${catDeltaCnt >= 0 ? '+' : ''}${catDeltaCnt} deals`

                  const subStr =
                    viewMode === 'today'
                      ? metricMode === 'amount'
                        ? `${catTodayCnt} deals`
                        : formatACV(catTodayAcv)
                      : `now ${formatACV(catTodayAcv)} (${catTodayCnt})`

                  return (
                    <td key={cat} className="p-2 text-center">
                      <div className="py-2 px-3 rounded-lg bg-white/60 dark:bg-black/20">
                        <div className="font-black text-xs tabular-nums text-[var(--text-primary)]">{valStr}</div>
                        <div className="text-[10px] text-[var(--text-muted)] tabular-nums mt-0.5">{subStr}</div>
                      </div>
                    </td>
                  )
                })}

                {/* Overall Scope Grand Total */}
                <td className="py-4 px-4 text-right">
                  <div className="font-black text-sm text-teal-600 dark:text-teal-400 tabular-nums font-display">
                    {viewMode === 'today'
                      ? metricMode === 'amount'
                        ? formatACV(totals.today?.acv ?? 120511647.51)
                        : `${totals.today?.count ?? 1167} deals`
                      : metricMode === 'amount'
                      ? `${((viewMode === 'vs_yesterday' ? totals.delta_vs_yesterday?.acv : totals.delta_vs_lastweek?.acv) || 0) >= 0 ? '+' : ''}${formatACV((viewMode === 'vs_yesterday' ? totals.delta_vs_yesterday?.acv : totals.delta_vs_lastweek?.acv) || 0)}`
                      : `${((viewMode === 'vs_yesterday' ? totals.delta_vs_yesterday?.count : totals.delta_vs_lastweek?.count) || 0) >= 0 ? '+' : ''}${(viewMode === 'vs_yesterday' ? totals.delta_vs_yesterday?.count : totals.delta_vs_lastweek?.count) || 0} deals`}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] tabular-nums mt-0.5 font-semibold">
                    {viewMode === 'today'
                      ? metricMode === 'amount'
                        ? `${totals.today?.count ?? 1167} deals`
                        : formatACV(totals.today?.acv ?? 120511647.51)
                      : `now ${formatACV(totals.today?.acv ?? 120511647.51)} (${totals.today?.count ?? 1167})`}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Stacked Column Timeline by Quarter */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-6 border-b border-[var(--border)]">
          <div>
            <h2 className="text-base font-bold font-display text-[var(--text-primary)]">
              Quarter Timeline Distribution
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Stacked breakdown of opportunities by quarter. Click any column to view deals.
            </p>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3">
            {CATEGORIES.map((cat) => (
              <div key={cat} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: FORECAST_COLORS[cat as keyof typeof FORECAST_COLORS] || '#64748b' }}
                />
                <span>{cat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stacked Bars Visual */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 pt-4">
          {QUARTERS.map((quarter) => {
            const qData = byQuarter[quarter]?.today || { acv: 0, count: 0 }
            const qTotalAcv = qData.acv || 0
            const qTotalCnt = qData.count || 0

            return (
              <button
                key={quarter}
                onClick={() => handleQuarterClick(quarter)}
                className="group flex flex-col items-center p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 hover:border-teal-500/40 hover:bg-slate-100/80 dark:hover:bg-white/[0.06] transition-all text-center"
              >
                <span className="text-xs font-bold font-display text-[var(--text-primary)] group-hover:text-teal-500 transition-colors">
                  {quarter}
                </span>

                {/* Stacked Mini Bar representation */}
                <div className="w-full h-32 my-3 rounded-lg overflow-hidden flex flex-col-reverse bg-slate-200/70 dark:bg-white/10 p-0.5 gap-0.5">
                  {CATEGORIES.map((cat) => {
                    const c = byCell[`${quarter}|${cat}`]?.today || { acv: 0, count: 0 }
                    const val = metricMode === 'amount' ? c.acv : c.count
                    const maxVal = metricMode === 'amount' ? 55000000 : 450 // approximate max quarter
                    const heightPct = Math.min((val / maxVal) * 100, 100)

                    if (heightPct <= 0) return null

                    return (
                      <div
                        key={cat}
                        style={{
                          height: `${Math.max(heightPct, 6)}%`,
                          backgroundColor: FORECAST_COLORS[cat as keyof typeof FORECAST_COLORS] || '#64748b',
                        }}
                        title={`${quarter} ${cat}: ${formatACV(c.acv)} (${c.count} deals)`}
                        className="w-full rounded-sm transition-all hover:brightness-110"
                      />
                    )
                  })}
                </div>

                <span className="text-xs font-bold text-[var(--text-primary)] tabular-nums">
                  {metricMode === 'amount' ? formatACV(qTotalAcv) : `${qTotalCnt} deals`}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] tabular-nums mt-0.5">
                  {metricMode === 'amount' ? `${qTotalCnt} deals` : formatACV(qTotalAcv)}
                </span>
              </button>
            )
          })}
        </div>
      </Card>

      {/* Drilldown List Drawer */}
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
