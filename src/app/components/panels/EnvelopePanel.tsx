import { useState, useMemo } from 'react'
import { useToolDrag } from '@/hooks/useToolDrag'
import { useTheme } from '../../contexts/ThemeContext'
import { Mail, PenLine } from 'lucide-react'
import { cn } from '@/lib/utils'

const colorOptions = [
  { value: '#d97757', label: 'Terracotta', class: 'bg-[#d97757]' },
  { value: '#7ba083', label: 'Sage', class: 'bg-[#7ba083]' },
  { value: '#ece0c8', label: 'Cream', class: 'bg-[#ece0c8]' },
  { value: '#2c3e50', label: 'Navy', class: 'bg-[#2c3e50]' },
]

export default function EnvelopePanel() {
  const [envelopeColor, setEnvelopeColor] = useState('#d97757')
  const [includeNote, setIncludeNote] = useState(false)
  const { theme } = useTheme()
  const isDark = theme === 'night'

  const data = useMemo(() => ({ opened: false, note: '', color: envelopeColor }), [envelopeColor])

  const { isDragging, drag } = useToolDrag({
    elementType: 'envelope',
    data,
    width: 160,
    height: 120,
  })

  const textColor = (() => {
    const c = envelopeColor.replace('#', '')
    const r = parseInt(c.substring(0, 2), 16)
    const g = parseInt(c.substring(2, 4), 16)
    const b = parseInt(c.substring(4, 6), 16)
    return r * 0.299 + g * 0.587 + b * 0.114 > 160 ? '#2c3e50' : '#ffffff'
  })()

  return (
    <div className="space-y-5">
      <div className={`p-4 rounded-xl border-2 ${isDark ? 'bg-[#181825] border-[#45475a]' : 'bg-cream border-border-light'}`}>
        <p className={`text-sm mb-3 font-handwriting ${isDark ? 'text-[#a6adc8]' : 'text-warm-brown'}`}>Preview</p>
        <div className={`h-36 rounded-xl border-2 overflow-hidden flex items-center justify-center ${isDark ? 'border-[#45475a] bg-gradient-to-br from-[#181825] to-[#1e1e2e]' : 'border-border-light bg-gradient-to-br from-cream to-white'}`}>
          <div
            className="w-32 h-22 rounded-lg flex flex-col items-center justify-center transition-colors relative"
            style={{
              background: envelopeColor,
              border: `2px solid ${envelopeColor}`,
              boxShadow: `0 4px 14px ${envelopeColor}66, 0 1px 3px rgba(0,0,0,0.1)`,
            }}
          >
            <Mail className="w-7 h-7 drop-shadow-sm" style={{ color: textColor }} />
            <span className="text-[11px] font-handwriting mt-0.5" style={{ color: textColor, opacity: 0.7 }}>sealed with love</span>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 rounded-full border-2 border-warm-brown" style={{ backgroundColor: envelopeColor }} />
          <p className={`text-sm font-handwriting ${isDark ? 'text-[#a6adc8]' : 'text-warm-brown'}`}>Envelope Color</p>
        </div>
        <div className="flex gap-3">
          {colorOptions.map(c => (
            <button
              key={c.value}
              onClick={() => setEnvelopeColor(c.value)}
                className={cn(
                  'w-10 h-10 rounded-full border-2 transition-all cursor-pointer relative',
                  envelopeColor === c.value ? 'border-ink-navy scale-110 shadow-md' : isDark ? 'border-[#45475a] hover:scale-105' : 'border-border-light hover:scale-105',
                )}
              style={{ backgroundColor: c.value }}
              title={c.label}
            >
              {envelopeColor === c.value && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={cn('w-2.5 h-2.5 rounded-full', c.value === '#2c3e50' ? 'bg-white' : 'bg-white/80')} />
                </div>
              )}
            </button>
          ))}
          <div className="flex-1 flex items-center pl-2">
            <span className={`text-[12px] font-handwriting ${isDark ? 'text-[#6c7086]' : 'text-text-muted'}`}>{colorOptions.find(c => c.value === envelopeColor)?.label}</span>
          </div>
        </div>
      </div>

      <div className={`p-4 rounded-xl border-2 space-y-3 ${isDark ? 'bg-[#181825] border-[#45475a]' : 'bg-cream border-border-light'}`}>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={includeNote}
            onChange={e => setIncludeNote(e.target.checked)}
            className="w-4 h-4 rounded border-border-light text-terracotta accent-terracotta"
          />
          <PenLine className={`w-4 h-4 ${isDark ? 'text-[#a6adc8]' : 'text-warm-brown'}`} />
          <span className={`text-sm font-handwriting ${isDark ? 'text-[#a6adc8]' : 'text-warm-brown'}`}>Include editable note</span>
        </label>

        <div
          ref={drag}
          className={cn(
            'py-4 px-4 rounded-xl border-2 border-dashed text-center cursor-grab active:cursor-grabbing transition-all group',
            isDark
              ? 'border-[#45475a] bg-[#313244] text-[#a6adc8] hover:border-terracotta hover:text-terracotta'
              : 'border-border-dark bg-white text-warm-brown hover:border-terracotta hover:bg-cream hover:text-terracotta',
            isDragging && 'opacity-50',
          )}
        >
          <Mail className="w-6 h-6 mx-auto mb-1.5 text-warm-brown group-hover:text-terracotta transition-colors" />
          <p className="font-handwriting text-warm-brown group-hover:text-terracotta transition-colors">Drag to page</p>
          <p className={`text-[12px] font-handwriting mt-0.5 ${isDark ? 'text-[#6c7086]' : 'text-text-muted'}`}>Click envelope to open</p>
        </div>
      </div>
    </div>
  )
}
