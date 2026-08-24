import { useState, useMemo } from 'react'
import { useToolDrag } from '@/hooks/useToolDrag'
import { cn } from '@/lib/utils'
import { useTheme } from '../../contexts/ThemeContext'
import { Compass, Leaf, UtensilsCrossed, Heart, Sparkles } from 'lucide-react'

type CategoryId = 'travel' | 'nature' | 'food' | 'love'

interface Category {
  id: CategoryId
  label: string
  icon: typeof Compass
  stickers: { emoji: string; label: string }[]
}

const categories: Category[] = [
  {
    id: 'travel',
    label: 'Travel',
    icon: Compass,
    stickers: [
      { emoji: '✈️', label: 'Plane' },
      { emoji: '🚗', label: 'Car' },
      { emoji: '🚢', label: 'Ship' },
      { emoji: '🗺️', label: 'Map' },
      { emoji: '🎒', label: 'Bag' },
      { emoji: '📸', label: 'Camera' },
    ],
  },
  {
    id: 'nature',
    label: 'Nature',
    icon: Leaf,
    stickers: [
      { emoji: '🌴', label: 'Palm' },
      { emoji: '🌊', label: 'Wave' },
      { emoji: '🏔️', label: 'Mountain' },
      { emoji: '🌸', label: 'Flower' },
      { emoji: '🌅', label: 'Sunset' },
      { emoji: '🦋', label: 'Butterfly' },
    ],
  },
  {
    id: 'food',
    label: 'Food',
    icon: UtensilsCrossed,
    stickers: [
      { emoji: '🍜', label: 'Noodles' },
      { emoji: '🍕', label: 'Pizza' },
      { emoji: '🥂', label: 'Toast' },
      { emoji: '☕', label: 'Coffee' },
      { emoji: '🍷', label: 'Wine' },
      { emoji: '🍁', label: 'Maple' },
    ],
  },
  {
    id: 'love',
    label: 'Love',
    icon: Heart,
    stickers: [
      { emoji: '❤️', label: 'Heart' },
      { emoji: '💑', label: 'Couple' },
      { emoji: '🌟', label: 'Star' },
      { emoji: '✨', label: 'Sparkle' },
      { emoji: '🎉', label: 'Party' },
      { emoji: '🔥', label: 'Fire' },
    ],
  },
]

function DraggableSticker({ emoji, label, isDark }: { emoji: string; label: string; isDark: boolean }) {
  const data = useMemo(() => ({ src: emoji, label, category: '' }), [emoji, label])
  const { isDragging, drag, insert } = useToolDrag({
    elementType: 'sticker',
    data,
    width: 100,
    height: 100,
  })

  return (
    <button
      ref={drag}
      onClick={insert}
      className={cn(
        'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 cursor-grab active:cursor-grabbing transition-all hover:border-terracotta hover:shadow-md hover:-translate-y-0.5',
        isDark ? 'border-[#45475a] bg-[#313244]' : 'border-border-light bg-white',
        isDragging && 'opacity-50',
      )}
    >
      <span className="text-3xl">{emoji}</span>
      <span className={`text-[12px] font-handwriting ${isDark ? 'text-[#6c7086]' : 'text-text-muted'}`}>{label}</span>
    </button>
  )
}

export default function StickersPanel() {
  const [activeCategory, setActiveCategory] = useState<CategoryId>('travel')
  const { theme } = useTheme()
  const isDark = theme === 'night'

  const active = categories.find(c => c.id === activeCategory)!

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className={`w-4 h-4 ${isDark ? 'text-[#a6adc8]' : 'text-warm-brown'}`} />
        <p className={`text-sm font-handwriting ${isDark ? 'text-[#a6adc8]' : 'text-warm-brown'}`}>Decorative stickers</p>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {categories.map(cat => {
          const Icon = cat.icon
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                'py-2.5 px-1 rounded-xl border-2 flex flex-col items-center gap-1 transition-all cursor-pointer',
                activeCategory === cat.id
                  ? 'border-terracotta bg-terracotta text-white shadow-sm'
                  : isDark
                    ? 'border-[#45475a] bg-[#313244] text-[#a6adc8] hover:border-terracotta/50 hover:bg-terracotta/10'
                    : 'border-border-light bg-white text-warm-brown hover:border-terracotta/50 hover:bg-terracotta/5',
              )}
            >
              <Icon className={cn('w-4 h-4', activeCategory === cat.id && 'scale-110')} />
              <span className="text-[12px] font-handwriting leading-tight">{cat.label}</span>
            </button>
          )
        })}
      </div>

      <div className={`p-3 rounded-xl border-2 ${isDark ? 'bg-[#181825] border-[#45475a]' : 'bg-cream border-border-light'}`}>
        <p className={`text-xs font-handwriting mb-2 ${isDark ? 'text-[#a6adc8]' : 'text-warm-brown'}`}>{active.label} stickers</p>
        <div className="grid grid-cols-3 gap-2">
          {active.stickers.map(s => (
            <DraggableSticker key={s.label} emoji={s.emoji} label={s.label} isDark={isDark} />
          ))}
        </div>
      </div>
    </div>
  )
}
