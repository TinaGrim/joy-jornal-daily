import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useJournal } from '@/app/contexts/JournalContext'
import { Check, Grid3x3, CircleDashed, Square, Pipette, LayoutGrid, Palette } from 'lucide-react'
import type { PagePattern } from '@/types/journal'

type Tab = 'solid' | 'pattern'

const GRID_SIZES = [
  { value: 20, label: 'XS' },
  { value: 40, label: 'S' },
  { value: 60, label: 'M' },
  { value: 80, label: 'L' },
]

const solidColors = [
  { value: '#f0e6d3', label: 'Paper' },
  { value: '#ece0c8', label: 'Cream' },
  { value: '#e5d5b8', label: 'Warm' },
  { value: '#fce8d5', label: 'Peach' },
  { value: '#d9e8d4', label: 'Mint' },
  { value: '#d9d0e8', label: 'Lavender' },
  { value: '#f5d5d5', label: 'Rose' },
]

const patterns: { id: PagePattern; icon: typeof Grid3x3; label: string; desc: string }[] = [
  { id: 'grid', icon: Grid3x3, label: 'Grid', desc: 'Classic grid' },
  { id: 'dots', icon: CircleDashed, label: 'Dots', desc: 'Dot matrix' },
  { id: 'blank', icon: Square, label: 'Blank', desc: 'No pattern' },
]

