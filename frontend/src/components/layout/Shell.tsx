import { Outlet } from 'react-router-dom'
import GlobalHeader from './GlobalHeader'
import Footer from './Footer'
import CommandPalette from './CommandPalette'
import OpportunityDrawer from '@/components/overview/OpportunityDrawer'
import AssistantDock from '@/components/assistant/AssistantDock'
import { useAppStore } from '@/store/appStore'
import { useEffect } from 'react'

export default function Shell() {
  const setOpen = useAppStore(s => s.setCommandPaletteOpen)
  const selectedOppId = useAppStore(s => s.selectedOppId)
  const setSelectedOppId = useAppStore(s => s.setSelectedOppId)

  // Global Cmd+K / Ctrl+K shortcut
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
    <div
      className="flex flex-col min-h-screen"
      style={{ background: 'var(--bg-primary)' }}
    >
      <GlobalHeader />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
          <Outlet />
        </div>
      </main>

      <Footer />

      <CommandPalette />
      <OpportunityDrawer oppId={selectedOppId} onClose={() => setSelectedOppId(null)} />
      <AssistantDock />
    </div>
  )
}

