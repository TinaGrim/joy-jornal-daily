import { useJournal } from '../../contexts/JournalContext'
import { useTheme } from '../../contexts/ThemeContext'
import type { BrushType } from '@/types/journal'
import { cn } from '@/lib/utils'
import { Pen, Highlighter, Eraser, Pipette, Paintbrush, CircleDot } from 'lucide-react'

const brushes: { id: BrushType; icon: typeof Pen; label: string; desc: string }[] = [
  { id: 'pen', icon: Pen, label: 'Pen', desc: 'Solid line' },
  { id: 'marker', icon: Pipette, label: 'Marker', desc: 'Bold stroke' },
  { id: 'highlighter', icon: Highlighter, label: 'Hi-Lighter', desc: 'Transparent' },
  { id: 'eraser', icon: Eraser, label: 'Eraser', desc: 'Remove ink' },
  { id: 'lasso', icon: CircleDot, label: 'Lasso', desc: 'Select elements' },
]

const PRESET_COLORS = ['#2c3e50', '#d97757', '#7ba083', '#e8a87c', '#a8c5ab', '#8b7355']

export default function DrawPanel() {
  const { drawSettings, setDrawSettings } = useJournal()
  const { theme } = useTheme()
  const isDark = theme === 'night'

  return (
    <div className="space-y-6">
      <div className={`p-4 rounded-xl border-2 ${isDark ? 'bg-[#181825] border-[#45475a]' : 'bg-cream border-border-light'}`}>
        <div className="flex items-center gap-2 mb-3">
          <Paintbrush className={`w-4 h-4 ${isDark ? 'text-[#a6adc8]' : 'text-warm-brown'}`} />
          <p className={`text-sm font-handwriting ${isDark ? 'text-[#a6adc8]' : 'text-warm-brown'}`}>Brush Type</p>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {brushes.map(b => {
            const Icon = b.icon
            return (
              <button
                key={b.id}
                onClick={() => setDrawSettings({ ...drawSettings, brush: b.id })}
                className={cn(
                  'py-3 px-1 rounded-xl border-2 flex flex-col items-center gap-1 transition-all cursor-pointer',
                  drawSettings.brush === b.id
                    ? 'border-terracotta bg-terracotta text-white shadow-sm shadow-terracotta/20'
                    : isDark
                      ? 'border-[#45475a] bg-[#313244] text-[#cdd6f4] hover:border-terracotta/50 hover:bg-terracotta/10'
                      : 'border-border-light bg-white text-warm-brown hover:border-terracotta/50 hover:bg-terracotta/5',
                )}
              >
                <Icon className={cn('w-5 h-5', drawSettings.brush === b.id && 'scale-110')} />
                <span className="text-[12px] font-handwriting leading-tight">{b.label}</span>
                <span className="text-[11px] opacity-60 leading-tight">{b.desc}</span>
              </button>
            )
          })}
        </div>
      </div>

      {drawSettings.brush !== 'lasso' && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-4 h-4 rounded-full border-2 border-warm-brown" style={{ backgroundColor: drawSettings.color }} />
            <p className={`text-sm font-handwriting ${isDark ? 'text-[#a6adc8]' : 'text-warm-brown'}`}>Ink Color</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {PRESET_COLORS.map(color => (
              <button
                key={color}
                onClick={() => setDrawSettings({ ...drawSettings, color })}
                className={cn(
                  'w-9 h-9 rounded-full border-2 transition-all cursor-pointer relative',
                  drawSettings.color === color ? 'border-ink-navy scale-110 shadow-md' : isDark ? 'border-[#45475a] hover:scale-105' : 'border-border-light hover:scale-105',
                )}
                style={{ backgroundColor: color }}
              >
                {drawSettings.color === color && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className={cn('w-2.5 h-2.5 rounded-full', color === '#2c3e50' ? 'bg-white' : 'bg-white/80')} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {drawSettings.brush !== 'lasso' && (
        <div className={`p-4 rounded-xl border-2 ${isDark ? 'bg-[#181825] border-[#45475a]' : 'bg-cream border-border-light'}`}>
          <div className="flex items-center justify-between mb-2">
            <p className={`text-sm font-handwriting ${isDark ? 'text-[#a6adc8]' : 'text-warm-brown'}`}>Stroke Width</p>
            <span className={`text-xs border px-2.5 py-1 rounded-md font-handwriting shadow-sm ${isDark ? 'bg-[#313244] border-[#45475a] text-[#cdd6f4]' : 'bg-white border-border-light text-ink-navy'}`}>{drawSettings.strokeWidth}px</span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            value={drawSettings.strokeWidth}
            onChange={e => setDrawSettings({ ...drawSettings, strokeWidth: Number(e.target.value) })}
            className="w-full accent-terracotta"
          />
          <div className="flex justify-between text-[12px] text-text-muted font-handwriting mt-0.5">
            <span>Fine</span>
            <span>Thick</span>
          </div>
        </div>
      )}

      {drawSettings.active && (
        <div className="p-3 rounded-xl bg-sage/10 border border-sage/20 text-center">
          <p className="text-sm text-sage font-handwriting">
            {drawSettings.brush === 'lasso' ? 'Lasso active \u2014 draw around elements to select' : 'Drawing active \u2014 click and drag on the page'}
          </p>
        </div>
      )}
    </div>
  )
}
