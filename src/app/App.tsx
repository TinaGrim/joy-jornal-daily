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
      className="fixed top-3 right-3 md:top-4 md:right-4 z-50 p-1.5 md:p-2 rounded-lg bg-white dark:bg-[#313244] border-2 border-[#e8dcc8] dark:border-[#45475a] text-[#8b7355] dark:text-[#cdd6f4] hover:border-[#d97757] transition-colors cursor-pointer"
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
    <div className="fixed top-3 right-12 md:top-4 md:right-14 z-50 flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/80 dark:bg-[#313244]/80 border border-[#e8dcc8] dark:border-[#45475a] text-[10px] font-mono text-[#8b7355] dark:text-[#cdd6f4] select-none" title={`Last: ${syncLatency}ms | Peak: ${syncPeakLatency}ms`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      <span>{isConnected ? `${syncLatency}ms` : 'off'}</span>
    </div>
  )
}

function JournalApp() {
  const { theme } = useTheme()
  const isNight = theme === 'night'
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { selectedElementId, setSelectedElementId, deleteElement, updateElement, pages, focusPageIndex, cloudLoading } = useJournal()

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
        isNight ? 'bg-[#1a1a2e]' : ''
      }`}
      style={!isNight ? {
        background: `
          repeating-linear-gradient(
            87deg,
            transparent,
            transparent 40px,
            rgba(139,115,85,0.03) 40px,
            rgba(139,115,85,0.03) 41px
          ),
          repeating-linear-gradient(
            0deg,
            transparent,
            transparent 8px,
            rgba(160,130,100,0.015) 8px,
            rgba(160,130,100,0.015) 9px
          ),
          linear-gradient(165deg, #d4c4a8 0%, #c9b896 25%, #d1c1a1 50%, #c5b490 75%, #d0c09e 100%)
        `,
      } : undefined}>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'200\' height=\'200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence baseFrequency=\'0.8\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3CfeColorMatrix type=\'saturate\' values=\'0\'/%3E%3C/filter%3E%3Crect width=\'200\' height=\'200\' filter=\'url(%23n)\' opacity=\'0.4\'/%3E%3C/svg%3E")',
          opacity: isNight ? 0.04 : 0.06,
          mixBlendMode: isNight ? 'normal' : 'multiply',
        }}
      />

      {!isNight && (
        <div className="fixed inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 80% 60% at 35% 25%, rgba(255,248,230,0.35) 0%, transparent 60%)',
        }} />
      )}

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
          background: 'radial-gradient(ellipse at 50% 40%, rgba(255,200,120,0.06) 0%, transparent 50%)',
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
          className="flex items-center justify-center p-4 pb-20 md:pb-4 md:p-8 min-w-0"
        >
          {cloudLoading ? (
            <div className="flex flex-col items-center gap-3 py-32">
              <div className="w-9 h-9 border-[3px] border-[#d97757] border-t-transparent rounded-full animate-spin" />
              <span className="font-handwriting text-xl text-[#8b7355]">Opening the journal...</span>
            </div>
          ) : (
            <BookInterface sidebarOpen={sidebarOpen} />
          )}
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
