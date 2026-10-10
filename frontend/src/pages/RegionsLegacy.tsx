import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe2,
  TrendingUp,
  TrendingDown,
  Building2,
  PieChart,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Layers,
  Sparkles,
  ArrowRight,
  Filter,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getRegionsOverview } from '@/api/client'
import { useAppStore } from '@/store/appStore'
import { formatACV, formatCount, formatPct } from '@/utils/format'
import Badge, { ForecastBadge, ApprovalBadge } from '@/components/ui/Badge'
import DeltaChip from '@/components/ui/DeltaChip'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'

// Simple SVG sparkline component
function MiniSparkline({ data, color = '#00A3AD', height = 28, width = 90 }: { data: number[]; color?: string; height?: number; width?: number }) {
  if (!data || data.length < 2) {
    return <div className="text-[10px] text-[var(--text-muted)] italic">No trend</div>
  }
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * (width - 6) + 3
      const y = height - 4 - ((val - min) / range) * (height - 8)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {data.map((val, idx) => {
        const x = (idx / (data.length - 1)) * (width - 6) + 3
        const y = height - 4 - ((val - min) / range) * (height - 8)
        return (
          <circle
            key={idx}
            cx={x}
            cy={y}
            r={idx === data.length - 1 ? 3 : 1.5}
            fill={idx === data.length - 1 ? color : 'var(--bg-card)'}
            stroke={color}
            strokeWidth="1.5"
          />
        )
      })}
    </svg>
  )
}

