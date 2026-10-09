import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { getV2ExpirySummary, getV2ExpiryDeals } from '@/api/client'
import { formatDate, acvM } from '@/utils/format'
import { FORECAST_COLORS } from '@/design/tokens'
import OpportunityDrawer from '@/components/overview/OpportunityDrawer'
import { EmptyState } from '@/components/ui/EmptyState'
import MetricToggle from '@/components/common/MetricToggle'
import CompactGrid from '@/components/common/CompactGrid'
import SummaryLine from '@/components/common/SummaryLine'

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
      className="space-y-4 pb-8"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-black tracking-tight text-[var(--text-primary)]">Expiry</h1>
          <p className="text-[var(--text-muted)] mt-1 text-sm">
            As of {formatDate(sum.snapshot_date)} {sum.compare_date && ` vs ${formatDate(sum.compare_date)}`}
          </p>
        </div>
        <div>
          <MetricToggle />
        </div>
      </div>

      {grid1 && (
        <div>
          <CompactGrid
            title={`FY ${fy1} Expiry`}
            columns={sum.categories}
            rows={grid1.rows.map((r: any) => ({
              id: r.quarter,
              label: r.label,
              cells: r.cells,
              total: r.total
            }))}
            totals={grid1.totals}
            deltas={deltas1}
            metricMode={metricMode}
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
        <div className="mt-6">
          <CompactGrid
            title={`FY ${fy2} Expiry`}
            columns={sum.categories}
            rows={grid2.rows.map((r: any) => ({
              id: r.quarter,
              label: r.label,
              cells: r.cells,
              total: r.total
            }))}
            totals={grid2.totals}
            deltas={deltas2}
            metricMode={metricMode}
            onCellClick={handleCellClick}
            rowLabelName="Quarter"
            compareDate={sum.compare_date}
          />
          <SummaryLine
            primaryText={`FY${fy2} expiry: ${acvM(sum.acv_by_year?.[fy2]?.acv)} · ${sum.acv_by_year?.[fy2]?.count} deals`}
          />
        </div>
      )}

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