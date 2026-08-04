import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useToolDrag } from '@/hooks/useToolDrag'
import { useTheme } from '../../contexts/ThemeContext'
import { Search, Smile } from 'lucide-react'

const EMOJIS = [
  '🌍', '🌎', '🌏', '✈️', '🚗', '🚢', '🏖️', '🏔️', '🏛️', '🌅',
  '🌄', '🌊', '🌴', '🍜', '🍕', '🥂', '🍷', '☕', '🎒', '📸',
  '🗺️', '🎉', '❤️', '💑', '🌟', '✨', '🔥', '🎵', '🎶', '📝',
  '🦋', '🌸', '🌻', '🍁', '⛰️', '🏕️', '🛤️', '🚲', '🏄', '🤿',
  '🪂', '🧳', '🕶️', '📖', '🎧', '🎤', '🎂', '🍦', '🍉', '🥥',
  '🍹', '🧉', '🐚', '🌺', '🌿', '🍀', '🌙', '☀️', '⛅', '🌈',
  '💌', '💝', '💖', '🕊️', '🎀', '📌', '✂️', '🖼️',
]

function normalizeEmoji(e: string) {
  return e.replace(/\uFE0F/g, '')
}

function EmojiItem({ emoji, isDark }: { emoji: string; isDark: boolean }) {
  const normalizedEmoji = useMemo(() => normalizeEmoji(emoji), [emoji])
  const data = useMemo(() => ({ emoji: normalizedEmoji }), [normalizedEmoji])
  const { isDragging, drag } = useToolDrag({
    elementType: 'emoji',
    data,
    width: 80,
    height: 80,
  })

  return (
    <button
      ref={drag}
      className={cn(
        'w-full aspect-square flex items-center justify-center text-2xl rounded-xl border-2 cursor-grab active:cursor-grabbing transition-all hover:border-terracotta hover:shadow-md hover:scale-105 hover:-translate-y-0.5',
        isDark ? 'border-[#45475a] bg-[#313244]' : 'border-border-light bg-white',
        isDragging && 'opacity-50 scale-95',
      )}
    >
      {emoji}
    </button>
  )
}

export default function EmojiPanel() {
  const [search, setSearch] = useState('')
  const { theme } = useTheme()
  const isDark = theme === 'night'

  const filtered = search
    ? EMOJIS.filter(e => !search || e.includes(search))
    : EMOJIS

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-[#6c7086]' : 'text-text-muted'}`} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search emoji..."
          className={`w-full pl-9 pr-4 py-2.5 rounded-xl border-2 text-sm outline-none focus:border-terracotta transition-colors font-handwriting placeholder:text-text-muted/40 ${isDark ? 'border-[#45475a] bg-[#313244] text-[#cdd6f4]' : 'border-border-light bg-white text-ink-navy'}`}
        />
      </div>
      <div className="flex items-center gap-2">
        <Smile className={`w-4 h-4 ${isDark ? 'text-[#a6adc8]' : 'text-warm-brown'}`} />
        <p className={`text-sm font-handwriting ${isDark ? 'text-[#a6adc8]' : 'text-warm-brown'}`}>Click or drag to the page</p>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {filtered.map(emoji => (
          <EmojiItem key={emoji} emoji={emoji} isDark={isDark} />
        ))}
      </div>
      {filtered.length === 0 && (
        <div className={`text-center py-8 font-handwriting rounded-xl border-2 border-dashed ${isDark ? 'text-[#6c7086] bg-[#181825] border-[#45475a]' : 'text-text-muted bg-cream border-border-light'}`}>
          <Smile className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No emoji found</p>
        </div>
      )}
    </div>
  )
}
