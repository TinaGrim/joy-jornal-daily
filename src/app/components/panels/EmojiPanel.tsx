import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useToolDrag } from '@/hooks/useToolDrag'
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

function EmojiItem({ emoji }: { emoji: string }) {
  const { isDragging, drag } = useToolDrag({
    elementType: 'emoji',
    data: { emoji: normalizeEmoji(emoji) },
    width: 80,
    height: 80,
  })

  return (
    <button
      ref={drag}
      className={cn(
        'w-full aspect-square flex items-center justify-center text-2xl rounded-xl border-2 border-border-light bg-white cursor-grab active:cursor-grabbing transition-all hover:border-terracotta hover:shadow-md hover:scale-105 hover:-translate-y-0.5',
        isDragging && 'opacity-50 scale-95',
      )}
    >
      {emoji}
    </button>
  )
}

export default function EmojiPanel() {
  const [search, setSearch] = useState('')

  const filtered = search
    ? EMOJIS.filter(e => !search || e.includes(search))
    : EMOJIS

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search emoji..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border-2 border-border-light bg-white text-sm text-ink-navy outline-none focus:border-terracotta transition-colors font-handwriting placeholder:text-text-muted/40"
        />
      </div>
      <div className="flex items-center gap-2">
        <Smile className="w-4 h-4 text-warm-brown" />
        <p className="text-sm text-warm-brown font-handwriting">Click or drag to the page</p>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {filtered.map(emoji => (
          <EmojiItem key={emoji} emoji={emoji} />
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="text-center py-8 text-text-muted font-handwriting bg-cream rounded-xl border-2 border-dashed border-border-light">
          <Smile className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No emoji found</p>
        </div>
      )}
    </div>
  )
}
