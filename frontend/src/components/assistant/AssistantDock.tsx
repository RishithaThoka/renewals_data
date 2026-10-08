import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Maximize2, Sparkles, Command } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import AssistantChat from './AssistantChat'

export default function AssistantDock() {
  const navigate = useNavigate()
  const isOpen = useAppStore((s) => s.assistantOpen)
  const setOpen = useAppStore((s) => s.setAssistantOpen)
  const toggle = useAppStore((s) => s.toggleAssistant)

  // Register keyboard shortcut: Ctrl+/ or Cmd+/ to toggle, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        toggle()
      } else if (e.key === 'Escape' && isOpen) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, toggle, setOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop on small screens */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 bg-black z-40 lg:hidden"
          />

          {/* Slide-over Docked Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed top-0 right-0 bottom-0 w-full sm:w-[440px] z-50 shadow-2xl flex flex-col border-l"
            style={{
              background: 'var(--bg-primary)',
              borderColor: 'var(--border)',
            }}
            id="assistant-docked-panel"
          >
            {/* Top Toolbar */}
            <div
              className="px-4 py-2.5 border-b flex items-center justify-between shrink-0"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="flex items-center gap-2">
                <Sparkles size={16} style={{ color: '#00A3AD' }} />
                <span className="font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                  Data Assistant
                </span>
                <span
                  className="hidden sm:inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border opacity-60 font-mono"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                  <Command size={10} /> /
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setOpen(false)
                    navigate('/assistant')
                  }}
                  className="p-1.5 rounded-lg text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  title="Expand to Full Page (/assistant)"
                >
                  <Maximize2 size={15} />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  title="Close Assistant (Esc)"
                  id="assistant-close-button"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-hidden">
              <AssistantChat isFullPage={false} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
