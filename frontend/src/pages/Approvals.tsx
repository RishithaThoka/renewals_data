import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Clock, FileQuestion, Sigma, Info } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { getApprovalsDistribution } from '@/api/client'
import { formatCurrency, formatNumber, acvM } from '@/utils/format'
import EmptyState from '@/components/ui/EmptyState'
import OpportunityDrawer from '@/components/overview/OpportunityDrawer'
import MetricToggle from '@/components/common/MetricToggle'
import CompactGrid from '@/components/common/CompactGrid'

function formatDelta(val: number, isCount: boolean) {
  if (val == null) return null
  const sign = val > 0 ? '+' : ''
  const color = val > 0 ? 'text-emerald-600 dark:text-emerald-400' : val < 0 ? 'text-red-600 dark:text-red-400' : 'text-[var(--text-muted)]'
  const text = isCount ? `${sign}${val}` : `${sign}${acvM(val)}`
  return <span className={color}>{text}</span>
}

function StatChip({ label, data, icon: Icon, metricMode, compareDate }: any) {
  const isCount = metricMode === 'Count'
  const val = isCount ? data.count : data.acv
  const valStr = isCount ? formatNumber(val) : formatCurrency(val)
  
  const dYes = data.delta_yesterday
  const dLast = data.delta_lastweek
  const dCust = data.delta_custom

  const renderDeltas = () => {
    const parts = []
    if (dCust && (dCust.count || dCust.acv)) {
      parts.push(<span key="custom">{compareDate ? compareDate.substring(5,10) : 'vs'} {formatDelta(isCount ? dCust.count : dCust.acv, isCount)}</span>)
    } else {
      if (dYes && (dYes.count || dYes.acv)) parts.push(<span key="1d">1d {formatDelta(isCount ? dYes.count : dYes.acv, isCount)}</span>)
      if (dLast && (dLast.count || dLast.acv)) parts.push(<span key="7d">7d {formatDelta(isCount ? dLast.count : dLast.acv, isCount)}</span>)
    }
    if (parts.length === 0) return <span className="text-transparent">_</span>
    return parts.map((p, i) => <React.Fragment key={i}>{p}{i < parts.length - 1 && ' · '}</React.Fragment>)
  }

  return (
    <div className="card-premium px-4 py-2 flex items-center justify-between border border-[var(--border)]">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-[var(--text-muted)]" />
        <div>
          <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">{label}</div>
          <div className="text-base font-bold text-[var(--text-primary)] leading-tight">{valStr}</div>
          <div className="text-[10px] text-[var(--text-muted)] leading-tight">{renderDeltas()}</div>
        </div>
      </div>
    </div>
  )
}

