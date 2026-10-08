import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Upload } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { getComparison, getKpis } from '@/api/client'
import { formatDate } from '@/utils/format'
import OverviewKpiStrip from '@/components/overview/OverviewKpiStrip'
import WaterfallChart from '@/components/overview/WaterfallChart'
import ForecastSankey from '@/components/overview/ForecastSankey'
import BiggestMovers from '@/components/overview/BiggestMovers'
import NeedsAttentionPanel from '@/components/overview/NeedsAttentionPanel'
import OpportunityDrawer from '@/components/overview/OpportunityDrawer'
import EmptyState from '@/components/ui/EmptyState'

export default function DailyChanges() {
  const {
    activeSnapshotId,
    compareSnapshotId,
    snapshots = [],
    scope,
    includeDeletedLost,
  } = useAppStore()

  const navigate = useNavigate()
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null)

  const activeSnap =
    snapshots.find((s) => s.id === activeSnapshotId) ??
    snapshots.find((s) => s.is_active_today) ??
    snapshots[0]

  const compareSnap =
    snapshots.find((s) => s.id === compareSnapshotId) ??
    (snapshots.length > 1 ? snapshots[1] : null)

  const activeDate = activeSnap?.snapshot_date
  const compareDate = compareSnap?.snapshot_date

  const { data: comparison, isLoading: compareLoading, refetch } = useQuery({
    queryKey: ['comparison', compareDate, activeDate, scope, includeDeletedLost],
    queryFn: async () => {
      if (!compareDate || !activeDate) return null
      return getComparison(compareDate, activeDate)
    },
    enabled: !!compareDate && !!activeDate,
  })

  const { data: _singleKpis, isLoading: kpiLoading } = useQuery({
    queryKey: ['single-kpis', activeSnap?.id, scope, includeDeletedLost],
    queryFn: () => (activeSnap?.id ? getKpis(activeSnap.id) : null),
    enabled: !compareDate && !!activeSnap?.id,
  })

  const isLoading = compareLoading || (kpiLoading && !comparison)

  if (snapshots.length === 0 && !isLoading) {
    return (
      <EmptyState
        title="No Snapshot Data Found"
        description="Please upload renewal workbooks to initialize the renewals pipeline intelligence platform."
      />
    )
  }

  const fromLabel = compareSnap?.label || 'Compare Date'
  const toLabel = activeSnap?.label || 'View as of Date'

  return (
    <div className="space-y-6 pb-12 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display font-extrabold text-2xl md:text-3xl tracking-tight text-[var(--text-primary)]">
              Daily Changes
            </h1>
            <span className="text-xs px-3 py-1 rounded-full font-bold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
              What Changed Since {fromLabel}
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-2">
            <span>Viewing as of: <strong>{activeSnap?.label || 'Latest'} ({formatDate(activeDate || '')})</strong></span>
            <span>•</span>
            <span>Compared with: <strong>{compareSnap?.label || 'Previous'} ({formatDate(compareDate || '')})</strong></span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/upload')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-teal-500/10 hover:bg-teal-500/20 text-xs font-semibold text-teal-600 dark:text-teal-400 transition-all shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Data</span>
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] text-xs font-semibold text-[var(--text-muted)] transition-all shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-teal-500' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      <OverviewKpiStrip kpis={comparison?.kpi_strip || []} loading={isLoading} />

      <WaterfallChart
        data={comparison?.waterfall}
        fromLabel={fromLabel}
        toLabel={toLabel}
        onSelectOpportunity={(id) => setSelectedOppId(id)}
        loading={isLoading}
      />

      <ForecastSankey
        flows={comparison?.movement || []}
        fromLabel={fromLabel}
        toLabel={toLabel}
        onSelectOpportunity={(id) => setSelectedOppId(id)}
        loading={isLoading}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <BiggestMovers
          movers={comparison?.biggest_movers || []}
          onSelectOpportunity={(id) => setSelectedOppId(id)}
          loading={isLoading}
        />
        <NeedsAttentionPanel
          items={comparison?.needs_attention || []}
          summary={comparison?.needs_attention_summary}
          onSelectOpportunity={(id) => setSelectedOppId(id)}
          loading={isLoading}
        />
      </div>

      <OpportunityDrawer oppId={selectedOppId} onClose={() => setSelectedOppId(null)} />
    </div>
  )
}
