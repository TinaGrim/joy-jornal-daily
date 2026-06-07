import { useState, useCallback, useEffect } from 'react'
import { useToolDrag } from '@/hooks/useToolDrag'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useJournal } from '@/app/contexts/JournalContext'
import type { CanvasElement } from '@/types/journal'
import { Map, LayoutGrid, Quote, ListChecks, Sparkles, Trash2 } from 'lucide-react'

interface Template {
  id: string
  name: string
  icon: typeof Map
  description: string
  color: string
}

const templates: Template[] = [
  { id: 'map-spread', name: 'Map Spread', icon: Map, description: 'Two-page map layout with photo spots', color: '#7ba083' },
  { id: 'photo-grid', name: 'Photo Grid', icon: LayoutGrid, description: 'Grid of polaroid-style photos', color: '#d97757' },
  { id: 'quote-page', name: 'Quote Page', icon: Quote, description: 'Featured quote with decorative border', color: '#8b7355' },
  { id: 'itinerary', name: 'Itinerary', icon: ListChecks, description: 'Day-by-day travel schedule', color: '#2c3e50' },
]

interface TemplateElement {
  type: 'text' | 'shape' | 'image'
  x: number; y: number; width: number; height: number
  data: Record<string, unknown>
}

const templateLayouts: Record<string, TemplateElement[]> = {
  'map-spread': [
    { type: 'shape', x: 30, y: 30, width: 580, height: 800, data: { shape: 'rectangle', fill: '#7ba083', opacity: 0.08 } },
    { type: 'text', x: 120, y: 60, width: 400, height: 60, data: { text: 'Our Route', font: 'Playfair Display', fontSize: 36, color: '#2c3e50' } },
    { type: 'shape', x: 60, y: 160, width: 250, height: 300, data: { shape: 'rectangle', fill: '#e5d5b8', opacity: 0.6 } },
    { type: 'shape', x: 330, y: 160, width: 250, height: 300, data: { shape: 'rectangle', fill: '#e5d5b8', opacity: 0.6 } },
    { type: 'text', x: 80, y: 500, width: 480, height: 40, data: { text: 'Add your photos here', font: 'Caveat', fontSize: 22, color: '#8b7355' } },
  ],
  'photo-grid': [
    { type: 'shape', x: 20, y: 20, width: 290, height: 390, data: { shape: 'rectangle', fill: '#e5d5b8', opacity: 0.5 } },
    { type: 'shape', x: 330, y: 20, width: 290, height: 390, data: { shape: 'rectangle', fill: '#e5d5b8', opacity: 0.5 } },
    { type: 'shape', x: 20, y: 430, width: 290, height: 390, data: { shape: 'rectangle', fill: '#e5d5b8', opacity: 0.5 } },
    { type: 'shape', x: 330, y: 430, width: 290, height: 390, data: { shape: 'rectangle', fill: '#e5d5b8', opacity: 0.5 } },
    { type: 'text', x: 100, y: 170, width: 150, height: 30, data: { text: '📸 Photo 1', font: 'Caveat', fontSize: 20, color: '#8b7355' } },
    { type: 'text', x: 380, y: 170, width: 150, height: 30, data: { text: '📸 Photo 2', font: 'Caveat', fontSize: 20, color: '#8b7355' } },
    { type: 'text', x: 100, y: 580, width: 150, height: 30, data: { text: '📸 Photo 3', font: 'Caveat', fontSize: 20, color: '#8b7355' } },
    { type: 'text', x: 380, y: 580, width: 150, height: 30, data: { text: '📸 Photo 4', font: 'Caveat', fontSize: 20, color: '#8b7355' } },
  ],
  'quote-page': [
    { type: 'shape', x: 40, y: 40, width: 560, height: 780, data: { shape: 'rectangle', fill: '#e5d5b8', opacity: 0.4 } },
    { type: 'text', x: 80, y: 80, width: 80, height: 80, data: { text: '\u201C', font: 'Playfair Display', fontSize: 80, color: '#d97757' } },
    { type: 'text', x: 100, y: 220, width: 440, height: 200, data: { text: 'Travel brings power and love back into your life.', font: 'Playfair Display', fontSize: 28, color: '#2c3e50' } },
    { type: 'text', x: 100, y: 440, width: 440, height: 40, data: { text: '\u2014 Rumi', font: 'Caveat', fontSize: 22, color: '#8b7355' } },
    { type: 'shape', x: 80, y: 520, width: 60, height: 2, data: { shape: 'rectangle', fill: '#d97757', opacity: 0.6 } },
  ],
  'itinerary': [
    { type: 'text', x: 40, y: 40, width: 560, height: 60, data: { text: 'Itinerary', font: 'Playfair Display', fontSize: 36, color: '#2c3e50' } },
    { type: 'shape', x: 40, y: 110, width: 20, height: 20, data: { shape: 'circle', fill: '#d97757', opacity: 1 } },
    { type: 'text', x: 80, y: 105, width: 500, height: 30, data: { text: 'Day 1 \u2014 Arrival & Exploration', font: 'Caveat', fontSize: 22, color: '#2c3e50' } },
    { type: 'text', x: 80, y: 140, width: 500, height: 50, data: { text: 'Morning flight, afternoon city walk, dinner at local spot', font: 'Caveat', fontSize: 18, color: '#8b7355' } },
    { type: 'shape', x: 40, y: 220, width: 20, height: 20, data: { shape: 'circle', fill: '#7ba083', opacity: 1 } },
    { type: 'text', x: 80, y: 215, width: 500, height: 30, data: { text: 'Day 2 \u2014 Beach Day', font: 'Caveat', fontSize: 22, color: '#2c3e50' } },
    { type: 'text', x: 80, y: 250, width: 500, height: 50, data: { text: 'Snorkeling, sunset hike, bonfire dinner', font: 'Caveat', fontSize: 18, color: '#8b7355' } },
    { type: 'shape', x: 40, y: 330, width: 20, height: 20, data: { shape: 'circle', fill: '#e8a87c', opacity: 1 } },
    { type: 'text', x: 80, y: 325, width: 500, height: 30, data: { text: 'Day 3 \u2014 Mountain Trek', font: 'Caveat', fontSize: 22, color: '#2c3e50' } },
    { type: 'text', x: 80, y: 360, width: 500, height: 50, data: { text: 'Early start, waterfall visit, picnic lunch', font: 'Caveat', fontSize: 18, color: '#8b7355' } },
  ],
}