export default function Approvals() {
  const { activeSnapshotId, compareSnapshotId, includeDeletedLost, snapshots, metricMode } = useAppStore()
  const [drawerFilters, setDrawerFilters] = useState<{ status?: string; category?: string } | null>(null)

  const activeSnapshot = snapshots.find(s => s.id === activeSnapshotId)
  const compareSnapshot = snapshots.find(s => s.id === compareSnapshotId)

  const { data, isLoading, error } = useQuery({
    queryKey: ['approvals_v2', activeSnapshotId, compareSnapshotId, includeDeletedLost],
    queryFn: async () => {
      if (!activeSnapshotId) return null
      return getApprovalsDistribution(activeSnapshot?.snapshot_date || '', compareSnapshot?.snapshot_date, includeDeletedLost)
    },
    enabled: !!activeSnapshotId,
  })

  if (!activeSnapshotId) return <EmptyState title="No active snapshot" description="Select a snapshot to view data" />
  if (isLoading) return <div className="p-8 text-center text-slate-500 animate-pulse">Loading approval data...</div>
  if (error || data?.error) return <div className="p-8 text-center text-rose-500 font-semibold">{(error as any)?.message || data?.error}</div>
  if (!data) return <EmptyState title="No data" description="No approval data found for the selected criteria." />
  if (data.total.count === 0) return <EmptyState title="No data" description="The data slice is empty." />

  const { total, statuses, matrix, categories, funnel, movements, pending_reasons, data_slice, data_slice_key } = data
  
  const getStatus = (name: string) => statuses.find((s: any) => s.status === name) || { count: 0, acv: 0, delta_yesterday: {}, delta_lastweek: {}, delta_custom: {} }

  const handleCellClick = (status?: string | null, category?: string | null) => {
    setDrawerFilters({ status: status || undefined, category: category || undefined })
  }

  const colSums = categories.reduce((acc: any, c: string) => {
    acc[c] = { count: 0, acv: 0 }
    Object.values(matrix).forEach((row: any) => {
      acc[c].count += row[c]?.count || 0
      acc[c].acv += row[c]?.acv || 0
    })
    return acc
  }, {})

  const totalMovements = movements.reduce((acc: any, m: any) => {
    acc.count += m.count; acc.acv += m.acv; return acc
  }, { count: 0, acv: 0 })

  const rowsForGrid = Object.entries(matrix).map(([st, cells]: [string, any]) => ({
    id: st,
    label: st,
    cells,
    total: getStatus(st)
  }))

  const deltasForGrid = {
    yesterday: {
      rows: statuses.reduce((acc: any, s: any) => ({ ...acc, [s.status]: s.delta_yesterday }), {}),
      grand: total.delta_yesterday
    },
    lastweek: {
      rows: statuses.reduce((acc: any, s: any) => ({ ...acc, [s.status]: s.delta_lastweek }), {}),
      grand: total.delta_lastweek
    },
    custom: {
      rows: statuses.reduce((acc: any, s: any) => ({ ...acc, [s.status]: s.delta_custom }), {}),
      grand: total.delta_custom
    }
  }

  return (
    <div className="space-y-6 pb-20">
      
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display font-black text-[var(--text-primary)] tracking-tight">Approval Funnel</h1>
          <p className="text-[var(--text-muted)] mt-1 flex items-center gap-2 text-sm font-medium">
            <span className="px-2 py-0.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)]">{data_slice}</span>
            <span className="px-2 py-0.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)]">{data_slice_key}</span>
          </p>
        </div>
        <MetricToggle />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatChip label="Approved" data={getStatus('Approved')} icon={CheckCircle2} metricMode={metricMode} compareDate={compareSnapshot?.snapshot_date} />
        <StatChip label="Pending" data={getStatus('Pending Approval')} icon={Clock} metricMode={metricMode} compareDate={compareSnapshot?.snapshot_date} />
        <StatChip label="Blank" data={getStatus('Blank')} icon={FileQuestion} metricMode={metricMode} compareDate={compareSnapshot?.snapshot_date} />
        <StatChip label="Total" data={total} icon={Sigma} metricMode={metricMode} compareDate={compareSnapshot?.snapshot_date} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1 card-premium p-5 border border-[var(--border)] h-[280px] overflow-y-auto">
          <h2 className="text-sm font-display font-semibold text-[var(--text-primary)] mb-4">Funnel Overview</h2>
          <div className="space-y-3">
            {funnel.map((f: any, i: number) => {
              const pct = (f.acv / total.acv) * 100 || 0;
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    <span>{f.stage}</span>
                    <span>{metricMode === 'Count' ? formatNumber(f.count) : formatCurrency(f.acv)}</span>
                  </div>
                  <div className="h-4 bg-[var(--bg-secondary)] rounded-full overflow-hidden flex cursor-pointer transition-all"
                       onClick={() => handleCellClick(f.stage === 'Total slice' ? undefined : f.stage)}>
                    <div 
                      className={`h-full transition-all duration-1000 ease-out ${
                        f.stage === 'Approved' ? 'bg-emerald-500' :
                        f.stage === 'Pending Approval' ? 'bg-amber-500' :
                        f.stage === 'Blank' ? 'bg-slate-400' :
                        'bg-[var(--primary)]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="xl:col-span-2 space-y-6">
          <CompactGrid
            title="Status vs. Forecast Category"
            columns={categories}
            rows={rowsForGrid}
            totals={{ category: colSums, grand: { count: total.count, acv: total.acv } }}
            deltas={deltasForGrid}
            metricMode={metricMode}
            onCellClick={(r, c) => handleCellClick(r, c)}
            rowLabelName="Status"
            compareDate={compareSnapshot?.snapshot_date}
          />

          <div className="card-premium p-5 border border-[var(--border)]">
            <h2 className="text-sm font-display font-semibold text-[var(--text-primary)] mb-4">Recent Movements</h2>
            {movements.length === 0 ? (
              <div className="text-center py-4 text-[var(--text-muted)] text-xs">No status changes.</div>
            ) : (
              <table className="w-full text-[13px] text-left">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="pb-2 font-medium text-[var(--text-muted)]">From</th>
                    <th className="pb-2 font-medium text-[var(--text-muted)]">To</th>
                    <th className="pb-2 font-medium text-[var(--text-muted)] text-right">Deals</th>
                    <th className="pb-2 font-medium text-[var(--text-muted)] text-right">ACV</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m: any, idx: number) => (
                    <tr key={idx} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-secondary)]">
                      <td className="py-2 text-[var(--text-secondary)]">{m.from_status}</td>
                      <td className="py-2 font-medium text-[var(--text-primary)]">{m.to_status}</td>
                      <td className="py-2 text-right">{m.count}</td>
                      <td className="py-2 text-right text-[var(--text-muted)]">{acvM(m.acv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {drawerFilters && (
        <OpportunityDrawer
          oppId={null}
          onClose={() => setDrawerFilters(null)}
        />
      )}
    </div>
  )
}
