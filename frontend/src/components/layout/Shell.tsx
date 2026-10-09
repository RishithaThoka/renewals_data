import { Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { api } from '@/lib/api'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import CommandPalette from './CommandPalette'
import OpportunityDrawer from '@/components/overview/OpportunityDrawer'
import AssistantDock from '@/components/assistant/AssistantDock'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import { useAppStore } from '@/store/appStore'
import { useEffect } from 'react'

export default function Shell() {
  const activeSnapshot = useAppStore(s => s.snapshots.find(snap => snap.id === s.activeSnapshotId))
  const asOf = activeSnapshot?.snapshot_date ? new Date(activeSnapshot.snapshot_date).toLocaleDateString() : 'N/A'
  const setOpen = useAppStore(s => s.setCommandPaletteOpen)
  const selectedOppId = useAppStore(s => s.selectedOppId)
  const setSelectedOppId = useAppStore(s => s.setSelectedOppId)

  const { data: dbHealth } = useQuery({
    queryKey: ['dbHealth'],
    queryFn: async () => {
      const res = await api.get('/api/health/db')
      return res.data
    },
    staleTime: 60000 * 5, // 5 minutes
  })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setOpen])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {dbHealth?.is_legacy && (
          <div className="bg-amber-100 text-amber-900 px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 border-b border-amber-200 z-50">
            <AlertTriangle className="w-4 h-4" />
            Warning: The connected database was created by an older version of the app. Please re-upload the latest Excel snapshots for full compatibility.
          </div>
        )}
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
                  <footer className="mt-8 text-center text-xs text-slate-400 font-medium py-4">
            Mobileum Horizon · Renewals Intelligence Platform · Data as of {asOf}
          </footer>
        </main>
      </div>
      <CommandPalette />
      <OpportunityDrawer oppId={selectedOppId} onClose={() => setSelectedOppId(null)} />
      <AssistantDock />
    </div>
  )
}

