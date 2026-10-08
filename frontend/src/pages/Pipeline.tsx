import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import Expiry from '@/pages/Expiry'
import Approvals from '@/pages/Approvals'
import BusinessUnits from '@/pages/BusinessUnits'
import RegionBarChart from '@/components/charts/RegionBarChart'
import { useQuery } from '@tanstack/react-query'
import { getTopRegionsBu } from '@/api/client'
import { formatACV } from '@/utils/format'
import Card from '@/components/ui/Card'
import clsx from 'clsx'

type Tab = 'expiry' | 'approvals' | 'bu' | 'regions'

const TABS: { id: Tab; label: string }[] = [
  { id: 'expiry', label: 'Service Expiry' },
  { id: 'approvals', label: 'Approvals Governance' },
  { id: 'bu', label: 'Business Units' },
  { id: 'regions', label: 'Regions' },
]

export default function Pipeline() {
  const activeId = useAppStore((s) => s.activeSnapshotId)
  const location = useLocation()
  const [tab, setTab] = useState<Tab>('expiry')

  useEffect(() => {
    if (location.hash) {
      const h = location.hash.replace('#', '')
      if (['expiry', 'approvals', 'bu', 'regions'].includes(h)) {
        setTab(h as Tab)
      }
    }
  }, [location.hash])

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex gap-1.5 p-1 rounded-xl w-fit bg-slate-100 dark:bg-white/5 border border-[var(--border)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id)
              window.location.hash = t.id
            }}
            className={clsx(
              'px-4 py-2 rounded-lg text-xs font-bold transition-all',
              tab === t.id
                ? 'bg-teal-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-white'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {tab === 'expiry' && <Expiry />}
        {tab === 'approvals' && <Approvals />}
        {tab === 'bu' && <BusinessUnits />}
        {tab === 'regions' && <RegionsTab snapshotId={activeId ?? undefined} />}
      </motion.div>
    </div>
  )
}

function RegionsTab({ snapshotId }: { snapshotId?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['top-regions-bu', snapshotId],
    queryFn: () => getTopRegionsBu(snapshotId),
  })

  return (
    <div className="space-y-6">
      <RegionBarChart snapshotId={snapshotId} />

      {/* Region × BU table */}
      {!isLoading && data?.rows?.length > 0 && (
        <Card className="p-5 overflow-auto">
          <h3 className="font-bold text-sm mb-4 text-[var(--text-primary)] font-display">
            Top Regions × Business Unit
          </h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-2 pr-6 font-semibold text-[var(--text-muted)]">Region</th>
                <th className="text-left py-2 pr-6 font-semibold text-[var(--text-muted)]">Business Unit</th>
                <th className="text-right py-2 font-semibold text-[var(--text-muted)]">ACV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.rows.map((r: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                  <td className="py-2.5 pr-6 font-medium text-[var(--text-primary)]">{r.sub_region}</td>
                  <td className="py-2.5 pr-6 text-[var(--text-muted)]">{r.business_unit}</td>
                  <td className="py-2.5 text-right font-bold text-teal-600 dark:text-teal-400 tabular-nums">
                    {formatACV(r.acv)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
