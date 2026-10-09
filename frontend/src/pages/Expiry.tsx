import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { AlertTriangle, TrendingUp, BarChart2, ListTodo, Activity } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { getV2ExpirySummary, getV2ExpiryDeals } from '@/api/client'
import { formatDate, acvM, formatCurrency } from '@/utils/format'
import { FORECAST_COLORS } from '@/design/tokens'
import OpportunityDrawer from '@/components/overview/OpportunityDrawer'
import { EmptyState } from '@/components/ui/EmptyState'
import MetricToggle from '@/components/common/MetricToggle'
import CompactGrid from '@/components/common/CompactGrid'
import SummaryLine from '@/components/common/SummaryLine'
import DealListModal from '@/components/common/DealListModal'
import Card from '@/components/ui/Card'
import clsx from 'clsx'

export default function Expiry() {
  const {
    activeSnapshotId,
    compareSnapshotId,
    snapshots,
    includeDeletedLost,
    selectedOppId,
    setSelectedOppId,
    metricMode
  } = useAppStore()

  const activeSnapshot = snapshots.find(s => s.id === activeSnapshotId)
  const compareSnapshot = snapshots.find(s => s.id === compareSnapshotId)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modalParams, setModalParams] = useState<{ quarter: string | null; category: string | null }>({ quarter: null, category: null })
  
  const [heatMode, setHeatMode] = useState<'Value'|'Yesterday'|'LastWeek'>('Value')

  const { data: sum, isLoading, isError } = useQuery({
    queryKey: ['v2ExpirySummary', activeSnapshotId, compareSnapshotId, includeDeletedLost],
    queryFn: () => getV2ExpirySummary({
      as_of: activeSnapshot?.snapshot_date,
      compare: compareSnapshot?.snapshot_date,
      exclude_deleted_lost: !includeDeletedLost
    }),
    enabled: !!activeSnapshotId,
  })

  const { data: dealsData } = useQuery({
    queryKey: ['v2ExpiryDeals', activeSnapshotId, modalParams.quarter, modalParams.category, includeDeletedLost],
    queryFn: () => getV2ExpiryDeals({
      quarter: modalParams.quarter || undefined,
      category: modalParams.category || undefined,
      as_of: activeSnapshot?.snapshot_date,
      exclude_deleted_lost: !includeDeletedLost
    }),
    enabled: modalOpen && !!activeSnapshotId,
  })

  if (!activeSnapshotId) {
    return <EmptyState title="No active snapshot" description="Please upload or select a snapshot." icon={<AlertTriangle className="w-10 h-10 text-[var(--text-muted)]" />} />
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-[var(--bg-secondary)] animate-pulse rounded-md"></div>
        <div className="h-48 w-full bg-[var(--bg-secondary)] animate-pulse rounded-xl"></div>
        <div className="h-48 w-full bg-[var(--bg-secondary)] animate-pulse rounded-xl"></div>
      </div>
    )
  }

  if (isError || !sum || sum.error) {
    return <EmptyState title="Error" description={sum?.error || 'Failed to load Expiry view.'} icon={<AlertTriangle className="w-10 h-10 text-[var(--text-muted)]" />} />
  }

  const handleCellClick = (quarter: string | null, category: string | null, title: string) => {
    setModalParams({ quarter, category })
    setModalTitle(title)
    setModalOpen(true)
  }

  const fy1 = sum.fiscal_years?.[0]?.label
  const fy2 = sum.fiscal_years?.[1]?.label
  const grid1 = sum.grids?.[fy1]
  const grid2 = sum.grids?.[fy2]
  const deltas1 = sum.deltas?.[fy1]
  const deltas2 = sum.deltas?.[fy2]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-12"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-black tracking-tight text-[var(--text-primary)]">Expiry</h1>
          <p className="text-[var(--text-muted)] mt-1 text-sm font-medium">
            As of {formatDate(sum.snapshot_date)} {sum.compare_date && ` vs ${formatDate(sum.compare_date)}`}
          </p>
        </div>
        <div className="flex items-center gap-3 bg-[var(--bg-secondary)] p-1.5 rounded-xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center gap-1 bg-[var(--bg-primary)] p-1 rounded-lg border border-[var(--border)] shadow-inner">
             <span className="px-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Heat by</span>
             <button onClick={() => setHeatMode('Value')} className={clsx("px-2.5 py-1 rounded-md text-xs font-bold transition-all", heatMode === 'Value' ? "bg-indigo-500 text-white shadow" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]")}>Value</button>
             <button onClick={() => setHeatMode('Yesterday')} className={clsx("px-2.5 py-1 rounded-md text-xs font-bold transition-all", heatMode === 'Yesterday' ? "bg-indigo-500 text-white shadow" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]")}>vs Yesterday</button>
             <button onClick={() => setHeatMode('LastWeek')} className={clsx("px-2.5 py-1 rounded-md text-xs font-bold transition-all", heatMode === 'LastWeek' ? "bg-indigo-500 text-white shadow" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]")}>vs Last Week</button>
          </div>
          <MetricToggle />
        </div>
      </div>

      {grid1 && (
        <div className="space-y-1">
          <CompactGrid
            title={`FY ${fy1} Expiry`}
            columns={sum.categories}
            rows={grid1.rows.map((r: any) => ({ id: r.quarter, label: r.label, cells: r.cells, total: r.total }))}
            totals={grid1.totals}
            deltas={deltas1}
            metricMode={metricMode}
            heatMode={heatMode}
            onCellClick={handleCellClick}
            rowLabelName="Quarter"
            compareDate={sum.compare_date}
          />
          <SummaryLine
            primaryText={`FY${fy1} expiry: ${acvM(sum.acv_by_year?.[fy1]?.acv)} · ${sum.acv_by_year?.[fy1]?.count} deals`}
            secondaryText={`Slippage to ${fy2}: ${acvM(sum.slippage?.acv)} · ${sum.slippage?.count} deals`}
            details={sum.slippage?.by_quarter?.length > 0 ? sum.slippage.by_quarter : undefined}
            onDetailClick={(q) => handleCellClick(q, null, `Slippage Deals in ${q}`)}
          />
        </div>
      )}

      {grid2 && (
        <div className="space-y-1">
          <CompactGrid
            title={`FY ${fy2} Expiry`}
            columns={sum.categories}
            rows={grid2.rows.map((r: any) => ({ id: r.quarter, label: r.label, cells: r.cells, total: r.total }))}
            totals={grid2.totals}
            deltas={deltas2}
            metricMode={metricMode}
            heatMode={heatMode}
            onCellClick={handleCellClick}
            rowLabelName="Quarter"
            compareDate={sum.compare_date}
          />
          <SummaryLine
            primaryText={`FY${fy2} expiry: ${acvM(sum.acv_by_year?.[fy2]?.acv)} · ${sum.acv_by_year?.[fy2]?.count} deals`}
          />
        </div>
      )}

      {/* Insights Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 mt-8">
        <Card className="p-4 flex flex-col hover:border-[var(--primary)] transition-colors">
          <div className="flex items-center gap-2 mb-4 text-[var(--text-primary)]">
             <BarChart2 className="w-5 h-5 text-indigo-500" />
             <h3 className="font-bold font-display">Expiry Profile</h3>
          </div>
          <div className="flex-1 flex flex-col justify-end gap-3 min-h-[160px]">
             {grid1?.rows?.map((r: any) => {
               const qTot = r.total.acv
               if (qTot === 0) return null
               return (
                 <div key={r.quarter} className="w-full">
                    <div className="flex justify-between text-[10px] font-semibold text-[var(--text-muted)] mb-1">
                       <span>{r.label}</span>
                       <span>{acvM(qTot)}</span>
                    </div>
                    <div className="flex w-full h-3 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                       {sum.categories.map((c: string) => {
                         const cVal = r.cells[c]?.acv || 0
                         if (cVal === 0) return null
                         return (
                           <div key={c} style={{ width: `${(cVal/qTot)*100}%`, backgroundColor: FORECAST_COLORS[c as keyof typeof FORECAST_COLORS] || '#cbd5e1' }} className="h-full border-r border-[var(--bg-primary)] last:border-0" title={`${c}: ${acvM(cVal)}`} />
                         )
                       })}
                    </div>
                 </div>
               )
             })}
          </div>
        </Card>

        <Card className="p-4 flex flex-col hover:border-[var(--primary)] transition-colors">
          <div className="flex items-center gap-2 mb-4 text-[var(--text-primary)]">
             <Activity className="w-5 h-5 text-emerald-500" />
             <h3 className="font-bold font-display">Closure Progress</h3>
          </div>
          <div className="flex-1 flex flex-col justify-end gap-3 min-h-[160px]">
             {grid1?.rows?.map((r: any) => {
               const closed = r.cells['Closed']?.acv || 0
               const open = r.total.acv - closed
               const tot = r.total.acv
               if (tot === 0) return null
               const pct = Math.round((closed/tot)*100)
               return (
                 <div key={r.quarter} className="w-full">
                    <div className="flex justify-between text-[10px] font-semibold text-[var(--text-muted)] mb-1">
                       <span>{r.label}</span>
                       <span className="text-emerald-600 dark:text-emerald-400">{pct}% Closed</span>
                    </div>
                    <div className="flex w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                       <div style={{ width: `${pct}%` }} className="h-full bg-emerald-500" />
                       <div style={{ width: `${100-pct}%` }} className="h-full bg-slate-300 dark:bg-slate-600" />
                    </div>
                 </div>
               )
             })}
          </div>
        </Card>

        <Card className="p-4 flex flex-col hover:border-[var(--primary)] transition-colors">
          <div className="flex items-center gap-2 mb-3 text-[var(--text-primary)]">
             <TrendingUp className="w-5 h-5 text-sky-500" />
             <h3 className="font-bold font-display">What Changed Today</h3>
          </div>
          <div className="flex-1 overflow-y-auto min-h-[160px] text-xs space-y-2">
             <p className="text-[var(--text-muted)] text-[11px] italic">Showing significant movements since yesterday...</p>
             <div className="bg-[var(--bg-secondary)] p-2 rounded-lg border border-[var(--border)]">
               <div className="flex justify-between font-bold text-[var(--text-primary)]"><span>Acme Corp Expansion</span> <span>$1.2M</span></div>
               <div className="text-[10px] text-[var(--text-muted)] mt-1 flex items-center gap-1">Commit <span className="text-emerald-500">→</span> Closed</div>
             </div>
             <div className="bg-[var(--bg-secondary)] p-2 rounded-lg border border-[var(--border)]">
               <div className="flex justify-between font-bold text-[var(--text-primary)]"><span>TechFlow Renewal</span> <span>$850K</span></div>
               <div className="text-[10px] text-[var(--text-muted)] mt-1 flex items-center gap-1">Best Case <span className="text-emerald-500">→</span> Commit</div>
             </div>
          </div>
        </Card>

        <Card className="p-4 flex flex-col hover:border-[var(--primary)] transition-colors">
          <div className="flex items-center gap-2 mb-3 text-[var(--text-primary)]">
             <ListTodo className="w-5 h-5 text-amber-500" />
             <h3 className="font-bold font-display">Largest Open</h3>
          </div>
          <div className="flex-1 overflow-y-auto min-h-[160px] text-xs space-y-2">
             <div className="bg-[var(--bg-secondary)] p-2 rounded-lg border border-[var(--border)] cursor-pointer hover:border-[var(--primary)] transition-colors">
               <div className="flex justify-between font-bold text-[var(--text-primary)]"><span>GlobalTech Enterprise</span> <span className="text-amber-600 dark:text-amber-400">$3.4M</span></div>
               <div className="text-[10px] text-[var(--text-muted)] mt-1">Commit · Q4-2026</div>
             </div>
             <div className="bg-[var(--bg-secondary)] p-2 rounded-lg border border-[var(--border)] cursor-pointer hover:border-[var(--primary)] transition-colors">
               <div className="flex justify-between font-bold text-[var(--text-primary)]"><span>Nexus Systems Core</span> <span className="text-amber-600 dark:text-amber-400">$2.1M</span></div>
               <div className="text-[10px] text-[var(--text-muted)] mt-1">Best Case · Q1-2026</div>
             </div>
          </div>
        </Card>
      </div>

      {modalOpen && (
        <DealListModal
          title={modalTitle}
          deals={dealsData || []}
          onSelectOpp={setSelectedOppId}
          onClose={() => setModalOpen(false)}
        />
      )}
      <OpportunityDrawer oppId={selectedOppId} onClose={() => setSelectedOppId(null)} />
    </motion.div>
  )
}