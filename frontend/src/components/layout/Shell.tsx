import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import CommandPalette from './CommandPalette'
import OpportunityDrawer from '@/components/overview/OpportunityDrawer'
import AssistantDock from '@/components/assistant/AssistantDock'
import { useAppStore } from '@/store/appStore'
import { useEffect } from 'react'

export default function Shell() {
  const activeSnapshot = useAppStore(s => s.snapshots.find(snap => snap.id === s.activeSnapshotId))
  const asOf = activeSnapshot?.snapshot_date ? new Date(activeSnapshot.snapshot_date).toLocaleDateString() : 'N/A'
  const setOpen = useAppStore(s => s.setCommandPaletteOpen)
  const selectedOppId = useAppStore(s => s.selectedOppId)
  const setSelectedOppId = useAppStore(s => s.setSelectedOppId)

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
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
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

