import { useState, useEffect, useRef } from 'react'
import { useDragDropManager } from 'react-dnd'
import { motion, AnimatePresence } from 'motion/react'
import {
  ImageIcon, Grid3x3, Pencil, Type, Smile, Sticker, Mail, Shapes, Palette, History,
} from 'lucide-react'
import type { PanelType } from '@/types/journal'
import { useJournal } from '../contexts/JournalContext'
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

export default function RightToolbar() {
  const [activePanel, setActivePanel] = useState<PanelType>(null)
  const { drawSettings, setDrawSettings, setRightPanelWidth } = useJournal()
  const PanelComponent = activePanel ? panelComponents[activePanel] : null
  const toolbarRef = useRef<HTMLDivElement>(null)

  const PANEL_WIDTH = 320

  useEffect(() => {
    setRightPanelWidth(activePanel ? PANEL_WIDTH : 0)
  }, [activePanel, setRightPanelWidth])

  const manager = useDragDropManager()

  useEffect(() => {
    const monitor = manager.getMonitor()
    const unsubscribe = monitor.subscribeToStateChange(() => {
      if (monitor.isDragging() && monitor.getItemType() === 'TOOL_ITEM') {
        setActivePanel(null)
      }
    })
    return unsubscribe
  }, [manager])

  useEffect(() => {
    if (!activePanel) return
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setActivePanel(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [activePanel])

  const handlePanelToggle = (panelId: PanelType) => {
    if (panelId !== 'draw' && drawSettings.active) {
      setDrawSettings({ ...drawSettings, active: false })
    }
    if (panelId === 'draw') {
      setDrawSettings({ ...drawSettings, active: true })
    }
    setActivePanel(prev => (prev === panelId ? null : panelId))
  }

  return (
    <div ref={toolbarRef} className="fixed right-0 top-0 h-full z-30 flex">
      <div className="h-full w-14 bg-paper border-l-2 border-border-light flex flex-col items-center pt-4 gap-1.5 shadow-lg">
        <div className="w-8 h-[1px] bg-border-light mb-2" />
        {tools.map(tool => {
          const Icon = tool.icon
          const isActive = activePanel === tool.id
          return (
            <button
              key={tool.id}
              onClick={() => handlePanelToggle(tool.id)}
              className={cn(
                'relative w-10 h-10 rounded-xl flex items-center justify-center transition-all group cursor-pointer',
                isActive
                  ? 'bg-terracotta text-white shadow-md shadow-terracotta/25 ring-2 ring-terracotta/20'
                  : 'text-warm-brown hover:text-terracotta hover:bg-terracotta/8',
              )}
              title={tool.label}
            >
              <Icon className={cn('w-[18px] h-[18px] transition-transform', isActive && 'scale-110')} />
              <div className="absolute right-full mr-3 px-2.5 py-1.5 bg-ink-navy text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none shadow-lg translate-x-1 group-hover:translate-x-0">
                <p className="font-handwriting text-sm leading-tight">{tool.label}</p>
                <p className="text-[10px] text-white/60 font-handwriting mt-0.5">{tool.desc}</p>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 border-4 border-transparent border-l-ink-navy" />
              </div>
            </button>
          )
        })}
        <div className="w-8 h-[1px] bg-border-light my-2" />
        <div className="w-8 h-[1px] bg-border-light mt-auto mb-4" />
        <button
          onClick={() => handlePanelToggle('history')}
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center transition-all group cursor-pointer',
            activePanel === 'history'
              ? 'bg-terracotta text-white shadow-md shadow-terracotta/25 ring-2 ring-terracotta/20'
              : 'text-warm-brown hover:text-terracotta hover:bg-terracotta/8',
          )}
          title="History"
        >
          <History className={cn('w-[18px] h-[18px] transition-transform', activePanel === 'history' && 'scale-110')} />
          <div className="absolute right-full mr-3 px-2.5 py-1.5 bg-ink-navy text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none shadow-lg translate-x-1 group-hover:translate-x-0">
            <p className="font-handwriting text-sm leading-tight">History</p>
            <p className="text-[10px] text-white/60 font-handwriting mt-0.5">Save & restore checkpoints</p>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 border-4 border-transparent border-l-ink-navy" />
          </div>
        </button>
      </div>

      <AnimatePresence>
        {activePanel && PanelComponent && (
          <motion.div
            key={activePanel}
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="bg-paper border-l-2 border-border-light overflow-hidden shadow-xl h-full"
          >
            <div className="w-80 h-full flex flex-col">
              <div className="sticky top-0 z-10 bg-paper border-b border-border-light px-6 py-4">
                <h2 className="font-display text-xl text-ink-navy">
                  {tools.find(t => t.id === activePanel)?.label}
                </h2>
                <p className="text-xs text-text-muted font-handwriting mt-0.5">
                  {tools.find(t => t.id === activePanel)?.desc}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto px-6 pb-8 pt-5">
                <PanelComponent />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
