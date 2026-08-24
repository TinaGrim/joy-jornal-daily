import { useState, useEffect, useRef } from 'react'
import { useDragDropManager } from 'react-dnd'
import { motion } from 'motion/react'
import {
  ImageIcon, Grid3x3, Pencil, Type, Smile, Sticker, Mail, Shapes, Palette, History, ChevronLeft,
} from 'lucide-react'
import type { PanelType } from '@/types/journal'
import { useJournal } from '../contexts/JournalContext'
import { useTheme } from '../contexts/ThemeContext'
import { cn } from '@/lib/utils'
import PhotoPanel from './panels/PhotoPanel'
import TemplatesPanel from './panels/TemplatesPanel'
import DrawPanel from './panels/DrawPanel'
import TextPanel from './panels/TextPanel'
import EmojiPanel from './panels/EmojiPanel'
import StickersPanel from './panels/StickersPanel'
import EnvelopePanel from './panels/EnvelopePanel'
import ShapesPanel from './panels/ShapesPanel'
import BackgroundPanel from './panels/BackgroundPanel'
import HistoryPanel from './panels/HistoryPanel'

const tools: { id: PanelType; icon: typeof ImageIcon; label: string; desc: string }[] = [
  { id: 'photo', icon: ImageIcon, label: 'Photo', desc: 'Upload & drag photos' },
  { id: 'templates', icon: Grid3x3, label: 'Templates', desc: 'Pre-made layouts' },
  { id: 'draw', icon: Pencil, label: 'Draw', desc: 'Freehand drawing' },
  { id: 'text', icon: Type, label: 'Text', desc: 'Add text blocks' },
  { id: 'emoji', icon: Smile, label: 'Emoji', desc: 'Emoji decorations' },
  { id: 'stickers', icon: Sticker, label: 'Stickers', desc: 'Sticker pack' },
  { id: 'envelope', icon: Mail, label: 'Envelope', desc: 'Sealed notes' },
  { id: 'shapes', icon: Shapes, label: 'Shapes', desc: 'Geometric shapes' },
  { id: 'background', icon: Palette, label: 'Background', desc: 'Page colors & patterns' },
]

const panelComponents: Record<string, React.FC> = {
  photo: PhotoPanel,
  templates: TemplatesPanel,
  draw: DrawPanel,
  text: TextPanel,
  emoji: EmojiPanel,
  stickers: StickersPanel,
  envelope: EnvelopePanel,
  shapes: ShapesPanel,
  background: BackgroundPanel,
  history: HistoryPanel,
}

const PANEL_WIDTH = 360

