import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  ArrowDownRight,
  Sparkles,
  Info,
  ChevronRight,
  ExternalLink,
  Layers,
  Database,
  BarChart3,
  Calendar,
} from 'lucide-react'
import { getInsights } from '@/api/client'
import { useAppStore } from '@/store/appStore'
import { formatACV } from '@/utils/format'
import Card from '@/components/ui/Card'
import { ForecastBadge, ApprovalBadge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import clsx from 'clsx'

export default function Insights() {
  const activeSnapshotId = useAppStore((s) => s.activeSnapshotId)
  const setSelectedOppId = useAppStore((s) => s.setSelectedOppId)

  const { data, isLoading } = useQuery({
    queryKey: ['insights', activeSnapshotId],
    queryFn: () => getInsights(activeSnapshotId ?? undefined),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton variant="text" width="240px" height="32px" />
          <Skeleton variant="text" width="380px" height="20px" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton variant="card" height="110px" />
          <Skeleton variant="card" height="110px" />
          <Skeleton variant="card" height="110px" />
        </div>
        <Skeleton variant="card" height="420px" />
        <Skeleton variant="card" height="260px" />
      </div>
    )
  }

  const topAtRisk = data?.top_at_risk || []
  const renewalsAtRisk = data?.renewals_at_risk || []
  const commitSlippage = data?.commit_slippage || []
  const historyStatus = data?.history_status || {
    available_snapshots: 3,
    target_snapshots: 7,
    message: 'Collecting history \u2013 3 of 7 snapshots',
    is_collecting: true,
  }
  const modelCard = data?.model_card

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-teal-500/10 text-teal-500">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold font-display text-[var(--text-primary)]">
              Renewal Insights & Risk Engine
            </h1>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Rule-based Deal Risk Scores (0-100), imminent renewal vulnerabilities, and commit slippage tracking.
          </p>
        </div>

        {data?.snapshot_date && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)]">
            <Calendar className="w-3.5 h-3.5 text-teal-500" />
            <span>As of: {data.snapshot_date}</span>
          </div>
        )}
      </div>

      {/* Top 3 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Top At-Risk Pipeline ACV
            </p>
            <p className="text-xl font-black font-display text-red-500 mt-1 tabular-nums">
              {formatACV(topAtRisk.reduce((acc: number, d: any) => acc + (d.forecast_acv_amount || 0), 0))}
            </p>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Across top {topAtRisk.length} flagged opportunities
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center font-bold">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Renewals At Risk
            </p>
            <p className="text-xl font-black font-display text-amber-500 mt-1 tabular-nums">
              {renewalsAtRisk.length} <span className="text-xs font-normal text-[var(--text-muted)]">Deals</span>
            </p>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Expiring soon without approval or in Pipeline
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Commit Slippage Events
            </p>
            <p className="text-xl font-black font-display text-teal-600 dark:text-teal-400 mt-1 tabular-nums">
              {commitSlippage.length} <span className="text-xs font-normal text-[var(--text-muted)]">Tracked</span>
            </p>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Moved out of Commit across daily snapshots
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center font-bold">
            <ArrowDownRight className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 1. Top 15 At-Risk Deals */}
      <Card>
        <div className="mb-4">
          <h2 className="text-base font-bold text-[var(--text-primary)] font-display">
            Top 15 At-Risk Deals
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Ranked by rule-based risk score (0-100). Click any row to inspect full factor breakdown in the drawer.
          </p>
        </div>
        <div className="overflow-x-auto -mx-5 -mb-5 mt-2">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]/50 text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                <th className="py-3 px-4 w-12 text-center">Rank</th>
                <th className="py-3 px-4">Opportunity & Account</th>
                <th className="py-3 px-4">Region / BU</th>
                <th className="py-3 px-4 text-right">Forecast ACV</th>
                <th className="py-3 px-4">Forecast Category</th>
                <th className="py-3 px-4">Approval Status</th>
                <th className="py-3 px-4 text-center">Risk Score</th>
                <th className="py-3 px-4">Primary Risk Factor</th>
                <th className="py-3 px-4 text-center w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {topAtRisk.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[var(--text-muted)]">
                    No high-risk deals identified.
                  </td>
                </tr>
              ) : (
                topAtRisk.map((deal: any, idx: number) => {
                  const topFactor = deal.risk_factors?.find((f: any) => f.points > 0)
                  return (
                    <tr
                      key={deal.opportunity_id_18 || idx}
                      onClick={() => deal.opportunity_id_18 && setSelectedOppId(deal.opportunity_id_18)}
                      className="hover:bg-teal-500/5 dark:hover:bg-white/5 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-4 text-center font-bold text-[var(--text-muted)]">
                        #{idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-[var(--text-primary)] group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors line-clamp-1">
                          {deal.opportunity_name}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {deal.account_name || 'N/A'} · ID: {deal.opportunity_id_18}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-[var(--text-primary)]">{deal.sub_region || '–'}</p>
                        <p className="text-[11px] text-[var(--text-muted)] line-clamp-1">
                          {deal.business_unit || '–'}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right font-display font-bold text-[var(--text-primary)] tabular-nums">
                        {formatACV(deal.forecast_acv_amount)}
                      </td>
                      <td className="py-3 px-4">
                        <ForecastBadge category={deal.forecast_category} />
                      </td>
                      <td className="py-3 px-4">
                        <ApprovalBadge status={deal.approval_status} />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={clsx(
                            'inline-flex items-center justify-center font-black px-2.5 py-1 rounded-lg text-xs font-display tabular-nums',
                            deal.risk_score >= 65
                              ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30'
                              : deal.risk_score >= 35
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          )}
                        >
                          {deal.risk_score}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[11px] text-[var(--text-secondary)]">
                        {topFactor ? (
                          <span className="line-clamp-1">
                            <strong className="text-red-500 font-semibold">{topFactor.name}</strong> ({topFactor.description})
                          </span>
                        ) : (
                          'Low risk'
                        )}
                      </td>
                      <td className="py-3 px-4 text-center text-[var(--text-muted)] group-hover:text-teal-500 transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 2. Renewals At Risk */}
        <Card>
          <div className="mb-3">
            <h3 className="text-sm font-bold text-[var(--text-primary)] font-display">
              Renewals at Risk
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Contracts expiring in {data?.target_quarters ? data.target_quarters.join(' or ') : 'current/next quarter'} that are still unapproved or in early Pipeline.
            </p>
          </div>
          <div className="space-y-3 mt-2">
            {renewalsAtRisk.length === 0 ? (
              <p className="py-8 text-center text-xs text-[var(--text-muted)]">
                No immediate renewals at risk found.
              </p>
            ) : (
              renewalsAtRisk.slice(0, 8).map((deal: any, idx: number) => (
                <div
                  key={deal.opportunity_id_18 || idx}
                  onClick={() => deal.opportunity_id_18 && setSelectedOppId(deal.opportunity_id_18)}
                  className="p-3 rounded-xl bg-[var(--bg-secondary)]/50 hover:bg-teal-500/5 dark:hover:bg-white/5 border border-[var(--border)] cursor-pointer transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs text-[var(--text-primary)] group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors truncate">
                      {deal.opportunity_name}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--text-muted)]">
                      <span>{deal.account_name}</span>
                      <span>·</span>
                      <span className="font-semibold text-teal-600 dark:text-teal-400">
                        Expires: {deal.service_expiry_period || 'Near term'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <p className="font-display font-bold text-xs text-[var(--text-primary)] tabular-nums">
                        {formatACV(deal.forecast_acv_amount)}
                      </p>
                      <ApprovalBadge status={deal.approval_status} />
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-teal-500 transition-colors" />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* 3. Commit Slippage Summary */}
        <Card>
          <div className="mb-3">
            <h3 className="text-sm font-bold text-[var(--text-primary)] font-display">
              Commit-Slippage Summary
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Opportunities that fell out of Commit across daily snapshots.
            </p>
          </div>
          <div className="space-y-3 mt-2">
            {commitSlippage.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--text-muted)] space-y-1">
                <p className="font-semibold text-[var(--text-secondary)]">No Commit Slippage Detected</p>
                <p>All deals committed in previous snapshots remain on track.</p>
              </div>
            ) : (
              commitSlippage.map((slip: any, idx: number) => (
                <div
                  key={slip.opportunity_id_18 || idx}
                  onClick={() => slip.opportunity_id_18 && setSelectedOppId(slip.opportunity_id_18)}
                  className="p-3 rounded-xl bg-[var(--bg-secondary)]/50 hover:bg-teal-500/5 dark:hover:bg-white/5 border border-[var(--border)] cursor-pointer transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs text-[var(--text-primary)] group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors truncate">
                      {slip.opportunity_name}
                    </p>
                    <p className="text-[11px] text-red-500 mt-0.5 font-medium">
                      {slip.reason}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                      {slip.old_category} → {slip.new_category}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-teal-500 transition-colors" />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* 4. Anomaly Alerts & ML History Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/20 via-purple-950/15 to-slate-900/30 border border-indigo-500/20 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)] font-display">
                Anomaly Alerts & Predictive ML
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Statistical anomaly detection and ML slip forecasting engines.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {historyStatus.message}
          </span>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-[var(--text-secondary)] font-semibold">
            <span>Baseline Training Dataset</span>
            <span>
              {historyStatus.available_snapshots} of {historyStatus.target_snapshots} snapshots
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-400 to-indigo-500 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (historyStatus.available_snapshots / historyStatus.target_snapshots) * 100)}%`,
              }}
            />
          </div>
        </div>

        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          <strong>No synthetic predictions:</strong> In accordance with Mobileum enterprise data governance, anomaly alerts and automated predictive machine learning models are suppressed until 7 consecutive daily snapshots are ingested. Rule-based Deal Risk Scoring remains 100% active.
        </p>
      </div>

      {/* 5. Model Card */}
      {modelCard && (
        <Card>
          <div className="mb-4">
            <h3 className="text-base font-bold text-[var(--text-primary)] font-display">
              {modelCard.title}
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Version {modelCard.version} · Transparent, auditable rule weights and operational constraints.
            </p>
          </div>
          <div className="space-y-4 mt-2 text-xs">
            <p className="text-[var(--text-secondary)] leading-relaxed">
              <strong>Objective:</strong> {modelCard.purpose} {modelCard.target}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {modelCard.scoring_breakdown.map((item: any, i: number) => (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[var(--text-primary)]">{item.factor}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-600 dark:text-teal-400">
                      Max {item.max_points} pts
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] leading-tight">{item.rule}</p>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-[var(--border)] space-y-1">
              <p className="font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[11px]">
                Model Boundaries & Limitations:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-[var(--text-muted)] text-[11px]">
                {modelCard.limitations.map((lim: string, idx: number) => (
                  <li key={idx}>{lim}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