export default function RegionsLegacy() {
  const navigate = useNavigate()
  const activeSnapshotId = useAppStore((s) => s.activeSnapshotId)
  const compareSnapshotId = useAppStore((s) => s.compareSnapshotId)
  const setSelectedOppId = useAppStore((s) => s.setSelectedOppId)
  const setFilters = useAppStore((s) => s.setFilters)

  const [selectedRegionName, setSelectedRegionName] = useState<string>('North America')
  const [buMode, setBuMode] = useState<'as_in_excel' | 'split'>('as_in_excel')

  const { data, isLoading } = useQuery({
    queryKey: ['regions-overview', activeSnapshotId, compareSnapshotId, buMode],
    queryFn: () => getRegionsOverview(activeSnapshotId ?? undefined, compareSnapshotId ?? undefined, buMode),
  })

  const regions: any[] = useMemo(() => data?.regions ?? [], [data])
  const selectedRegion = useMemo(() => {
    return regions.find((r) => r.sub_region === selectedRegionName) || regions[0] || null
  }, [regions, selectedRegionName])

  const totalAcv = data?.total_acv ?? 0
  const totalCount = data?.total_count ?? 0

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <Globe2 className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black font-display text-[var(--text-primary)]">
              Regional Intelligence
            </h1>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Sub-Region renewal performance, leading Business Units, top opportunities and category mixes
          </p>
        </div>

        {/* BU Mode toggle & Global summary badge */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-xs">
            <button
              type="button"
              onClick={() => setBuMode('as_in_excel')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                buMode === 'as_in_excel'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              As in Excel
            </button>
            <button
              type="button"
              onClick={() => setBuMode('split')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                buMode === 'split'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Split by individual BU
            </button>
          </div>

          <div className="flex items-center gap-4 bg-[var(--bg-card)] px-4 py-2 rounded-2xl border border-[var(--border)] shadow-sm">
            <div>
              <p className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">
                Total Portfolio ACV
              </p>
              <p className="text-base font-black font-display text-[var(--text-primary)] tabular-nums">
                {formatACV(totalAcv)}
              </p>
            </div>
            <div className="h-7 w-px bg-[var(--border)]" />
            <div>
              <p className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">
                Opportunities
              </p>
              <p className="text-base font-black font-display text-teal-600 dark:text-teal-400 tabular-nums">
                {formatCount(totalCount)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Sub-Regions Overview Tiles */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Sub-Regions (Ranked by ACV)
              </h2>
              <span className="text-xs text-[var(--text-muted)] font-medium">
                {regions.length} Sub-Regions
              </span>
            </div>

            <div className="space-y-2.5">
              {regions.map((region, idx) => {
                const isSelected = selectedRegion?.sub_region === region.sub_region
                const sharePct = totalAcv > 0 ? (region.acv / totalAcv) * 100 : 0

                return (
                  <motion.div
                    key={region.sub_region}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setSelectedRegionName(region.sub_region)}
                    className={`p-4 rounded-2xl cursor-pointer transition-all border relative overflow-hidden ${
                      isSelected
                        ? 'bg-gradient-to-r from-teal-500/10 via-[var(--bg-card)] to-violet-500/10 border-teal-500 shadow-md ring-2 ring-teal-500/20'
                        : 'bg-[var(--bg-card)] border-[var(--border)] hover:border-teal-500/40 hover:shadow-sm'
                    }`}
                  >
                    {/* Share progress bar underline */}
                    <div
                      className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-teal-500 to-indigo-500 transition-all opacity-80"
                      style={{ width: `${Math.min(100, sharePct * 3)}%` }}
                    />

                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            idx === 0
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                              : idx === 1
                              ? 'bg-slate-300/40 text-slate-700 dark:text-slate-300'
                              : idx === 2
                              ? 'bg-amber-700/20 text-amber-700 dark:text-amber-300'
                              : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-[var(--text-primary)] truncate">
                            {region.sub_region}
                          </h3>
                          <p className="text-[11px] text-[var(--text-muted)]">
                            {formatCount(region.count)} deals · {formatPct(sharePct)} share
                          </p>
                        </div>
                      </div>

                      {/* Sparkline & Deltas */}
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className="font-display font-extrabold text-sm text-[var(--text-primary)] tabular-nums">
                          {formatACV(region.acv)}
                        </span>
                        <div className="mt-1">
                          <DeltaChip
                            value={region.delta_acv}
                            previousValue={region.prev_acv}
                            isCurrency
                            size="sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bottom Sparkline row */}
                    <div className="mt-3 pt-2.5 border-t border-[var(--border)] flex items-center justify-between text-xs">
                      <span className="text-[11px] text-[var(--text-muted)] truncate max-w-[140px]">
                        Leading BU: <strong className="text-[var(--text-primary)]">{region.leading_bu}</strong>
                      </span>
                      <div className="flex items-center gap-2">
                        <MiniSparkline data={region.sparkline} color={isSelected ? '#00A3AD' : '#8080FF'} />
                        <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-teal-500 translate-x-0.5' : 'text-[var(--text-muted)]'}`} />
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* RIGHT: Selected Region Detail View */}
          <div className="lg:col-span-7 space-y-6">
            {selectedRegion ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedRegion.sub_region}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  {/* Detail Hero Card */}
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-[#12284C]/5 via-[#00A3AD]/5 to-[#8080FF]/5 dark:from-[#12284C]/30 dark:via-[#00A3AD]/15 dark:to-[#8080FF]/20 border border-[var(--border)] shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-500/20 text-teal-700 dark:text-teal-300">
                            Sub-Region Detail
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">
                            Rank #{regions.findIndex((r) => r.sub_region === selectedRegion.sub_region) + 1}
                          </span>
                        </div>
                        <h2 className="text-2xl font-black font-display text-[var(--text-primary)]">
                          {selectedRegion.sub_region}
                        </h2>
                      </div>

                      <button
                        onClick={() => {
                          setFilters({ subRegion: [selectedRegion.sub_region] })
                          navigate('/opportunities')
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-all shadow-sm"
                      >
                        <Filter className="w-3.5 h-3.5" />
                        Explore in Table
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-[var(--border)] text-xs">
                      <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                        <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">
                          Total ACV
                        </span>
                        <span className="font-display font-black text-base text-[var(--text-primary)] tabular-nums">
                          {formatACV(selectedRegion.acv)}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                        <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">
                          Opportunities
                        </span>
                        <span className="font-display font-black text-base text-teal-600 dark:text-teal-400 tabular-nums">
                          {formatCount(selectedRegion.count)}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                        <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">
                          Change vs Prev
                        </span>
                        <div className="mt-0.5">
                          <DeltaChip
                            value={selectedRegion.delta_acv}
                            previousValue={selectedRegion.prev_acv}
                            isCurrency
                            size="sm"
                          />
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                        <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">
                          Leading BU
                        </span>
                        <span className="font-bold text-xs text-[var(--text-primary)] truncate block mt-0.5" title={selectedRegion.leading_bu}>
                          {selectedRegion.leading_bu}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Section: Top 10 Opportunities for this Region */}
                  <div className="card p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-teal-500" />
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">
                          Top 10 Opportunities in {selectedRegion.sub_region}
                        </h3>
                      </div>
                      <span className="text-xs text-[var(--text-muted)] font-medium">
                        Ranked by ACV
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {selectedRegion.top_10_opportunities.map((opp: any, idx: number) => {
                        const maxAcv = selectedRegion.top_10_opportunities[0]?.acv || 1
                        const barWidth = (opp.acv / maxAcv) * 100

                        return (
                          <div
                            key={opp.id || idx}
                            onClick={() => setSelectedOppId(opp.id || opp.opportunity_id_18)}
                            className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:border-teal-500/50 hover:bg-[var(--bg-card)] transition-all cursor-pointer group relative overflow-hidden"
                          >
                            {/* Horizontal Bar visualization behind card */}
                            <div
                              className="absolute top-0 bottom-0 left-0 bg-teal-500/10 dark:bg-teal-500/15 pointer-events-none transition-all group-hover:bg-teal-500/20"
                              style={{ width: `${barWidth}%` }}
                            />

                            <div className="flex items-center justify-between gap-3 relative z-10">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="w-5 h-5 rounded-full bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-[10px] font-bold text-[var(--text-muted)] flex-shrink-0 group-hover:border-teal-400 group-hover:text-teal-600">
                                  {idx + 1}
                                </span>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-xs text-[var(--text-primary)] group-hover:text-teal-600 dark:group-hover:text-teal-400 truncate">
                                      {opp.opportunity_name}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-[var(--text-muted)] truncate">
                                    <span className="font-mono text-[10px]">{opp.opportunity_id_18}</span> · {opp.account_name || 'N/A'} · BU: <span className="font-medium text-[var(--text-secondary)]">{opp.business_unit}</span>
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 flex-shrink-0">
                                <div className="hidden sm:flex items-center gap-1.5">
                                  <ForecastBadge category={opp.forecast_category} />
                                </div>
                                <span className="font-display font-extrabold text-sm text-[var(--text-primary)] tabular-nums">
                                  {formatACV(opp.acv)}
                                </span>
                                <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-teal-500 group-hover:translate-x-0.5 transition-transform" />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Section: Top 10 for the Region's Leading Business Unit */}
                  {selectedRegion.leading_bu && selectedRegion.leading_bu !== 'N/A' && (
                    <div className="card p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-violet-500" />
                          <h3 className="text-sm font-bold text-[var(--text-primary)]">
                            Leading BU Spotlight: {selectedRegion.leading_bu} ({selectedRegion.sub_region})
                          </h3>
                        </div>
                        <span className="text-xs text-[var(--text-muted)] font-medium">
                          Top deals in {selectedRegion.leading_bu}
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {selectedRegion.leading_bu_top_10.map((opp: any, idx: number) => {
                          const maxBuAcv = selectedRegion.leading_bu_top_10[0]?.acv || 1
                          const barWidth = (opp.acv / maxBuAcv) * 100

                          return (
                            <div
                              key={opp.id || idx}
                              onClick={() => setSelectedOppId(opp.id || opp.opportunity_id_18)}
                              className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:border-violet-500/50 hover:bg-[var(--bg-card)] transition-all cursor-pointer group relative overflow-hidden"
                            >
                              <div
                                className="absolute top-0 bottom-0 left-0 bg-violet-500/10 dark:bg-violet-500/15 pointer-events-none transition-all group-hover:bg-violet-500/20"
                                style={{ width: `${barWidth}%` }}
                              />

                              <div className="flex items-center justify-between gap-3 relative z-10">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="w-5 h-5 rounded-full bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-[10px] font-bold text-[var(--text-muted)] flex-shrink-0 group-hover:border-violet-400 group-hover:text-violet-600">
                                    {idx + 1}
                                  </span>
                                  <div className="min-w-0">
                                    <h4 className="font-bold text-xs text-[var(--text-primary)] group-hover:text-violet-600 dark:group-hover:text-violet-400 truncate">
                                      {opp.opportunity_name}
                                    </h4>
                                    <p className="text-[11px] text-[var(--text-muted)] truncate">
                                      <span className="font-mono text-[10px]">{opp.opportunity_id_18}</span> · {opp.account_name}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2.5 flex-shrink-0">
                                  <ForecastBadge category={opp.forecast_category} />
                                  <span className="font-display font-extrabold text-sm text-[var(--text-primary)] tabular-nums">
                                    {formatACV(opp.acv)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Section: Forecast Category & Approval Mix */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Forecast Category Mix */}
                    <div className="card p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <PieChart className="w-4 h-4 text-teal-500" />
                        <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                          Forecast Category Mix
                        </h4>
                      </div>

                      <div className="space-y-2">
                        {selectedRegion.forecast_category_mix.map((item: any) => {
                          const pct = selectedRegion.acv > 0 ? (item.acv / selectedRegion.acv) * 100 : 0
                          return (
                            <div key={item.category} className="space-y-1 text-xs">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <ForecastBadge category={item.category} />
                                  <span className="text-[11px] text-[var(--text-muted)]">
                                    ({formatCount(item.count)})
                                  </span>
                                </div>
                                <span className="font-bold font-display text-[var(--text-primary)] tabular-nums">
                                  {formatACV(item.acv)} <span className="text-[10px] text-[var(--text-muted)] font-normal">({formatPct(pct)})</span>
                                </span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-teal-500 transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Approval Mix */}
                    <div className="card p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-violet-500" />
                        <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                          Approval Mix
                        </h4>
                      </div>

                      <div className="space-y-2">
                        {selectedRegion.approval_status_mix.map((item: any) => {
                          const pct = selectedRegion.acv > 0 ? (item.acv / selectedRegion.acv) * 100 : 0
                          return (
                            <div key={item.status} className="space-y-1 text-xs">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <ApprovalBadge status={item.status} />
                                  <span className="text-[11px] text-[var(--text-muted)]">
                                    ({formatCount(item.count)})
                                  </span>
                                </div>
                                <span className="font-bold font-display text-[var(--text-primary)] tabular-nums">
                                  {formatACV(item.acv)} <span className="text-[10px] text-[var(--text-muted)] font-normal">({formatPct(pct)})</span>
                                </span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-indigo-500 transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="card p-12 text-center text-xs text-[var(--text-muted)]">
                Select a sub-region on the left to view details.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