export default function RightToolbar() {
  const [open, setOpen] = useState(false)
  const [activePanel, setActivePanel] = useState<PanelType>(null)
  const { drawSettings, setDrawSettings, setRightPanelWidth } = useJournal()
  const { theme } = useTheme()
  const isDark = theme === 'night'
  const PanelComponent = activePanel ? panelComponents[activePanel] : null
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setRightPanelWidth(open ? PANEL_WIDTH : 0)
  }, [open, setRightPanelWidth])

  const manager = useDragDropManager()

  useEffect(() => {
    const monitor = manager.getMonitor()
    const unsubscribe = monitor.subscribeToStateChange(() => {
      if (monitor.isDragging() && monitor.getItemType() === 'TOOL_ITEM') {
        setOpen(false)
      }
    })
    return unsubscribe
  }, [manager])

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActivePanel(null)
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleToolClick = (panelId: PanelType) => {
    if (panelId !== 'draw' && drawSettings.active) {
      setDrawSettings({ ...drawSettings, active: false })
    }
    if (panelId === 'draw') {
      setDrawSettings({ ...drawSettings, active: true })
    }
    setActivePanel(prev => (prev === panelId ? null : panelId))
  }

  return (
    <div ref={containerRef} className={`fixed right-0 top-0 h-full z-30 ${open ? '' : 'pointer-events-none'}`}>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden pointer-events-auto"
          onClick={() => { setActivePanel(null); setOpen(false) }}
        />
      )}

      <motion.div
        animate={{ x: open ? 0 : PANEL_WIDTH + 8 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className={`relative h-full shadow-lg flex z-30 ${open ? 'pointer-events-auto' : ''}`}
        style={{
          width: PANEL_WIDTH + 8,
        }}
      >
        {/* Tool buttons */}
        <div
          className={`flex flex-col items-center pt-4 pb-2 gap-1 border-l ${isDark ? 'bg-[#1e1e2e] border-[#313244]' : 'bg-[#f0e6d3] border-[#e8dcc8]'}`}
          style={{
            width: 48,
            backgroundImage: isDark ? 'none' : `
              repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(139,115,85,0.02) 2px, rgba(139,115,85,0.02) 3px),
              repeating-linear-gradient(90deg, transparent, transparent 30px, rgba(139,115,85,0.012) 30px, rgba(139,115,85,0.012) 31px)
            `,
          }}
        >
          <div className={`w-7 h-[1px] mb-2 ${isDark ? 'bg-[#45475a]' : 'bg-[#e8dcc8]'}`} />
          {tools.map(tool => {
            const Icon = tool.icon
            const isActive = activePanel === tool.id
            return (
              <button
                key={tool.id}
                onClick={() => handleToolClick(tool.id)}
                className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer shrink-0',
                  isActive
                    ? 'bg-[#d97757] text-white shadow-md shadow-[#d97757]/25'
                    : isDark
                      ? 'text-[#a6adc8] hover:text-[#d97757] hover:bg-[#d97757]/15'
                      : 'text-[#8b7355] hover:text-[#d97757] hover:bg-[#d97757]/8',
                )}
                title={tool.label}
              >
                <Icon className={cn('w-4 h-4 transition-transform', isActive && 'scale-110')} />
              </button>
            )
          })}
          <div className={`w-7 h-[1px] my-2 ${isDark ? 'bg-[#45475a]' : 'bg-[#e8dcc8]'}`} />
          <button
            onClick={() => handleToolClick('history')}
            className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer shrink-0',
              activePanel === 'history'
                ? 'bg-[#d97757] text-white shadow-md shadow-[#d97757]/25'
                : isDark
                  ? 'text-[#a6adc8] hover:text-[#d97757] hover:bg-[#d97757]/15'
                  : 'text-[#8b7355] hover:text-[#d97757] hover:bg-[#d97757]/8',
            )}
            title="History"
          >
            <History className={cn('w-4 h-4 transition-transform', activePanel === 'history' && 'scale-110')} />
          </button>
        </div>

        {/* Panel content */}
        <div className={`flex-1 flex flex-col min-w-0 border-l ${isDark ? 'border-[#313244]' : 'border-[#e8dcc8]'}`} style={{
          background: isDark ? '#1e1e2e' : '#f0e6d3',
        }}>
          {PanelComponent ? (
            <>
              <div className={`sticky top-0 z-10 border-b px-5 py-4 ${isDark ? 'bg-[#1e1e2e] border-[#313244]' : 'bg-[#f0e6d3] border-[#e8dcc8]'}`}>
                <h2 className={`font-display text-xl ${isDark ? 'text-[#cdd6f4]' : 'text-[#2c3e50]'}`}>
                  {tools.find(t => t.id === activePanel)?.label}
                </h2>
                <p className={`text-xs font-handwriting mt-0.5 ${isDark ? 'text-[#6c7086]' : 'text-[#a89a8a]'}`}>
                  {tools.find(t => t.id === activePanel)?.desc}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto px-5 pb-8 pt-4">
                <PanelComponent />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className={`text-sm font-handwriting ${isDark ? 'text-[#6c7086]' : 'text-[#a89a8a]'}`}>
                Select a tool
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Toggle button */}
      <button
        type="button"
        onClick={() => {
          if (open) {
            setActivePanel(null)
            setOpen(false)
          } else {
            setOpen(true)
            if (!activePanel) setActivePanel('photo')
          }
        }}
        className="absolute top-1/2 -translate-y-1/2 h-14 w-5 flex items-center justify-center rounded-l-md shadow-sm z-30 transition-colors cursor-pointer pointer-events-auto"
        style={{
          right: open ? PANEL_WIDTH + 8 : 0,
          transition: 'right 0.25s ease-in-out',
          background: isDark ? '#313244' : 'linear-gradient(180deg, #ede2cb, #f0e6d3)',
          border: isDark ? '2px solid #45475a' : '2px solid #e8dcc8',
          borderRight: 'none',
          color: isDark ? '#cdd6f4' : '#8b7355',
        }}
        title={open ? 'Close tools' : 'Open tools'}
      >
        <ChevronLeft className="w-3 h-3" />
      </button>
    </div>
  )
}
