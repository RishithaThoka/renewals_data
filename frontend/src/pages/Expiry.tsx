import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, TrendingUp, TrendingDown, X } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { getV2ExpirySummary, getV2ExpiryDeals } from '@/api/client'
import { formatDate } from '@/utils/format'
import { FORECAST_COLORS } from '@/design/tokens'
import OpportunityDrawer from '@/components/overview/OpportunityDrawer'
import { EmptyState } from '@/components/ui/EmptyState'

function acvM(v: number | null | undefined): string {
  if (v == null) return '—'
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
      {up ? '▲' : '▼'} {up ? '+' : ''}{acvM(val)}
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
          className="card-premium w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden bg-[var(--bg-primary)]"
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
                    <tr className="border-b border-[var(--border)]">
                      <th className="px-4 py-3 text-left font-semibold text-[var(--text-muted)]">Opportunity</th>
                      <th className="px-4 py-3 text-left font-semibold text-[var(--text-muted)]">Account</th>
                      <th className="px-4 py-3 text-right font-semibold text-[var(--text-muted)]">ACV</th>
                      <th className="px-4 py-3 text-center font-semibold text-[var(--text-muted)]">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deals.map(d => (
                      <tr
                        key={d.id}
                        className="border-b border-[var(--border)] hover:bg-[var(--bg-secondary)] cursor-pointer transition-colors"
                        onClick={() => {
                          onSelectOpp(d.id)
                          onClose()
                        }}
                      >
                        <td className="px-4 py-3 font-medium">{d.opportunity_name || d.opportunity_id_18}</td>
                        <td className="px-4 py-3 text-[var(--text-muted)]">{d.account_name || '-'}</td>
                        <td className="px-4 py-3 text-right font-medium">{acvM(d.forecast_acv_amount)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={{
                              backgroundColor: `${FORECAST_COLORS[d.forecast_category as keyof typeof FORECAST_COLORS] || '#cbd5e1'}33`,
                              color: FORECAST_COLORS[d.forecast_category as keyof typeof FORECAST_COLORS] || '#64748b'
                            }}
                          >
                            {d.forecast_category}
                          </span>
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

function HeatmapCell({
  count,
  acv,
  maxAcv,
  onClick,
  isTotal = false,
  deltas,
}: {
  count: number
  acv: number
  maxAcv: number
  onClick: () => void
  isTotal?: boolean
  deltas?: any
}) {
  const ratio = maxAcv > 0 ? acv / maxAcv : 0
  const bgOpacity = Math.max(0, Math.min(ratio * 0.4, 0.4))
  
  return (
    <td
      onClick={onClick}
      className={`px-4 py-4 text-center cursor-pointer transition-all hover:bg-[var(--primary)] hover:bg-opacity-10 ${
        isTotal ? 'font-bold bg-[var(--bg-secondary)] border-l border-t border-[var(--border)]' : ''
      }`}
      style={!isTotal && acv > 0 ? { backgroundColor: `rgba(99, 102, 241, ${bgOpacity})` } : {}}
    >
      <div className="flex flex-col items-center justify-center gap-1">
        <span className="text-lg font-bold text-[var(--text-primary)]">{count}</span>
        <span className="text-xs text-[var(--text-muted)]">{acvM(acv)}</span>
        
        {isTotal && deltas && (
          <div className="flex flex-col gap-1 mt-1">
            {(deltas.yesterday?.count != null || deltas.yesterday?.acv != null) && (
              <div className="flex items-center gap-1 justify-center">
                <span className="text-[9px] text-[var(--text-muted)] w-4 text-right">1d</span>
                <DeltaBadge val={deltas.yesterday.count} />
                <AcvDelta val={deltas.yesterday.acv} />
              </div>
            )}
            {(deltas.lastweek?.count != null || deltas.lastweek?.acv != null) && (
              <div className="flex items-center gap-1 justify-center">
                <span className="text-[9px] text-[var(--text-muted)] w-4 text-right">7d</span>
                <DeltaBadge val={deltas.lastweek.count} />
                <AcvDelta val={deltas.lastweek.acv} />
              </div>
            )}
            {(deltas.custom?.count != null || deltas.custom?.acv != null) && (
              <div className="flex items-center gap-1 justify-center">
                <span className="text-[9px] text-[var(--text-muted)] w-4 text-right">vs</span>
                <DeltaBadge val={deltas.custom.count} />
                <AcvDelta val={deltas.custom.acv} />
              </div>
            )}
          </div>
        )}
      </div>
    </td>
  )
}

function ExpiryGrid({
  data,
  yearLabel,
  maxAcv,
  categories,
  deltas,
  onCellClick
}: {
  data: any
  yearLabel: string
  maxAcv: number
  categories: string[]
  deltas: any
  onCellClick: (q: string | null, c: string | null, title: string) => void
}) {
  if (!data || !data.rows) return null
  
  return (
    <div className="card-premium overflow-hidden mb-8">
      <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-secondary)] flex justify-between items-center">
        <h2 className="font-display font-bold text-lg text-[var(--text-primary)]">FY {yearLabel} Expiry</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
              <th className="px-4 py-3 text-left font-semibold text-[var(--text-muted)] uppercase tracking-wider text-xs">Quarter</th>
              {categories.map(c => (
                <th key={c} className="px-4 py-3 text-center font-semibold text-[var(--text-muted)] uppercase tracking-wider text-xs">
                  {c}
                </th>
              ))}
              <th className="px-4 py-3 text-center font-bold text-[var(--text-primary)] uppercase tracking-wider text-xs bg-[var(--bg-secondary)] border-l border-[var(--border)]">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r: any) => (
              <tr key={r.quarter} className="border-b border-[var(--border)] last:border-0">
                <td 
                  className="px-4 py-4 font-bold text-sm bg-[var(--bg-secondary)] border-r border-[var(--border)] cursor-pointer hover:text-[var(--primary)]"
                  onClick={() => onCellClick(r.quarter, null, `${r.label} Expiry`)}
                >
                  {r.label}
                </td>
                {categories.map(c => (
                  <HeatmapCell
                    key={c}
                    count={r.cells[c]?.count || 0}
                    acv={r.cells[c]?.acv || 0}
                    maxAcv={maxAcv}
                    onClick={() => onCellClick(r.quarter, c, `${r.label} - ${c}`)}
                  />
                ))}
                <HeatmapCell
                  count={r.total.count}
                  acv={r.total.acv}
                  maxAcv={maxAcv}
                  onClick={() => onCellClick(r.quarter, null, `${r.label} Total`)}
                  isTotal={true}
                  deltas={{
                    yesterday: deltas?.yesterday?.quarters?.[r.quarter],
                    lastweek: deltas?.lastweek?.quarters?.[r.quarter],
                    custom: deltas?.custom?.quarters?.[r.quarter]
                  }}
                />
              </tr>
            ))}
            {/* Grand Total Row */}
            <tr className="border-t-2 border-[var(--border)] bg-[var(--bg-secondary)]">
              <td 
                className="px-4 py-4 font-bold text-sm border-r border-[var(--border)] cursor-pointer hover:text-[var(--primary)]"
                onClick={() => onCellClick(null, null, `FY ${yearLabel} Total Expiry`)}
              >
                TOTAL
              </td>
              {categories.map(c => (
                <HeatmapCell
                  key={c}
                  count={data.totals.category[c]?.count || 0}
                  acv={data.totals.category[c]?.acv || 0}
                  maxAcv={maxAcv}
                  onClick={() => onCellClick(null, c, `FY ${yearLabel} - ${c}`)}
                  isTotal={true}
                  deltas={{
                    yesterday: deltas?.yesterday?.category?.[c],
                    lastweek: deltas?.lastweek?.category?.[c],
                    custom: deltas?.custom?.category?.[c]
                  }}
                />
              ))}
              <HeatmapCell
                count={data.totals.grand.count}
                acv={data.totals.grand.acv}
                maxAcv={maxAcv}
                onClick={() => onCellClick(null, null, `FY ${yearLabel} Grand Total`)}
                isTotal={true}
                deltas={{
                  yesterday: deltas?.yesterday?.grand,
                  lastweek: deltas?.lastweek?.grand,
                  custom: deltas?.custom?.grand
                }}
              />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Expiry() {
  const {
    activeSnapshotId,
    compareSnapshotId,
    snapshots,
    includeDeletedLost,
    selectedOppId,
    setSelectedOppId,
  } = useAppStore()

  const activeSnapshot = snapshots.find(s => s.id === activeSnapshotId)
  const compareSnapshot = snapshots.find(s => s.id === compareSnapshotId)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modalParams, setModalParams] = useState<{ quarter: string | null; category: string | null }>({ quarter: null, category: null })

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
        <div className="h-96 w-full bg-[var(--bg-secondary)] animate-pulse rounded-xl"></div>
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

  let maxAcv = 0
  if (grid1 && grid1.rows) {
    grid1.rows.forEach((r: any) => {
      sum.categories.forEach((c: string) => {
        if (r.cells[c] && r.cells[c].acv > maxAcv) maxAcv = r.cells[c].acv
      })
    })
  }
  if (grid2 && grid2.rows) {
    grid2.rows.forEach((r: any) => {
      sum.categories.forEach((c: string) => {
        if (r.cells[c] && r.cells[c].acv > maxAcv) maxAcv = r.cells[c].acv
      })
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-black tracking-tight text-[var(--text-primary)]">Expiry</h1>
          <p className="text-[var(--text-muted)] mt-1">
            As of {formatDate(sum.snapshot_date)} {sum.compare_date && ` vs ${formatDate(sum.compare_date)}`}
          </p>
        </div>
      </div>

      {grid1 && (
        <ExpiryGrid
          data={grid1}
          yearLabel={fy1}
          maxAcv={maxAcv}
          categories={sum.categories}
          deltas={deltas1}
          onCellClick={handleCellClick}
        />
      )}

      {grid2 && (
        <ExpiryGrid
          data={grid2}
          yearLabel={fy2}
          maxAcv={maxAcv}
          categories={sum.categories}
          deltas={deltas2}
          onCellClick={handleCellClick}
        />
      )}

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div 
          className="card-premium p-6 flex flex-col cursor-pointer transition-transform hover:scale-[1.02]"
          onClick={() => handleCellClick(null, null, `FY ${fy1} Total`)}
        >
          <span className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">ACV {fy1}</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[var(--text-primary)]">{acvM(sum.acv_by_year?.[fy1]?.acv)}</span>
            <span className="text-sm text-[var(--text-muted)] font-medium">{sum.acv_by_year?.[fy1]?.count} deals</span>
          </div>
        </div>

        <div 
          className="card-premium p-6 flex flex-col cursor-pointer transition-transform hover:scale-[1.02]"
          onClick={() => handleCellClick(null, null, `FY ${fy2} Total`)}
        >
          <span className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">ACV {fy2}</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[var(--text-primary)]">{acvM(sum.acv_by_year?.[fy2]?.acv)}</span>
            <span className="text-sm text-[var(--text-muted)] font-medium">{sum.acv_by_year?.[fy2]?.count} deals</span>
          </div>
        </div>

        <div className="card-premium p-6 flex flex-col">
          <span className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Slippage to {fy2}</span>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-3xl font-black text-red-600 dark:text-red-400">{acvM(sum.slippage?.acv)}</span>
            <span className="text-sm text-[var(--text-muted)] font-medium">{sum.slippage?.count} deals</span>
          </div>
          {sum.slippage?.by_quarter?.length > 0 && (
            <div className="mt-2 space-y-1 border-t border-[var(--border)] pt-3">
              <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">By Expiry Quarter</span>
              {sum.slippage.by_quarter.map((q: any) => (
                <div key={q.quarter} className="flex justify-between items-center text-xs">
                  <span className="font-medium text-[var(--text-secondary)]">{q.quarter}</span>
                  <span className="text-[var(--text-muted)]">{q.count} deals / {acvM(q.acv)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <DealModal
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