import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  RefreshCw,
  Upload,
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { getComparison, getKpis } from '@/api/client'
import { formatDate } from '@/utils/format'
import HeadlineBanner from '@/components/overview/HeadlineBanner'
import OverviewKpiStrip from '@/components/overview/OverviewKpiStrip'
import WaterfallChart from '@/components/overview/WaterfallChart'
import ForecastSankey from '@/components/overview/ForecastSankey'
import BiggestMovers from '@/components/overview/BiggestMovers'
import NeedsAttentionPanel from '@/components/overview/NeedsAttentionPanel'
import OpportunityDrawer from '@/components/overview/OpportunityDrawer'
import { Skeleton } from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'

export default function Dashboard() {
  const {
    activeSnapshotId,
    compareSnapshotId,
    snapshots = [],
    scope,
    includeDeletedLost,
  } = useAppStore()

  const navigate = useNavigate()
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null)

  // Resolve snapshot dates
  const activeSnap =
    snapshots.find((s) => s.id === activeSnapshotId) ??
    snapshots.find((s) => s.is_active_today) ??
    snapshots[0]

  const compareSnap =
    snapshots.find((s) => s.id === compareSnapshotId) ??
    (snapshots.length > 1 ? snapshots[1] : null)

  const activeDate = activeSnap?.snapshot_date
  const compareDate = compareSnap?.snapshot_date

  // Fetch comparison data driving the whole Overview hero page
  const {
    data: comparison,
    isLoading: compareLoading,
    isError: compareError,
    refetch,
  } = useQuery({
    queryKey: ['comparison', compareDate, activeDate, scope, includeDeletedLost],
    queryFn: async () => {
      if (!compareDate || !activeDate) return null
      return getComparison(compareDate, activeDate)
    },
    enabled: !!compareDate && !!activeDate,
  })

  // Fallback single-snapshot KPIs if comparison unavailable
  const { data: singleKpis, isLoading: kpiLoading } = useQuery({
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

  // Derive display labels
  const fromLabel = compareSnap?.label || 'Compare Date'
  const toLabel = activeSnap?.label || 'View as of Date'

  return (
    <div className="space-y-6 pb-12 max-w-[1600px] mx-auto">
      {/* Page Title & Subtitle with active snapshot dates */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display font-extrabold text-2xl md:text-3xl tracking-tight text-[var(--text-primary)]">
              Renewals Overview
            </h1>
            <span className="text-xs px-3 py-1 rounded-full font-bold bg-[#12284C]/10 dark:bg-white/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
              What Changed Since {fromLabel}
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-2">
            <span>Viewing as of: <strong>{activeSnap?.label || 'Latest'} ({formatDate(activeDate || '')})</strong></span>
            <span>•</span>
            <span>Compared with: <strong>{compareSnap?.label || 'Previous'} ({formatDate(compareDate || '')})</strong></span>
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/upload')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-teal-500/10 hover:bg-teal-500/20 text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-all shadow-sm"
            id="overview-upload-data-btn"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Data</span>
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-teal-500' : ''}`} />
            <span>Sync Data</span>
          </button>
        </div>
      </div>

      {/* 1. HEADLINE BANNER */}
      <HeadlineBanner
        headlineText={comparison?.headline?.text}
        chips={comparison?.headline?.chips}
        compareLabel={fromLabel.toLowerCase()}
        loading={isLoading}
      />

      {/* 2. KPI STRIP: 6 TILES */}
      <OverviewKpiStrip
        kpis={comparison?.kpi_strip || []}
        loading={isLoading}
      />

      {/* 3. WATERFALL CHART */}
      <WaterfallChart
        data={comparison?.waterfall}
        fromLabel={fromLabel}
        toLabel={toLabel}
        onSelectOpportunity={(oppId) => setSelectedOppId(oppId)}
        loading={isLoading}
      />

      {/* 4. SANKEY FORECAST CATEGORY MOVEMENT */}
      <ForecastSankey
        flows={comparison?.movement || []}
        fromLabel={fromLabel}
        toLabel={toLabel}
        onSelectOpportunity={(oppId) => setSelectedOppId(oppId)}
        loading={isLoading}
      />

      {/* 5 & 6. BIGGEST MOVERS & NEEDS ATTENTION GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* 5. BIGGEST MOVERS */}
        <BiggestMovers
          movers={comparison?.biggest_movers || []}
          onSelectOpportunity={(oppId) => setSelectedOppId(oppId)}
          loading={isLoading}
        />

        {/* 6. NEEDS ATTENTION PANEL */}
        <NeedsAttentionPanel
          items={comparison?.needs_attention || []}
          summary={comparison?.needs_attention_summary}
          onSelectOpportunity={(oppId) => setSelectedOppId(oppId)}
          loading={isLoading}
        />
      </div>

      {/* 7. GLOBAL OPPORTUNITY DRAWER */}
      <OpportunityDrawer
        oppId={selectedOppId}
        onClose={() => setSelectedOppId(null)}
      />
    </div>
  )
}