export default function BackgroundPanel() {
  const {
    updatePageBackground, updateAllPagesBackground,
    updatePagePattern, updateAllPagesPattern,
    updateGridSize, updateAllPagesGridSize,
    pages, focusPageIndex,
  } = useJournal()
  const currentPage = pages[focusPageIndex]
  const currentBg = currentPage?.background ?? '#f0e6d3'
  const currentPattern = currentPage?.pattern ?? 'blank'
  const currentGridSize = currentPage?.gridSize ?? 40

  const [activeTab, setActiveTab] = useState<Tab>('solid')
  const [customColor, setCustomColor] = useState(currentBg)
  const [applyToAll, setApplyToAll] = useState(false)

  const handleColorSelect = (color: string) => {
    setCustomColor(color)
    if (applyToAll) {
      updateAllPagesBackground(color)
      toast.success('Background applied to all pages')
    } else {
      updatePageBackground(color)
      toast.success('Background updated')
    }
  }

  const handleCustomColor = (color: string) => {
    setCustomColor(color)
    if (applyToAll) {
      updateAllPagesBackground(color)
    } else {
      updatePageBackground(color)
    }
  }

  const handlePatternSelect = (pattern: PagePattern) => {
    if (applyToAll) {
      updateAllPagesPattern(pattern)
    } else {
      updatePagePattern(pattern)
    }
    if (pattern === 'blank') {
      toast.success(applyToAll ? 'Pattern cleared on all pages' : 'Pattern cleared')
    } else {
      toast.success(applyToAll ? `${pattern} applied to all pages` : `${pattern} pattern applied`)
    }
  }

  const handleGridSizeChange = (size: number) => {
    if (applyToAll) {
      updateAllPagesGridSize(size)
      toast.success('Grid size applied to all pages')
    } else {
      updateGridSize(size)
    }
  }

  return (
    <div className="space-y-5">
      {/* Apply scope toggle */}
      <div className="flex items-center gap-2 p-2 rounded-xl bg-cream border-2 border-border-light">
        <LayoutGrid className="w-4 h-4 text-warm-brown" />
        <button
          onClick={() => setApplyToAll(false)}
          className={cn(
            'flex-1 py-1.5 rounded-lg text-xs font-handwriting transition-all cursor-pointer',
            !applyToAll ? 'bg-white text-ink-navy shadow-sm border border-border-light' : 'text-warm-brown hover:text-ink-navy',
          )}
        >
          This page
        </button>
        <button
          onClick={() => setApplyToAll(true)}
          className={cn(
            'flex-1 py-1.5 rounded-lg text-xs font-handwriting transition-all cursor-pointer',
            applyToAll ? 'bg-white text-ink-navy shadow-sm border border-border-light' : 'text-warm-brown hover:text-ink-navy',
          )}
        >
          All pages
        </button>
      </div>

      {/* Solid / Pattern tabs */}
      <div className="flex gap-2 bg-cream rounded-xl p-1 border-2 border-border-light">
        {(['solid', 'pattern'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-handwriting transition-all capitalize cursor-pointer',
              activeTab === tab
                ? 'bg-white text-ink-navy shadow-sm border border-border-light'
                : 'text-warm-brown hover:text-ink-navy',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'solid' ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-warm-brown" />
            <p className="text-sm text-warm-brown font-handwriting">Solid Colors</p>
          </div>

          {/* Custom color picker */}
          <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-border-light bg-white hover:shadow-sm transition-shadow">
            <div className="relative">
              <input
                type="color"
                value={customColor}
                onChange={e => handleCustomColor(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div
                className="w-10 h-10 rounded-xl border-2 border-border-light shadow-sm"
                style={{ background: customColor }}
              />
            </div>
            <Pipette className="w-4 h-4 text-warm-brown" />
            <span className="text-xs font-handwriting text-warm-brown flex-1">Pick custom color</span>
            <span className="text-[10px] font-mono text-text-muted bg-cream px-2 py-0.5 rounded">{customColor}</span>
          </div>

          {/* Preset swatches */}
          <div className="grid grid-cols-7 gap-2">
            {solidColors.map(c => (
              <button
                key={c.value}
                onClick={() => handleColorSelect(c.value)}
                className={cn(
                  'aspect-square rounded-xl border-2 transition-all cursor-pointer relative group',
                  currentBg === c.value && currentPattern === 'blank'
                    ? 'border-ink-navy scale-105 shadow-md'
                    : 'border-border-light hover:scale-105 hover:shadow-sm',
                )}
                style={{ backgroundColor: c.value }}
                title={c.label}
              >
                {currentBg === c.value && currentPattern === 'blank' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Check className={c.value === '#2c3e50' ? 'text-white w-4 h-4' : 'text-ink-navy w-4 h-4'} />
                  </div>
                )}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {solidColors.map(c => (
              <span key={c.value} className="text-[9px] text-text-muted font-handwriting flex-1 text-center truncate">
                {c.label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Grid3x3 className="w-4 h-4 text-warm-brown" />
            <p className="text-sm text-warm-brown font-handwriting">Pattern Overlay</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {patterns.map(p => {
              const Icon = p.icon
              return (
                <button
                  key={p.id}
                  onClick={() => handlePatternSelect(p.id)}
                  className={cn(
                    'aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer',
                    currentPattern === p.id
                      ? 'border-terracotta bg-terracotta/10 shadow-sm shadow-terracotta/10'
                      : 'border-border-light bg-white hover:border-terracotta/40 hover:shadow-sm',
                  )}
                >
                  <Icon className={cn('w-8 h-8', currentPattern === p.id ? 'text-terracotta' : 'text-warm-brown')} />
                  <span className={cn('text-xs font-handwriting', currentPattern === p.id ? 'text-terracotta' : 'text-text-muted')}>
                    {p.label}
                  </span>
                  <span className={cn('text-[9px] font-handwriting', currentPattern === p.id ? 'text-terracotta/60' : 'text-text-muted/60')}>
                    {p.desc}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Grid size selector — only when grid or dots is active */}
          {currentPattern !== 'blank' && (
            <div className="p-4 rounded-xl bg-cream border-2 border-border-light">
              <p className="text-sm text-warm-brown mb-3 font-handwriting">Grid Size</p>
              <div className="grid grid-cols-4 gap-2">
                {GRID_SIZES.map(s => (
                  <button
                    key={s.value}
                    onClick={() => handleGridSizeChange(s.value)}
                    className={cn(
                      'py-2 rounded-lg border-2 text-xs font-handwriting transition-all cursor-pointer',
                      currentGridSize === s.value
                        ? 'border-terracotta bg-terracotta/10 text-terracotta shadow-sm'
                        : 'border-border-light bg-white text-warm-brown hover:border-terracotta/40',
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[9px] text-text-muted font-handwriting mt-1.5">
                <span>Tight</span>
                <span>Loose</span>
              </div>
            </div>
          )}

          {/* Current color preview */}
          <div className="p-3 rounded-xl border-2 border-border-light bg-white">
            <p className="text-[11px] text-warm-brown font-handwriting mb-2">Current page</p>
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg border border-border-light shrink-0"
                style={{ background: currentBg }}
              />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-handwriting text-ink-navy block truncate">
                  {currentPattern === 'blank' ? 'No pattern' : `${currentPattern} overlay`}
                </span>
                <span className="text-[10px] font-handwriting text-text-muted block">
                  Grid: {currentGridSize}px
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