const templateBackup: Record<string, CanvasElement[]> = {}

function TemplateCard({ template }: { template: Template }) {
  const Icon = template.icon
  const { replacePageElements, pages, focusPageIndex } = useJournal()
  const key = `${template.id}-${focusPageIndex}`
  const [applied, setApplied] = useState(!!templateBackup[key])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync applied state on page switch
    setApplied(!!templateBackup[key])
  }, [key])

  const { isDragging, drag } = useToolDrag({
    elementType: 'template',
    data: { templateId: template.id },
    width: 400,
    height: 300,
  })

  const handleApply = useCallback(() => {
    const layout = templateLayouts[template.id]
    if (!layout) return
    templateBackup[key] = pages[focusPageIndex].elements
    setApplied(true)
    const elements: CanvasElement[] = layout.map((el, i) => ({
      ...el,
      data: { ...el.data },
      id: `template-${template.id}-${Date.now()}-${i}`,
      rotation: 0,
      zIndex: Date.now() + i,
    }))
    replacePageElements(elements)
    toast.success(`"${template.name}" template applied!`)
  }, [template.id, template.name, replacePageElements, pages, focusPageIndex, key])

  const handleUnapply = useCallback(() => {
    const snapshot = templateBackup[key]
    if (snapshot) {
      replacePageElements(snapshot)
      delete templateBackup[key]
      setApplied(false)
      toast.success(`"${template.name}" template removed!`)
    }
  }, [key, replacePageElements, template.name])

  return (
    <div
      ref={drag}
      className={cn(
        'group bg-white rounded-xl border-2 border-border-light overflow-hidden transition-all hover:shadow-lg hover:border-terracotta/40',
        isDragging && 'opacity-50',
      )}
    >
      <div
        className="h-28 flex items-center justify-center transition-colors relative"
        style={{ backgroundColor: `${template.color}15` }}
      >
        <Icon className="w-12 h-12" style={{ color: template.color }} />
        <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent" />
      </div>
      <div className="p-4 space-y-2.5">
        <h3 className="font-display text-sm text-ink-navy">{template.name}</h3>
        <p className="text-xs text-text-muted font-handwriting leading-relaxed">{template.description}</p>
        <button
          onClick={applied ? handleUnapply : handleApply}
          className={cn(
            'w-full py-2.5 rounded-xl text-sm font-handwriting transition-all cursor-pointer',
            applied
              ? 'bg-red-400 text-white hover:bg-red-500 shadow-sm'
              : 'bg-cream text-warm-brown hover:bg-terracotta hover:text-white border-2 border-border-light hover:border-terracotta hover:shadow-sm',
          )}
        >
          {applied ? 'Revert Template' : 'Apply to Page'}
        </button>
      </div>
    </div>
  )
}

export default function TemplatesPanel() {
  const { clearPage } = useJournal()
  const [clearConfirm, setClearConfirm] = useState(false)

  const handleClearPage = () => {
    if (!clearConfirm) {
      setClearConfirm(true)
      toast('Click again to confirm clearing all elements', {
        duration: 3000,
        position: 'bottom-center',
        style: { background: '#d97757', color: '#fff', border: 'none' },
      })
      setTimeout(() => setClearConfirm(false), 3000)
      return
    }
    clearPage()
    setClearConfirm(false)
    toast.success('Page cleared')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-warm-brown" />
        <p className="text-sm text-warm-brown font-handwriting">Choose a layout or drag to canvas</p>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {templates.map(t => (
          <TemplateCard key={t.id} template={t} />
        ))}
      </div>
      <div className="pt-4 border-t border-border-light">
        <button
          onClick={handleClearPage}
          className={cn(
            'w-full py-2.5 rounded-xl text-sm font-handwriting transition-all cursor-pointer flex items-center justify-center gap-2',
            clearConfirm
              ? 'bg-red-500 text-white shadow-sm'
              : 'bg-white text-red-400 hover:bg-red-50 border-2 border-red-200 hover:border-red-400',
          )}
        >
          <Trash2 className="w-4 h-4" />
          {clearConfirm ? 'Confirm Clear' : 'Clear Page'}
        </button>
      </div>
    </div>
  )
}
