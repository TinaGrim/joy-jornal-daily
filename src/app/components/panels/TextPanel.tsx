import { useState } from 'react'
import { useToolDrag } from '@/hooks/useToolDrag'
import { Type, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const fonts = [
  { id: 'Caveat' as const, label: 'Caveat', className: 'font-handwriting', desc: 'Handwritten' },
  { id: 'Playfair Display' as const, label: 'Playfair', className: 'font-display', desc: 'Elegant serif' },
  { id: 'Kalam' as const, label: 'Kalam', className: 'font-kalam', desc: 'Bold hand' },
  { id: 'Dancing Script' as const, label: 'Dance', className: 'font-dance', desc: 'Script flow' },
]

const PRESET_COLORS = ['#2c3e50', '#d97757', '#7ba083', '#e8a87c', '#a8c5ab', '#8b7355']

export default function TextPanel() {
  const [selectedFont, setSelectedFont] = useState<'Caveat' | 'Playfair Display' | 'Kalam' | 'Dancing Script'>('Caveat')
  const [fontSize, setFontSize] = useState(24)
  const [selectedColor, setSelectedColor] = useState('#2c3e50')
  const [textInput, setTextInput] = useState('')

  const { isDragging, drag } = useToolDrag({
    elementType: 'text',
    data: {
      text: textInput || 'Your text',
      font: selectedFont,
      fontSize,
      color: selectedColor,
    },
    width: 200,
    height: 60,
  })

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-cream border-2 border-border-light">
        <div className="flex items-center gap-2 mb-3">
          <Type className="w-4 h-4 text-warm-brown" />
          <p className="text-sm text-warm-brown font-handwriting">Font Style</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {fonts.map(f => (
            <button
              key={f.id}
              onClick={() => setSelectedFont(f.id)}
              className={cn(
                'py-2.5 px-3 rounded-xl border-2 transition-all cursor-pointer text-left',
                selectedFont === f.id
                  ? 'border-terracotta bg-white shadow-sm shadow-terracotta/10'
                  : 'border-border-light bg-white text-warm-brown hover:border-terracotta/50',
              )}
            >
              <span className={cn('block text-sm leading-tight', f.className, selectedFont === f.id ? 'text-ink-navy' : 'text-warm-brown')}>{f.label}</span>
              <span className={cn('block text-[10px] font-handwriting leading-tight mt-0.5', selectedFont === f.id ? 'text-terracotta' : 'text-text-muted')}>{f.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-warm-brown font-handwriting">Font Size</p>
          <span className="text-xs bg-white border border-border-light px-2.5 py-1 rounded-md text-ink-navy font-handwriting shadow-sm">{fontSize}px</span>
        </div>
        <input
          type="range"
          min={12}
          max={120}
          value={fontSize}
          onChange={e => setFontSize(Number(e.target.value))}
          className="w-full accent-terracotta"
        />
        <div className="flex justify-between text-[10px] text-text-muted font-handwriting mt-0.5">
          <span>Small</span>
          <span>Large</span>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 rounded-full border-2 border-warm-brown" style={{ backgroundColor: selectedColor }} />
          <p className="text-sm text-warm-brown font-handwriting">Color</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {PRESET_COLORS.map(color => (
            <button
              key={color}
              onClick={() => setSelectedColor(color)}
              className={cn(
                'w-9 h-9 rounded-full border-2 transition-all cursor-pointer relative',
                selectedColor === color ? 'border-ink-navy scale-110 shadow-md' : 'border-border-light hover:scale-105',
              )}
              style={{ backgroundColor: color }}
            >
              {selectedColor === color && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={cn('w-2.5 h-2.5 rounded-full', color === '#2c3e50' ? 'bg-white' : 'bg-white/80')} />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-xl bg-cream border-2 border-border-light space-y-3">
        <div className="flex items-center gap-2">
          <p className="text-sm text-warm-brown font-handwriting">Your Text</p>
          <ArrowRight className="w-3.5 h-3.5 text-warm-brown/40" />
          <span className="text-[10px] text-text-muted font-handwriting">Drag to page</span>
        </div>
        <textarea
          value={textInput}
          onChange={e => setTextInput(e.target.value)}
          placeholder="Type your text here..."
          rows={3}
          className="w-full px-4 py-3 rounded-xl border-2 border-border-light bg-white text-ink-navy text-sm resize-none font-handwriting placeholder:text-text-muted/40 focus:outline-none focus:border-terracotta transition-colors"
        />
        <div
          ref={drag}
          className={cn(
            'w-full py-3 px-4 rounded-xl border-2 border-dashed border-border-dark bg-white flex items-center justify-center gap-2 cursor-grab active:cursor-grabbing transition-all hover:border-terracotta hover:bg-cream group',
            isDragging && 'opacity-50',
          )}
        >
          <Type className="w-5 h-5 text-warm-brown group-hover:text-terracotta transition-colors" />
          <span className="font-handwriting text-warm-brown group-hover:text-terracotta transition-colors">Add Text</span>
        </div>
      </div>

      <div
        className="p-4 rounded-xl border-2 border-border-light bg-white text-center shadow-sm"
        style={{ fontFamily: selectedFont, fontSize, color: selectedColor }}
      >
        {textInput || 'Your text'}
      </div>
    </div>
  )
}
