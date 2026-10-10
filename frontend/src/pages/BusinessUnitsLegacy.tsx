import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  Building2,
  DollarSign,
  Layers,
  CheckCircle2,
  Clock,
  FileQuestion,
  AlertOctagon,
  ChevronRight,
  Filter,
  BarChart3,
  ExternalLink,
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { getApprovalByBu } from '@/api/client'
import { formatACV, formatCount } from '@/utils/format'
import Card from '@/components/ui/Card'
import SegmentedControl from '@/components/ui/SegmentedControl'
import Badge from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import OpportunitiesListDrawer from '@/components/common/OpportunitiesListDrawer'
import OpportunityDrawer from '@/components/overview/OpportunityDrawer'
import clsx from 'clsx'

type BuMode = 'as_in_excel' | 'split'

export default function BusinessUnitsLegacy() {
  const { activeSnapshotId, snapshots } = useAppStore()
  const [buMode, setBuMode] = useState<BuMode>('as_in_excel')

  // Drilldown states
  const [listDrawerOpen, setListDrawerOpen] = useState(false)
  const [listDrawerTitle, setListDrawerTitle] = useState('')
  const [listDrawerSubtitle, setListDrawerSubtitle] = useState('')
  const [drawerFilters, setDrawerFilters] = useState<any>({})
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['approval-by-bu', activeSnapshotId, buMode],
    queryFn: () => getApprovalByBu(activeSnapshotId ?? undefined, buMode),
  })

  const rows = buMode === 'split' ? data?.split_rows || [] : data?.as_in_excel_rows || []
  const totalRow = data?.total || {
    business_unit: 'Total',
    total_count: 3086,
    acv: 450040250.54,
    approved_count: 748,
    approved_2nd_count: 877,
    pending_count: 31,
    blank_count: 1411,
    rejected_count: 19,
    mix: {
      Approved: 24.2,
      'Approved - 2nd': 28.4,
      'Pending-Approval': 1.0,
      Blank: 45.7,
      Rejected: 0.6,
    },
  }

  const activeSnap = snapshots.find((s) => s.id === activeSnapshotId)

  const handleRowClick = (buName: string) => {
    if (buMode === 'as_in_excel') {
      setDrawerFilters({
        snapshotId: activeSnapshotId ?? undefined,
        businessUnitRaw: [buName],
      })
      setListDrawerTitle(`${buName} · Business Unit Deals`)
      setListDrawerSubtitle(`Listing all renewals under Business Unit "${buName}" (Exact match)`)
    } else {
      setDrawerFilters({
        snapshotId: activeSnapshotId ?? undefined,
        businessUnit: [buName],
      })
      setListDrawerTitle(`${buName} · Business Unit Deals`)
      setListDrawerSubtitle(`Listing all renewals containing Business Unit "${buName}"`)
    }
    setListDrawerOpen(true)
  }

  const handleStatusCellClick = (buName: string, statusKey: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const filters: any = {
      snapshotId: activeSnapshotId ?? undefined,
      approvalStatus: [statusKey],
    }
    if (buMode === 'as_in_excel') {
      filters.businessUnitRaw = [buName]
    } else {
      filters.businessUnit = [buName]
    }
    setDrawerFilters(filters)
    setListDrawerTitle(`${buName} · ${statusKey} Deals`)
    setListDrawerSubtitle(`Opportunities in ${buName} with approval status "${statusKey}"`)
    setListDrawerOpen(true)
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Title Header & Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black font-display tracking-tight text-[var(--text-primary)]">
                Business Unit Matrix
              </h1>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Renewals portfolio and approval status distribution segmented across organizational Business Units
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Toggle: As in Excel vs Split */}
        <div className="flex items-center gap-3">
          <SegmentedControl
            options={[
              { value: 'as_in_excel', label: 'As in Excel (16 rows)' },
              { value: 'split', label: 'Split by individual BU' },
            ]}
            value={buMode}
            onChange={(v) => setBuMode(v as BuMode)}
            size="sm"
          />
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3.5 border-l-4 border-l-teal-500">
          <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Total Pipeline
          </div>
          <div className="text-xl font-black font-display text-[var(--text-primary)] tabular-nums mt-1">
            {formatCount(totalRow.total_count)}
          </div>
          <div className="text-xs font-bold text-teal-600 dark:text-teal-400 tabular-nums mt-0.5">
            {formatACV(totalRow.acv)}
          </div>
        </Card>

        <Card className="p-3.5 border-l-4 border-l-emerald-500">
          <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Approved
          </div>
          <div className="text-xl font-black font-display text-[var(--text-primary)] tabular-nums mt-1">
            {formatCount(totalRow.approved_count)}
          </div>
          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
            {totalRow.mix?.Approved}% of deals
          </div>
        </Card>

        <Card className="p-3.5 border-l-4 border-l-teal-600">
          <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Approved - 2nd
          </div>
          <div className="text-xl font-black font-display text-[var(--text-primary)] tabular-nums mt-1">
            {formatCount(totalRow.approved_2nd_count)}
          </div>
          <div className="text-xs font-bold text-teal-600 dark:text-teal-400 tabular-nums mt-0.5">
            {totalRow.mix?.['Approved - 2nd']}% of deals
          </div>
        </Card>

        <Card className="p-3.5 border-l-4 border-l-amber-500">
          <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Pending-Approval
          </div>
          <div className="text-xl font-black font-display text-[var(--text-primary)] tabular-nums mt-1">
            {formatCount(totalRow.pending_count)}
          </div>
          <div className="text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums mt-0.5">
            {totalRow.mix?.['Pending-Approval']}% of deals
          </div>
        </Card>

        <Card className="p-3.5 border-l-4 border-l-slate-400">
          <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Blank
          </div>
          <div className="text-xl font-black font-display text-[var(--text-primary)] tabular-nums mt-1">
            {formatCount(totalRow.blank_count)}
          </div>
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
            {totalRow.mix?.Blank}% of deals
          </div>
        </Card>

        <Card className="p-3.5 border-l-4 border-l-rose-500">
          <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Rejected
          </div>
          <div className="text-xl font-black font-display text-[var(--text-primary)] tabular-nums mt-1">
            {formatCount(totalRow.rejected_count)}
          </div>
          <div className="text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums mt-0.5">
            {totalRow.mix?.Rejected}% of deals
          </div>
        </Card>
      </div>

      {/* Main Business Unit Table Card */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-base font-bold font-display text-[var(--text-primary)]">
              Business Unit Governance Breakdown
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {buMode === 'as_in_excel'
                ? 'Showing distinct Business Unit combinations as in raw Excel (16 rows). Click any row to view opportunities.'
                : 'Showing split view where multi-BU opportunities count once under each individual Business Unit (5 BUs).'}
            </p>
          </div>

          <Badge variant="outline" className="text-xs">
            {buMode === 'as_in_excel' ? '16 Unique Segments' : '5 Core Business Units'}
          </Badge>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] select-none">
                <th className="py-3 px-4 font-bold text-[var(--text-primary)] uppercase tracking-wider text-[11px]">
                  Business Unit
                </th>
                <th className="py-3 px-3 font-bold text-right uppercase tracking-wider text-[11px] text-[var(--text-primary)]">
                  Deals
                </th>
                <th className="py-3 px-3 font-bold text-right uppercase tracking-wider text-[11px] text-teal-600 dark:text-teal-400">
                  Total ACV
                </th>
                {/* Colour-coded columns */}
                <th className="py-3 px-3 font-bold text-right uppercase tracking-wider text-[11px] text-emerald-600 dark:text-emerald-400">
                  Approved
                </th>
                <th className="py-3 px-3 font-bold text-right uppercase tracking-wider text-[11px] text-teal-700 dark:text-teal-300">
                  Approved - 2nd
                </th>
                <th className="py-3 px-3 font-bold text-right uppercase tracking-wider text-[11px] text-amber-600 dark:text-amber-400">
                  Pending
                </th>
                <th className="py-3 px-3 font-bold text-right uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400">
                  Blank
                </th>
                <th className="py-3 px-3 font-bold text-right uppercase tracking-wider text-[11px] text-rose-600 dark:text-rose-400">
                  Rejected
                </th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider text-[11px] text-[var(--text-muted)] w-48">
                  Approval Mix
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={9} className="py-3 px-4">
                      <Skeleton className="h-9 w-full rounded-lg" />
                    </td>
                  </tr>
                ))
              ) : (
                rows.map((row: any) => {
                  const mix = row.mix || {}
                  return (
                    <tr
                      key={row.business_unit}
                      onClick={() => handleRowClick(row.business_unit)}
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors group"
                    >
                      {/* BU Name */}
                      <td className="py-3.5 px-4 font-bold text-[var(--text-primary)] group-hover:text-teal-500 transition-colors whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{row.business_unit}</span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-teal-500 flex-shrink-0" />
                        </div>
                      </td>

                      {/* Total Count */}
                      <td className="py-3.5 px-3 text-right font-extrabold text-[var(--text-primary)] tabular-nums">
                        {formatCount(row.total_count)}
                      </td>

                      {/* ACV */}
                      <td className="py-3.5 px-3 text-right font-bold text-teal-600 dark:text-teal-400 tabular-nums whitespace-nowrap">
                        {formatACV(row.acv)}
                      </td>

                      {/* Approved (green) */}
                      <td
                        onClick={(e) => handleStatusCellClick(row.business_unit, 'Approved', e)}
                        className="py-3.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums hover:underline"
                      >
                        {formatCount(row.approved_count)}
                      </td>

                      {/* Approved - 2nd (emerald/teal) */}
                      <td
                        onClick={(e) => handleStatusCellClick(row.business_unit, 'Approved - 2nd', e)}
                        className="py-3.5 px-3 text-right font-bold text-teal-700 dark:text-teal-300 tabular-nums hover:underline"
                      >
                        {formatCount(row.approved_2nd_count)}
                      </td>

                      {/* Pending-Approval (amber) */}
                      <td
                        onClick={(e) => handleStatusCellClick(row.business_unit, 'Pending-Approval', e)}
                        className="py-3.5 px-3 text-right font-bold text-amber-600 dark:text-amber-400 tabular-nums hover:underline"
                      >
                        {formatCount(row.pending_count)}
                      </td>

                      {/* Blank (slate/grey) */}
                      <td
                        onClick={(e) => handleStatusCellClick(row.business_unit, 'Blank', e)}
                        className="py-3.5 px-3 text-right font-medium text-slate-500 dark:text-slate-400 tabular-nums hover:underline"
                      >
                        {formatCount(row.blank_count)}
                      </td>

                      {/* Rejected (red) */}
                      <td
                        onClick={(e) => handleStatusCellClick(row.business_unit, 'Rejected', e)}
                        className="py-3.5 px-3 text-right font-bold text-rose-600 dark:text-rose-400 tabular-nums hover:underline"
                      >
                        {formatCount(row.rejected_count)}
                      </td>

                      {/* Mini Stacked Bar */}
                      <td className="py-3.5 px-4">
                        <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-100 dark:bg-white/10 gap-0.5">
                          {mix.Approved > 0 && (
                            <div
                              style={{ width: `${mix.Approved}%`, backgroundColor: '#10B981' }}
                              title={`Approved: ${mix.Approved}%`}
                              className="h-full"
                            />
                          )}
                          {mix['Approved - 2nd'] > 0 && (
                            <div
                              style={{ width: `${mix['Approved - 2nd']}%`, backgroundColor: '#00A3AD' }}
                              title={`Approved - 2nd: ${mix['Approved - 2nd']}%`}
                              className="h-full"
                            />
                          )}
                          {mix['Pending-Approval'] > 0 && (
                            <div
                              style={{ width: `${mix['Pending-Approval']}%`, backgroundColor: '#F59E0B' }}
                              title={`Pending: ${mix['Pending-Approval']}%`}
                              className="h-full"
                            />
                          )}
                          {mix.Blank > 0 && (
                            <div
                              style={{ width: `${mix.Blank}%`, backgroundColor: '#94A3B8' }}
                              title={`Blank: ${mix.Blank}%`}
                              className="h-full"
                            />
                          )}
                          {mix.Rejected > 0 && (
                            <div
                              style={{ width: `${mix.Rejected}%`, backgroundColor: '#EF4444' }}
                              title={`Rejected: ${mix.Rejected}%`}
                              className="h-full"
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}

              {/* Total Row */}
              <tr className="bg-slate-100/90 dark:bg-white/[0.06] font-bold border-t-2 border-[var(--border)]">
                <td className="py-4 px-4 font-black font-display text-[var(--text-primary)] uppercase tracking-wider text-xs">
                  {totalRow.business_unit}
                </td>
                <td className="py-4 px-3 text-right font-black text-sm text-[var(--text-primary)] tabular-nums">
                  {formatCount(totalRow.total_count)}
                </td>
                <td className="py-4 px-3 text-right font-black text-sm text-teal-600 dark:text-teal-400 tabular-nums whitespace-nowrap">
                  {formatACV(totalRow.acv)}
                </td>
                <td className="py-4 px-3 text-right font-black text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatCount(totalRow.approved_count)}
                </td>
                <td className="py-4 px-3 text-right font-black text-xs text-teal-700 dark:text-teal-300 tabular-nums">
                  {formatCount(totalRow.approved_2nd_count)}
                </td>
                <td className="py-4 px-3 text-right font-black text-xs text-amber-600 dark:text-amber-400 tabular-nums">
                  {formatCount(totalRow.pending_count)}
                </td>
                <td className="py-4 px-3 text-right font-black text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {formatCount(totalRow.blank_count)}
                </td>
                <td className="py-4 px-3 text-right font-black text-xs text-rose-600 dark:text-rose-400 tabular-nums">
                  {formatCount(totalRow.rejected_count)}
                </td>
                <td className="py-4 px-4">
                  <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-slate-200 dark:bg-white/10 gap-0.5">
                    <div style={{ width: `${totalRow.mix?.Approved}%`, backgroundColor: '#10B981' }} className="h-full" />
                    <div style={{ width: `${totalRow.mix?.['Approved - 2nd']}%`, backgroundColor: '#00A3AD' }} className="h-full" />
                    <div style={{ width: `${totalRow.mix?.['Pending-Approval']}%`, backgroundColor: '#F59E0B' }} className="h-full" />
                    <div style={{ width: `${totalRow.mix?.Blank}%`, backgroundColor: '#94A3B8' }} className="h-full" />
                    <div style={{ width: `${totalRow.mix?.Rejected}%`, backgroundColor: '#EF4444' }} className="h-full" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
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
