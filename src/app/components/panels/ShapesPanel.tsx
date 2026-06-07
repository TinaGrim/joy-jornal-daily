import { useState } from 'react'
import { useToolDrag } from '@/hooks/useToolDrag'
import { cn } from '@/lib/utils'
import { Plane, Compass, Camera, Luggage, Square, Circle, Triangle, Hexagon, Shapes } from 'lucide-react'

type ShapeType = 'rectangle' | 'circle' | 'triangle' | 'hexagon'

const shapes: { id: ShapeType; icon: typeof Square; label: string; clipPath?: string; round?: boolean }[] = [
  { id: 'rectangle', icon: Square, label: 'Rect', round: true },
  { id: 'circle', icon: Circle, label: 'Circle', round: true },
  { id: 'triangle', icon: Triangle, label: 'Triangle', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' },
  { id: 'hexagon', icon: Hexagon, label: 'Hexagon', clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' },
]

const travelIcons: { icon: typeof Plane; label: string; name: string }[] = [
  { icon: Plane, label: 'Plane', name: 'Plane' },
  { icon: Compass, label: 'Compass', name: 'Compass' },
  { icon: Camera, label: 'Camera', name: 'Camera' },
  { icon: Luggage, label: 'Suitcase', name: 'Suitcase' },
]

const PRESET_COLORS = ['#2c3e50', '#d97757', '#7ba083', '#e8a87c', '#a8c5ab', '#8b7355']

function ShapePreview({ id, clipPath, round, fill }: { id: ShapeType; clipPath?: string; round?: boolean; fill: string }) {
  const previewStyle: React.CSSProperties = {
    background: fill,
    width: '100%',
    height: '100%',
    borderRadius: round ? (id === 'circle' ? '50%' : '8px') : '0',
    clipPath: clipPath,
    border: '1.5px solid rgba(0,0,0,0.08)',
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
    transition: 'transform 0.15s',
  }
  return <div style={previewStyle} />
}

function DraggableShape({ shape, fill }: { shape: ShapeType; fill: string }) {
  const { isDragging, drag } = useToolDrag({
    elementType: 'shape',
    data: { shape, fill, opacity: 0.85 },
    width: 120,
    height: 120,
  })

  const s = shapes.find(s => s.id === shape)!

  return (
    <div
      ref={drag}
      className={cn(
        'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 border-border-light bg-white cursor-grab active:cursor-grabbing transition-all hover:border-terracotta hover:shadow-lg hover:-translate-y-1',
        isDragging && 'opacity-50',
      )}
    >
      <div className="w-10 h-10">
        <ShapePreview id={shape} clipPath={s.clipPath} round={s.round} fill={fill} />
      </div>
      <span className="text-[11px] text-text-muted font-handwriting capitalize">{s.label}</span>
    </div>
  )
}

function DraggableIcon({ icon: Icon, label }: { icon: typeof Plane; label: string; name: string }) {
  const { isDragging, drag } = useToolDrag({
    elementType: 'shape',
    data: { shape: 'icon', icon: label, fill: '#2c3e50', opacity: 1 },
    width: 80,
    height: 80,
  })

  return (
    <button
      ref={drag}
      className={cn(
        'flex flex-col items-center gap-1 p-3 rounded-xl border-2 border-border-light bg-white cursor-grab active:cursor-grabbing transition-all hover:border-terracotta hover:shadow-lg hover:-translate-y-1',
        isDragging && 'opacity-50',
      )}
    >
      <Icon className="w-8 h-8 text-ink-navy" />
      <span className="text-[10px] text-text-muted font-handwriting">{label}</span>
    </button>
  )
}

export default function ShapesPanel() {
  const [fillColor, setFillColor] = useState('#d97757')
  const [opacity, setOpacity] = useState(0.85)

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-cream border-2 border-border-light space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-4 h-4 rounded-full border-2 border-warm-brown" style={{ backgroundColor: fillColor }} />
            <p className="text-sm text-warm-brown font-handwriting">Fill Color</p>
          </div>
          <div className="flex gap-3">
            {PRESET_COLORS.map(color => (
              <button
                key={color}
                onClick={() => setFillColor(color)}
                className={cn(
                  'w-9 h-9 rounded-full border-2 transition-all cursor-pointer relative',
                  fillColor === color ? 'border-ink-navy scale-110 shadow-md' : 'border-border-light hover:scale-105',
                )}
                style={{ backgroundColor: color }}
              >
                {fillColor === color && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className={cn('w-2.5 h-2.5 rounded-full', color === '#2c3e50' ? 'bg-white' : 'bg-white/80')} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-warm-brown font-handwriting">Opacity</p>
            <span className="text-xs bg-white border border-border-light px-2.5 py-1 rounded-md text-ink-navy font-handwriting shadow-sm">{Math.round(opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min={30}
            max={100}
            value={Math.round(opacity * 100)}
            onChange={e => setOpacity(Number(e.target.value) / 100)}
            className="w-full accent-terracotta"
          />
          <div className="flex justify-between text-[10px] text-text-muted font-handwriting mt-0.5">
            <span>Sheer</span>
            <span>Solid</span>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Shapes className="w-4 h-4 text-warm-brown" />
          <p className="text-sm text-warm-brown font-handwriting">Geometric Shapes</p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {shapes.map(s => (
            <DraggableShape key={s.id} shape={s.id} fill={fillColor} />
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Plane className="w-4 h-4 text-warm-brown" />
          <p className="text-sm text-warm-brown font-handwriting">Travel Icons</p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {travelIcons.map(ti => (
            <DraggableIcon key={ti.name} icon={ti.icon} label={ti.label} name={ti.name} />
          ))}
        </div>
      </div>
    </div>
  )
}
