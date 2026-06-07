import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { Toaster } from 'sonner'
import { JournalProvider, useJournal } from './contexts/JournalContext'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import BookInterface from './components/BookInterface'
import LeftSidebar from './components/LeftSidebar'
import RightToolbar from './components/RightToolbar'
import AuthScreen from './components/AuthScreen'
import { Moon, Sun } from 'lucide-react'

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      className="fixed top-4 right-4 z-50 p-2 rounded-lg bg-white border-2 border-[#e8dcc8] text-[#8b7355] hover:border-[#d97757] transition-colors cursor-pointer"
      title={theme === 'day' ? 'Night journaling' : 'Day mode'}
    >
      {theme === 'day' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
    </button>
  )
}

function SyncBadge() {
  const { syncLatency, syncPeakLatency, isConnected } = useJournal()
  const color = !isConnected ? '#ef4444' : syncLatency > 500 ? '#ef4444' : syncLatency > 200 ? '#f59e0b' : syncLatency > 50 ? '#eab308' : '#22c55e'
  return (
    <div className="fixed top-4 right-14 z-50 flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/80 border border-[#e8dcc8] text-[10px] font-mono text-[#8b7355] select-none" title={`Last: ${syncLatency}ms | Peak: ${syncPeakLatency}ms`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      <span>{isConnected ? `${syncLatency}ms` : 'off'}</span>
    </div>
  )
}

function JournalApp() {
  const { theme } = useTheme()
  const isNight = theme === 'night'
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { selectedElementId, setSelectedElementId, deleteElement, updateElement, pages, focusPageIndex } = useJournal()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!selectedElementId || isInput) return
        e.preventDefault()
        deleteElement(selectedElementId, focusPageIndex)
        setSelectedElementId(null)
        return
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (!selectedElementId || isInput) return
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const page = pages[focusPageIndex]
        if (!page) return
        const el = (page.elements ?? []).find(el => el.id === selectedElementId)
        if (!el) return
        const deltas: Record<string, { x: number; y: number }> = {
          ArrowUp: { x: 0, y: -step },
          ArrowDown: { x: 0, y: step },
          ArrowLeft: { x: -step, y: 0 },
          ArrowRight: { x: step, y: 0 },
        }
        const d = deltas[e.key]
        updateElement(selectedElementId, { x: el.x + d.x, y: el.y + d.y }, undefined, focusPageIndex)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedElementId, deleteElement, setSelectedElementId, updateElement, pages, focusPageIndex])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className={`h-dvh w-full overflow-hidden relative transition-colors duration-500 ${
        isNight ? 'bg-[#1a1a2e]' : 'bg-[#e5d9bf]'
      }`}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.03 }}
        transition={{ duration: 1 }}
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100\' height=\'100\' filter=\'url(%23noise)\' opacity=\'0.5\'/%3E%3C/svg%3E")',
        }}
      />

      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.8, delay: 0.8, ease: 'easeOut' }}
        className="fixed inset-0 pointer-events-none z-50"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, rgba(217,119,87,0.12) 0%, rgba(217,119,87,0.04) 40%, transparent 70%)',
        }}
      />

      {isNight && (
        <div className="fixed inset-0 pointer-events-none z-40" style={{
          background: 'radial-gradient(ellipse at 50% 50%, rgba(255,180,50,0.03) 0%, transparent 70%)',
        }} />
      )}

      <>
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <ThemeToggle />
          <SyncBadge />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <LeftSidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex items-center justify-center p-4 md:p-8 min-w-0"
        >
          <BookInterface sidebarOpen={sidebarOpen} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <RightToolbar />
        </motion.div>
      </>
    </motion.div>
  )
}

function AuthGate() {
  const { isAuthenticated } = useJournal()

  if (!isAuthenticated) {
    return <AuthScreen />
  }

  return <JournalApp />
}

export default function App() {
  return (
    <DndProvider backend={HTML5Backend}>
      <ThemeProvider>
        <JournalProvider>
          <Toaster position="top-right" />
          <AuthGate />
        </JournalProvider>
      </ThemeProvider>
    </DndProvider>
  )
}
