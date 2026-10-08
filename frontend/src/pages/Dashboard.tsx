import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCw, Upload, AlertTriangle, TrendingUp, TrendingDown,
  ChevronRight, X, CheckCircle2, ArrowRight, BarChart3, Users, Globe2,
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import {
  getV2OverviewSummary,
  getV2OverviewMovements,
  getV2RegionalBreakdown,
} from '@/api/client'
import { formatDate } from '@/utils/format'
import { FORECAST_COLORS } from '@/design/tokens'
import OpportunityDrawer from '@/components/overview/OpportunityDrawer'
import EmptyState from '@/components/ui/EmptyState'

// Region display order (Sections 6 & 7)
const REGION_ORDER = [
  'North America', 'LATAM', 'Middle East and North Africa', 'APAC', 'Europe', 'Africa',
]

function acvM(v: number | null | undefined): string {
  if (v == null) return '\u2014'
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}

function DeltaBadge({ val, label }: { val: number | null | undefined; label?: string }) {
  if (val == null) return null
  const up = val >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
      up ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
         : 'bg-red-500/10 text-red-700 dark:text-red-400'
    }`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? '+' : ''}{val}{label ? ` ${label}` : ''}
    </span>
  )
}

function AcvDelta({ val }: { val: number | null | undefined }) {
  if (val == null) return null
  const up = val >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
      up ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
         : 'bg-red-500/10 text-red-700 dark:text-red-400'
    }`}>
      {up ? '\u25b2' : '\u25bc'} {up ? '+' : ''}{acvM(val)}
    </span>
  )
}

