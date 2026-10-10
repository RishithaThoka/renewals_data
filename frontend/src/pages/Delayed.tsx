import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Clock, CalendarX2, ArrowRight, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import api from '@/api/client'
import { formatACV, formatCount } from '@/utils/format'
import Card from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import DealListModal from '@/components/common/DealListModal'
import OpportunityDrawer from '@/components/overview/OpportunityDrawer'
import CompactGrid from '@/components/common/CompactGrid'
import MetricToggle from '@/components/common/MetricToggle'
import SummaryLine from '@/components/common/SummaryLine'
import ErrorBoundary from '@/components/common/ErrorBoundary'

const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ')
type MetricMode = 'Amount' | 'Count' | 'Both'

function DelayedContent() {
  const { activeSnapshotId } = useAppStore()
  const metricMode = (useAppStore((s: any) => s.metricMode) || 'Amount') as MetricMode
  
  const [compare, setCompare] = useState<'yesterday' | 'last_week'>('yesterday')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modalFilters, setModalFilters] = useState<any>({})
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null)

  const { data: summary, isLoading, error } = useQuery({
    queryKey: ['v2-delayed-summary', activeSnapshotId, compare],
    queryFn: async () => {
      const res = await api.get('/v2/delayed/summary', {
        params: { as_of: activeSnapshotId ?? undefined, compare }
      })
      return res.data
    },
  })

  const { data: dealsData } = useQuery({
    queryKey: ['v2-delayed-deals', activeSnapshotId, compare],
    queryFn: async () => {
      const res = await api.get('/v2/delayed/deals', {
        params: { as_of: activeSnapshotId ?? undefined, compare }
      })
      return res.data
    },
    enabled: modalOpen && Object.keys(modalFilters).length === 0
  })

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || summary?.error) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center text-red-500">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Could not load Delayed data</h2>
          <p className="text-sm opacity-80">{summary?.error || 'Server error'}</p>
        </Card>
      </div>
    )
  }

  const handleDrill = (title: string, filters: any = {}) => {
    setModalTitle(title)
    setModalFilters(filters)
    setModalOpen(true)
  }

  const DeltaDisplay = ({ data }: { data: any }) => {
    if (!data) return null;
    const isY = compare === 'yesterday';
    const dCount = isY ? (data.delta_yesterday?.count ?? 0) : (data.delta_lastweek?.count ?? 0);
    const dAcv = isY ? (data.delta_yesterday?.acv ?? 0) : (data.delta_lastweek?.acv ?? 0);
    
    if (dCount === 0 && dAcv === 0) return <span className="text-gray-400"><Minus className="w-3 h-3 inline mr-1" />No change</span>;
    
    const isPos = dAcv > 0 || dCount > 0;
    const Icon = isPos ? ArrowUpRight : ArrowDownRight;
    const color = isPos ? 'text-red-500' : 'text-green-500'; // Delay is bad, so increase in delayed is red
    
    return (
      <span className={cn("inline-flex items-center text-xs font-medium", color)}>
        <Icon className="w-3 h-3 mr-1" />
        {metricMode === 'Amount' ? formatACV(dAcv) : metricMode === 'Count' ? formatCount(dCount) : `${formatCount(dCount)} / ${formatACV(dAcv)}`}
      </span>
    )
  }
  
  const totalCount = summary?.total?.count ?? 0
  const totalAcv = summary?.total?.acv ?? 0
  const totalY = summary?.total?.delta_yesterday ?? { count: 0, acv: 0 }
  const totalW = summary?.total?.delta_lastweek ?? { count: 0, acv: 0 }
  
  const overdueCount = summary?.overdue?.count ?? 0
  const overdueAcv = summary?.overdue?.acv ?? 0
  
  const slippedCount = summary?.slipped?.count ?? 0
  const slippedAcv = summary?.slipped?.acv ?? 0

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-amber-500" />
            Delayed & Overdue
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {summary?.data_slice} renewals that missed their close date or slipped to a later period
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-gray-100 dark:bg-gray-900 p-1 rounded-md">
            <button
              onClick={() => setCompare('yesterday')}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded transition-colors",
                compare === 'yesterday' ? "bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              vs Yesterday
            </button>
            <button
              onClick={() => setCompare('last_week')}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded transition-colors",
                compare === 'last_week' ? "bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              vs Last Week
            </button>
          </div>
          <MetricToggle />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card 
          className="p-5 cursor-pointer hover:border-amber-500/50 transition-colors bg-gradient-to-br from-amber-50/50 to-white dark:from-amber-900/10 dark:to-gray-800"
          onClick={() => handleDrill(`Total Delayed & Overdue Deals`)}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="font-semibold text-gray-700 dark:text-gray-300">Total Delayed</span>
            </div>
          </div>
          <div className="space-y-1 mb-4">
            {(metricMode === 'Count' || metricMode === 'Both') && (
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {formatCount(totalCount)}
              </div>
            )}
            {(metricMode === 'Amount' || metricMode === 'Both') && (
              <div className={cn("font-bold text-gray-900 dark:text-white", metricMode === 'Both' ? 'text-xl' : 'text-3xl')}>
                {formatACV(totalAcv)}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1 text-xs text-gray-500">
            <div className="flex items-center justify-between">
              <span>vs {summary?.yesterday_date}</span>
              <span className="text-red-500">+{totalY.count} / +{formatACV(totalY.acv)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>vs {summary?.lastweek_date}</span>
              <span className="text-red-500">+{totalW.count} / +{formatACV(totalW.acv)}</span>
            </div>
          </div>
        </Card>

        <Card 
          className="p-5 cursor-pointer hover:border-red-500/50 transition-colors"
          onClick={() => handleDrill(`Overdue Deals`)}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <CalendarX2 className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <span className="font-semibold text-gray-700 dark:text-gray-300">Overdue</span>
            </div>
          </div>
          <div className="space-y-1 mb-4">
            {(metricMode === 'Count' || metricMode === 'Both') && (
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {formatCount(overdueCount)}
              </div>
            )}
            {(metricMode === 'Amount' || metricMode === 'Both') && (
              <div className={cn("font-bold text-gray-900 dark:text-white", metricMode === 'Both' ? 'text-xl' : 'text-3xl')}>
                {formatACV(overdueAcv)}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1 text-xs text-gray-500">
            <div className="flex items-center justify-between">
              <span>vs {summary?.yesterday_date}</span>
              <span className="text-red-500">+{summary?.overdue?.delta_yesterday?.count ?? 0} / +{formatACV(summary?.overdue?.delta_yesterday?.acv ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>vs {summary?.lastweek_date}</span>
              <span className="text-red-500">+{summary?.overdue?.delta_lastweek?.count ?? 0} / +{formatACV(summary?.overdue?.delta_lastweek?.acv ?? 0)}</span>
            </div>
          </div>
        </Card>

        <Card 
          className="p-5 cursor-pointer hover:border-orange-500/50 transition-colors"
          onClick={() => handleDrill(`Slipped Deals`)}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <ArrowRight className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              </div>
              <span className="font-semibold text-gray-700 dark:text-gray-300">Slipped to Later Period</span>
            </div>
          </div>
          <div className="space-y-1 mb-4">
            {(metricMode === 'Count' || metricMode === 'Both') && (
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {formatCount(slippedCount)}
              </div>
            )}
            {(metricMode === 'Amount' || metricMode === 'Both') && (
              <div className={cn("font-bold text-gray-900 dark:text-white", metricMode === 'Both' ? 'text-xl' : 'text-3xl')}>
                {formatACV(slippedAcv)}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1 text-xs text-gray-500">
            <div className="flex items-center justify-between">
              <span>vs {summary?.yesterday_date}</span>
              <span className="text-red-500">+{summary?.slipped?.delta_yesterday?.count ?? 0} / +{formatACV(summary?.slipped?.delta_yesterday?.acv ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>vs {summary?.lastweek_date}</span>
              <span className="text-red-500">+{summary?.slipped?.delta_lastweek?.count ?? 0} / +{formatACV(summary?.slipped?.delta_lastweek?.acv ?? 0)}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">By Region</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3 font-medium rounded-tl-md">Region</th>
                  <th className="px-4 py-3 font-medium text-right">Count</th>
                  <th className="px-4 py-3 font-medium text-right">ACV</th>
                  <th className="px-4 py-3 font-medium text-right rounded-tr-md">Avg Push (Days)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {summary?.by_region?.map((r: any) => (
                  <tr key={r.label} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => handleDrill(`Delayed - ${r.label}`, { region: r.label })}>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{r.label}</td>
                    <td className="px-4 py-3 text-right">{r.count}</td>
                    <td className="px-4 py-3 text-right">{formatACV(r.acv)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                        {r.avg_push_out}d
                      </span>
                    </td>
                  </tr>
                ))}
                {(!summary?.by_region || summary.by_region.length === 0) && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No delayed deals</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">By Forecast Category</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3 font-medium rounded-tl-md">Category</th>
                  <th className="px-4 py-3 font-medium text-right">Count</th>
                  <th className="px-4 py-3 font-medium text-right">ACV</th>
                  <th className="px-4 py-3 font-medium text-right rounded-tr-md">Avg Push (Days)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {summary?.by_category?.map((r: any) => (
                  <tr key={r.label} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => handleDrill(`Delayed - ${r.label}`, { category: r.label })}>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{r.label}</td>
                    <td className="px-4 py-3 text-right">{r.count}</td>
                    <td className="px-4 py-3 text-right">{formatACV(r.acv)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                        {r.avg_push_out}d
                      </span>
                    </td>
                  </tr>
                ))}
                {(!summary?.by_category || summary.by_category.length === 0) && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No delayed deals</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      
      <SummaryLine primaryText={`Total Delayed ACV is ${formatACV(totalAcv)}, up ${formatACV(totalW.acv)} from last week`} />

      {modalOpen && (
        <DealListModal
          title={modalTitle}
          deals={dealsData?.deals || []}
          initialFilters={{
            sub_region: modalFilters.region,
            forecast_category: modalFilters.category,
            business_unit_primary: modalFilters.bu,
            approval_status: modalFilters.status
          }}
          onSelectOpp={setSelectedOppId}
          onClose={() => setModalOpen(false)}
        />
      )}

      <OpportunityDrawer
        oppId={selectedOppId}
        onClose={() => setSelectedOppId(null)}
      />
    </div>
  )
}

export default function Delayed() {
  return (
    <ErrorBoundary>
      <DelayedContent />
    </ErrorBoundary>
  )
}