function Pill({ children, color = 'teal' }: { children: React.ReactNode; color?: string }) {
  const cls: Record<string, string> = {
    teal: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20',
    violet: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20',
    amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20',
    slate: 'bg-slate-200/70 dark:bg-slate-700/40 text-slate-600 dark:text-slate-400 border border-slate-300/40 dark:border-slate-600/40',
  }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${cls[color] ?? cls.teal}`}>
      {children}
    </span>
  )
}

function DealModal({ title, deals, onSelectOpp, onClose }: {
  title: string; deals: any[]; onSelectOpp: (id: string) => void; onClose: () => void
}) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.55)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
          className="card-premium w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <h3 className="font-display font-bold text-sm">{title}</h3>
            <button onClick={onClose}><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
          </div>
          <div className="overflow-y-auto flex-1">
            {deals.length === 0
              ? <p className="text-center text-sm text-[var(--text-muted)] py-8">No deals.</p>
              : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[var(--bg-secondary)]">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-semibold text-[var(--text-muted)]">Opportunity</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-[var(--text-muted)]">Region</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-[var(--text-muted)]">ACV</th>
                      <th className="w-6" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {deals.map((d: any, i: number) => (
                      <tr
                        key={d.opportunity_id_18 || i}
                        className="hover:bg-[var(--bg-secondary)] cursor-pointer transition-colors group"
                        onClick={() => d.opportunity_id_18 && onSelectOpp(d.opportunity_id_18)}
                      >
                        <td className="px-4 py-2.5 font-medium">{d.opportunity_name || d.opportunity_id_18}</td>
                        <td className="px-4 py-2.5 text-[var(--text-muted)]">{d.region || d.canonical_region || '\u2014'}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold">{acvM(d.acv ?? d.forecast_acv_amount)}</td>
                        <td className="pr-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { snapshots = [] } = useAppStore()
  const navigate = useNavigate()

  const [movCompare, setMovCompare] = useState<'yesterday' | 'last_week'>('yesterday')
  const [modal, setModal] = useState<{ title: string; deals: any[] } | null>(null)
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null)

  const { data: summary, isLoading: sumLoading, refetch: refetchSum } = useQuery({
    queryKey: ['v2-summary'],
    queryFn: () => getV2OverviewSummary(),
  })

  const { data: movements, isLoading: movLoading, refetch: refetchMov } = useQuery({
    queryKey: ['v2-movements', movCompare],
    queryFn: () => getV2OverviewMovements(movCompare),
  })

  const { data: regional, isLoading: regLoading, refetch: refetchReg } = useQuery({
    queryKey: ['v2-regional'],
    queryFn: () => getV2RegionalBreakdown(),
  })

  const isLoading = sumLoading || movLoading || regLoading
  const refetchAll = () => { refetchSum(); refetchMov(); refetchReg() }

  if (snapshots.length === 0 && !isLoading) {
    return (
      <EmptyState
        title="No Snapshot Data Found"
        description="Please upload renewal workbooks to initialize the pipeline intelligence platform."
      />
    )
  }

  const otherCount  = summary?.other_region_count ?? 0
  const cats        = summary?.categories ?? {}
  const slip        = summary?.slippage_to_2027 ?? { count: 0, acv: 0 }
  const total       = summary?.total ?? { count: 0, acv: 0 }

  const pos: any[]  = movements?.positive ?? []
  const neg: any[]  = movements?.negative ?? []
  const apv: any[]  = movements?.approval ?? []
  const compareDate = movements?.compare_date

  const posTotal = pos.reduce((s: number, r: any) => s + (r.acv ?? 0), 0)
  const negTotal = neg.reduce((s: number, r: any) => s + (r.acv ?? 0), 0)
  const apvTotal = apv.reduce((s: number, r: any) => s + (r.acv ?? 0), 0)

  const propConf   = regional?.proposal_confirmation ?? []
  const propTotals = regional?.proposal_confirmation_totals ?? {}
  const regTrend   = regional?.regional_trend ?? []
  const regTotals  = regional?.regional_trend_totals ?? {}

  const orderRegions = (rows: any[]) =>
    REGION_ORDER.map(r => rows.find((x: any) => x.region === r)).filter(Boolean)

  const propRows  = orderRegions(propConf)
  const trendRows = orderRegions(regTrend)

  const FC_COLS = ['Closed', 'Commit', 'Best Case', 'Pipeline', 'Blank'] as const

  return (
    <div className="space-y-6 pb-16 max-w-[1600px] mx-auto">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display font-extrabold text-2xl md:text-3xl tracking-tight text-[var(--text-primary)]">
              Renewals Overview
            </h1>
            <Pill color="teal">Q4 FY2026</Pill>
          </div>
          {summary?.snapshot_date && (
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Data as of: <strong>{formatDate(summary.snapshot_date)}</strong>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button" onClick={() => navigate('/upload')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-teal-500/10 hover:bg-teal-500/20 text-xs font-semibold text-teal-600 dark:text-teal-400 transition-all shadow-sm"
            id="overview-upload-data-btn"
          >
            <Upload className="w-3.5 h-3.5" /> Upload Excel
          </button>
          <button
            type="button" onClick={refetchAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] text-xs font-semibold text-[var(--text-muted)] transition-all shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-teal-500' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* ── SECTION 0 – Regional notice banner ──────────────────────────────── */}
      {otherCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-400/40 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-xs font-medium"
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-500" />
          <span>
            <strong>{otherCount} deal{otherCount !== 1 ? 's' : ''}</strong> cannot be assigned to a
            canonical region — check <em>revised_sub_region</em> values in source Excel.
          </span>
        </motion.div>
      )}

      {/* ── SECTION 1 – Total Renewal Q4 ACV Value ──────────────────────────── */}
      <div className="card-premium p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Total Renewal Q4 ACV Value
            </p>
            <div className="flex items-baseline gap-3">
              {sumLoading
                ? <div className="h-12 w-52 rounded-lg skeleton-shimmer" />
                : (
                  <span className="font-display font-extrabold text-4xl md:text-5xl text-gradient-brand tabular-nums">
                    ${(total.acv / 1_000_000).toFixed(2)}M
                  </span>
                )}
              <Pill color="teal"><Users className="w-3 h-3" />{total.count} Contracts</Pill>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-2">Fiscal Period = Q4 2026</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {[
              { label: 'vs Yesterday', delta: total.delta_yesterday },
              { label: 'vs Last Week', delta: total.delta_lastweek },
            ].map(({ label, delta }) => (
              <div key={label} className="card-premium px-4 py-3 min-w-[145px]">
                <p className="text-[11px] text-[var(--text-muted)] font-medium mb-2">{label}</p>
                {delta
                  ? <div className="flex flex-col gap-1"><DeltaBadge val={delta.count} label="deals" /><AcvDelta val={delta.acv} /></div>
                  : <span className="text-xs text-[var(--text-muted)]">\u2014</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION 2 – Four category cards ─────────────────────────────────── */}
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {(['Closed', 'Commit', 'Best Case', 'Pipeline'] as const).map((fc) => {
            const cat = cats[fc] ?? { count: 0, acv: 0, delta_yesterday: null, delta_lastweek: null }
            const color = FORECAST_COLORS[fc]
            return (
              <motion.div
                key={fc}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="card-premium p-5 flex flex-col gap-3"
                style={{ borderTop: `3px solid ${color}` }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{fc}</span>
                  <Pill color="slate"><Users className="w-3 h-3" />{cat.count} deals</Pill>
                </div>
                {sumLoading
                  ? <div className="h-8 w-28 skeleton-shimmer rounded" />
                  : <span className="font-display font-extrabold text-2xl tabular-nums" style={{ color }}>{acvM(cat.acv)}</span>}
                <hr className="border-[var(--border-subtle)]" />
                <div className="flex flex-col gap-1">
                  {[
                    { label: 'vs Yesterday', d: cat.delta_yesterday },
                    { label: 'vs Last Week', d: cat.delta_lastweek },
                  ].map(({ label, d }) => d && (
                    <div key={label} className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--text-muted)]">{label}</span>
                      <div className="flex gap-1"><DeltaBadge val={d.count} /><AcvDelta val={d.acv} /></div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Blank / Unassigned mini card */}
        {cats['Blank'] && cats['Blank'].count > 0 && (
          <div className="mt-3 flex justify-end">
            <div
              className="card-premium px-4 py-3 flex items-center gap-4"
              style={{ borderLeft: `3px solid ${FORECAST_COLORS['Blank']}` }}
            >
              <div>
                <p className="text-[11px] font-semibold text-[var(--text-muted)]">Blank / Unassigned</p>
                <p className="text-base font-bold tabular-nums text-[var(--text-secondary)]">{acvM(cats['Blank'].acv)}</p>
              </div>
              <Pill color="slate"><Users className="w-3 h-3" />{cats['Blank'].count} deals</Pill>
            </div>
          </div>
        )}
      </div>

      {/* ── SECTION 3 – Slippage to 2027 ────────────────────────────────────── */}
      <div className="card-premium p-6" style={{ borderLeft: '4px solid #F59E0B' }}>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">
              Slippage to 2027
            </p>
            <div className="flex items-baseline gap-3">
              {sumLoading
                ? <div className="h-10 w-36 skeleton-shimmer rounded" />
                : <span className="font-display font-extrabold text-3xl tabular-nums text-amber-600 dark:text-amber-400">{acvM(slip.acv)}</span>}
              <Pill color="amber"><AlertTriangle className="w-3 h-3" />{slip.count} Slipped Deals</Pill>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-2">
              Sum of ACV for Q4 opportunities whose [Close Date] is in 2027
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {[
              { label: 'vs Yesterday', delta: slip.delta_yesterday },
              { label: 'vs Last Week', delta: slip.delta_lastweek },
            ].map(({ label, delta }) => (
              <div key={label} className="card-premium px-4 py-3 min-w-[145px]">
                <p className="text-[11px] text-[var(--text-muted)] font-medium mb-2">{label}</p>
                {delta
                  ? <div className="flex flex-col gap-1"><DeltaBadge val={delta.count} label="deals" /><AcvDelta val={delta.acv} /></div>
                  : <span className="text-xs text-[var(--text-muted)]">\u2014</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION 4 – Forecast Category & Approval Movement ───────────────── */}
      <div className="card-premium p-6 space-y-5">
        {/* Block header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-display font-bold text-base text-[var(--text-primary)]">
              Forecast Category &amp; Approval Movement
            </h2>
            {cats['Closed'] != null && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {cats['Closed'].count} Closed &middot; {acvM(cats['Closed'].acv)}
              </span>
            )}
          </div>
          {/* Toggle */}
          <div className="flex items-center rounded-xl overflow-hidden border border-[var(--border)] text-xs font-semibold">
            {(['yesterday', 'last_week'] as const).map((v) => (
              <button
                key={v} type="button" onClick={() => setMovCompare(v)}
                className={`px-4 py-2 transition-colors ${
                  movCompare === v
                    ? 'bg-[var(--brand-teal)] text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {v === 'yesterday' ? 'vs Yesterday' : 'vs Last Week'}
              </button>
            ))}
          </div>
        </div>

        {compareDate && (
          <p className="text-[11px] text-[var(--text-muted)]">Comparing with {formatDate(compareDate)}</p>
        )}

        {/* Positive / Negative tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* GREEN – Positive */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-900/10 overflow-hidden">
            <div className="px-4 py-3 bg-emerald-500/10 border-b border-emerald-500/20">
              <h3 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Positive Movements
              </h3>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[var(--text-muted)]">
                  <th className="text-left px-4 py-2.5 font-semibold">Movement</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Count</th>
                  <th className="text-right px-4 py-2.5 font-semibold">ACV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-500/10">
                {pos.map((row: any, i: number) => (
                  <tr
                    key={i}
                    className="hover:bg-emerald-500/10 cursor-pointer transition-colors"
                    onClick={() => row.deals?.length && setModal({ title: `${row.from_category} \u2192 ${row.to_category}`, deals: row.deals })}
                  >
                    <td className="px-4 py-2.5 font-medium flex items-center gap-1.5">
                      <span className="text-[var(--text-muted)]">{row.from_category}</span>
                      <ArrowRight className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                      <span className="font-bold">{row.to_category}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">{row.count}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{acvM(row.acv)}</td>
                  </tr>
                ))}
                <tr className="bg-emerald-500/10 border-t-2 border-emerald-500/30 font-bold">
                  <td className="px-4 py-2.5 text-emerald-700 dark:text-emerald-400">Total</td>
                  <td className="px-4 py-2.5 text-right font-mono text-emerald-700 dark:text-emerald-400">
                    {pos.reduce((s: number, r: any) => s + (r.count ?? 0), 0)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-emerald-700 dark:text-emerald-400">{acvM(posTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* RED – Negative */}
          <div className="rounded-xl border border-red-500/20 bg-red-50/40 dark:bg-red-900/10 overflow-hidden">
            <div className="px-4 py-3 bg-red-500/10 border-b border-red-500/20">
              <h3 className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider flex items-center gap-2">
                <TrendingDown className="w-4 h-4" /> Negative Movements
              </h3>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[var(--text-muted)]">
                  <th className="text-left px-4 py-2.5 font-semibold">Movement</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Count</th>
                  <th className="text-right px-4 py-2.5 font-semibold">ACV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-500/10">
                {neg.map((row: any, i: number) => {
                  const isSlip = row.label === 'Slippage to 2027'
                  return (
                    <tr
                      key={i}
                      className="hover:bg-red-500/10 cursor-pointer transition-colors"
                      onClick={() => row.deals?.length && setModal({ title: row.label ?? `${row.from_category} \u2192 ${row.to_category}`, deals: row.deals })}
                    >
                      <td className="px-4 py-2.5 font-medium">
                        {isSlip ? (
                          <span className="flex items-center gap-1.5">
                            <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                            <span className="font-bold text-amber-700 dark:text-amber-400">Slippage to 2027</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <span className="text-[var(--text-muted)]">{row.from_category}</span>
                            <ArrowRight className="w-3 h-3 text-red-500 flex-shrink-0" />
                            <span className="font-bold">{row.to_category}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-red-700 dark:text-red-400">{row.count}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{acvM(row.acv)}</td>
                    </tr>
                  )
                })}
                <tr className="bg-red-500/10 border-t-2 border-red-500/30 font-bold">
                  <td className="px-4 py-2.5 text-red-700 dark:text-red-400">Total</td>
                  <td className="px-4 py-2.5 text-right font-mono text-red-700 dark:text-red-400">
                    {neg.reduce((s: number, r: any) => s + (r.count ?? 0), 0)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-red-700 dark:text-red-400">{acvM(negTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Approval Movement Table */}
        {apv.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Approval Movement Table
              </h3>
              <Pill color="violet">
                <Users className="w-3 h-3" />
                {apv.reduce((s: number, r: any) => s + (r.count ?? 0), 0)} Status Changes ({acvM(apvTotal)})
              </Pill>
            </div>
            <div className="rounded-xl border border-[var(--border)] overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-[var(--bg-secondary)]">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold text-[var(--text-muted)]">From Approval Status</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-[var(--text-muted)]">To Approval Status</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-[var(--text-muted)]">Opportunity Count</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-[var(--text-muted)]">ACV Value ($M)</th>
                    <th className="px-4 py-2.5 font-semibold text-[var(--text-muted)]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {apv.map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-[var(--bg-secondary)] transition-colors">
                      <td className="px-4 py-2.5 text-[var(--text-secondary)]">{row.from_status}</td>
                      <td className="px-4 py-2.5 font-semibold">{row.to_status}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold">{row.count}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{acvM(row.acv)}</td>
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => row.deals?.length && setModal({ title: `${row.from_status} \u2192 ${row.to_status}`, deals: row.deals })}
                          className="text-[10px] font-bold text-[var(--brand-teal)] hover:underline"
                        >
                          View Deals
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-[var(--bg-secondary)] font-bold border-t-2 border-[var(--border)]">
                    <td className="px-4 py-2.5 text-[var(--text-muted)]" colSpan={2}>Total Approval Movements</td>
                    <td className="px-4 py-2.5 text-right font-mono">{apv.reduce((s: number, r: any) => s + (r.count ?? 0), 0)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{acvM(apvTotal)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── SECTION 6 – Proposal Confirmation ───────────────────────────────── */}
      <div className="card-premium p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-base text-[var(--text-primary)]">Proposal Confirmation</h2>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Unit: Opportunity Count (#)</p>
          </div>
          <Globe2 className="w-5 h-5 text-[var(--text-muted)]" />
        </div>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-xs">
            <thead className="bg-[var(--bg-secondary)]">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-[var(--text-muted)]">Region</th>
                <th className="text-right px-4 py-3 font-semibold text-[var(--text-muted)]">Total Opportunity Approval in the System</th>
                <th className="text-right px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">Approved</th>
                <th className="text-right px-4 py-3 font-semibold text-amber-600 dark:text-amber-400">Pending Approval</th>
                <th className="text-right px-4 py-3 font-semibold text-[var(--text-muted)]">Blanks (Yet to be proposed)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {propRows.map((row: any) => (
                <tr key={row.region} className="hover:bg-[var(--bg-secondary)] transition-colors">
                  <td className="px-4 py-3 font-medium">{row.region}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">
                    {(row.approved_count ?? 0) + (row.pending_count ?? 0) + (row.blank_count ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-700 dark:text-emerald-400 font-bold">{row.approved_count ?? 0}</td>
                  <td className="px-4 py-3 text-right font-mono text-amber-700 dark:text-amber-400 font-bold">{row.pending_count ?? 0}</td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--text-secondary)]">{row.blank_count ?? 0}</td>
                </tr>
              ))}
              <tr className="bg-[var(--bg-secondary)] font-bold border-t-2 border-[var(--border)]">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right font-mono">
                  {(propTotals.approved_count ?? 0) + (propTotals.pending_count ?? 0) + (propTotals.blank_count ?? 0)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-emerald-700 dark:text-emerald-400">{propTotals.approved_count ?? 0}</td>
                <td className="px-4 py-3 text-right font-mono text-amber-700 dark:text-amber-400">{propTotals.pending_count ?? 0}</td>
                <td className="px-4 py-3 text-right font-mono">{propTotals.blank_count ?? 0}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SECTION 7 – Regional Trend ───────────────────────────────────────── */}
      <div className="card-premium p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-base text-[var(--text-primary)]">Regional Trend</h2>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">ACV values in $M</p>
          </div>
          <BarChart3 className="w-5 h-5 text-[var(--text-muted)]" />
        </div>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-xs">
            <thead className="bg-[var(--bg-secondary)]">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-[var(--text-muted)]">Region</th>
                <th className="text-right px-4 py-3 font-semibold text-[var(--text-muted)]">Total ACV Value</th>
                {FC_COLS.map(fc => (
                  <th key={fc} className="text-right px-4 py-3 font-semibold" style={{ color: FORECAST_COLORS[fc] }}>{fc}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {trendRows.map((row: any) => (
                <tr key={row.region} className="hover:bg-[var(--bg-secondary)] transition-colors">
                  <td className="px-4 py-3 font-medium">{row.region}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{acvM(row.total_acv)}</td>
                  {FC_COLS.map(fc => {
                    const k = fc.toLowerCase().replace(' ', '_') + '_acv'
                    return <td key={fc} className="px-4 py-3 text-right font-mono" style={{ color: FORECAST_COLORS[fc] }}>{acvM(row[k] ?? 0)}</td>
                  })}
                </tr>
              ))}
              <tr className="bg-[var(--bg-secondary)] font-bold border-t-2 border-[var(--border)]">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right font-mono">{acvM(regTotals.total_acv)}</td>
                {FC_COLS.map(fc => {
                  const k = fc.toLowerCase().replace(' ', '_') + '_acv'
                  return <td key={fc} className="px-4 py-3 text-right font-mono" style={{ color: FORECAST_COLORS[fc] }}>{acvM(regTotals[k] ?? 0)}</td>
                })}
              </tr>
            </tbody>
          </table>
        </div>
        {regional?.total_acv_check_passes != null && (
          <div className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg ${
            regional.total_acv_check_passes
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'bg-red-500/10 text-red-700 dark:text-red-400'
          }`}>
            <CheckCircle2 className="w-3.5 h-3.5" />
            {regional.total_acv_check_passes
              ? 'Regional Trend Total matches Overview Total Renewal Q4 ACV \u2713'
              : '\u26a0 Regional Trend Total does NOT match — check for unmapped regions'}
          </div>
        )}
      </div>

      {/* Deal modal */}
      {modal && (
        <DealModal
          title={modal.title}
          deals={modal.deals}
          onSelectOpp={(id) => { setModal(null); setSelectedOppId(id) }}
          onClose={() => setModal(null)}
        />
      )}

      {/* Opportunity drawer */}
      <OpportunityDrawer oppId={selectedOppId} onClose={() => setSelectedOppId(null)} />
    </div>
  )
}
