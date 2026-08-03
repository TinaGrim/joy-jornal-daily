interface VintageEffectsProps {
  side?: 'left' | 'right'
  isCover?: boolean
}

export function VintageVignette({ isCover, side }: VintageEffectsProps) {
  if (isCover) {
    return (
      <div
        className="absolute inset-0 pointer-events-none z-20 rounded-r-lg"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(80,50,20,0.12) 70%, rgba(60,30,10,0.22) 100%)',
        }}
      />
    )
  }

  return (
    <>
      <div
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          background: side === 'left'
            ? 'radial-gradient(ellipse at 60% 50%, transparent 50%, rgba(139,115,85,0.06) 75%, rgba(139,115,85,0.14) 100%)'
            : 'radial-gradient(ellipse at 40% 50%, transparent 50%, rgba(139,115,85,0.06) 75%, rgba(139,115,85,0.14) 100%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          background: 'linear-gradient(to bottom, rgba(139,115,85,0.03) 0%, transparent 8%, transparent 92%, rgba(139,115,85,0.04) 100%)',
        }}
      />
    </>
  )
}

export function VintageCorners({ side }: { side?: 'left' | 'right' }) {
  const c1 = 'rgba(139,115,85,0.15)'
  const c2 = 'rgba(139,115,85,0.08)'

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      <svg className="absolute top-0 left-0 w-20 h-20" viewBox="0 0 70 70" fill="none">
        <path d="M0 0h35M0 0v35" stroke={c1} strokeWidth="1.2" opacity="0.6" />
        <path d="M3 3h28M3 3v28" stroke={c2} strokeWidth="0.6" opacity="0.4" strokeDasharray="2 2" />
        <circle cx="6" cy="6" r="1.5" fill={c2} opacity="0.3" />
      </svg>
      <svg className="absolute top-0 right-0 w-20 h-20" viewBox="0 0 70 70" fill="none">
        <path d="M70 0H35M70 0v35" stroke={c1} strokeWidth="1.2" opacity="0.6" />
        <path d="M67 3H39M67 3v28" stroke={c2} strokeWidth="0.6" opacity="0.4" strokeDasharray="2 2" />
        <circle cx="64" cy="6" r="1.5" fill={c2} opacity="0.3" />
      </svg>
      <svg className="absolute bottom-0 left-0 w-20 h-20" viewBox="0 0 70 70" fill="none">
        <path d="M0 70h35M0 70V35" stroke={c1} strokeWidth="1.2" opacity="0.6" />
        <path d="M3 67h28M3 67V39" stroke={c2} strokeWidth="0.6" opacity="0.4" strokeDasharray="2 2" />
        <circle cx="6" cy="64" r="1.5" fill={c2} opacity="0.3" />
      </svg>
      <svg className="absolute bottom-0 right-0 w-20 h-20" viewBox="0 0 70 70" fill="none">
        <path d="M70 70H35M70 70V35" stroke={c1} strokeWidth="1.2" opacity="0.6" />
        <path d="M67 67H39M67 67V39" stroke={c2} strokeWidth="0.6" opacity="0.4" strokeDasharray="2 2" />
        <circle cx="64" cy="64" r="1.5" fill={c2} opacity="0.3" />
      </svg>
    </div>
  )
}

export function AgedEdge({ side }: { side?: 'left' | 'right' }) {
  return (
    <div
      className="absolute inset-0 pointer-events-none z-20"
      style={{
        background: side === 'left'
          ? 'linear-gradient(to right, transparent 90%, rgba(139,115,85,0.05) 95%, rgba(139,115,85,0.1) 100%)'
          : 'linear-gradient(to left, transparent 90%, rgba(139,115,85,0.05) 95%, rgba(139,115,85,0.1) 100%)',
      }}
    />
  )
}

export function ForeEdgePage({ side = 'right' }: { side?: 'left' | 'right' }) {
  return (
    <div
      className="absolute inset-y-0 pointer-events-none z-20"
      style={{
        width: 10,
        [side]: 0,
        background: 'linear-gradient(to bottom, #dcc8a8, #d0bfa0, #e0cdb0, #d5c0a0, #dcc8a8)',
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `repeating-linear-gradient(
            to right,
            transparent 0px,
            rgba(140,120,95,0.15) 0.3px,
            rgba(140,120,95,0.15) 0.5px,
            transparent 0.5px,
            transparent 1px
          )`,
        }}
      />
      <div
        className="absolute inset-y-0"
        style={{
          width: 3,
          [side === 'right' ? 'left' : 'right']: 0,
          background: side === 'right'
            ? 'linear-gradient(to right, rgba(100,80,50,0.18), rgba(139,115,85,0.06), transparent)'
            : 'linear-gradient(to left, rgba(100,80,50,0.18), rgba(139,115,85,0.06), transparent)',
        }}
      />
      <div
        className="absolute inset-y-0"
        style={{
          width: 1,
          [side === 'right' ? 'left' : 'right']: 3,
          background: 'linear-gradient(to bottom, transparent 5%, rgba(255,255,255,0.15) 30%, rgba(255,255,255,0.08) 70%, transparent 95%)',
        }}
      />
    </div>
  )
}

export function BottomPageEdge() {
  return (
    <div
      className="absolute inset-x-0 pointer-events-none z-20"
      style={{
        height: 6,
        bottom: 0,
        background: 'linear-gradient(to top, #c8b494, #d5c0a0, #e0cdb0)',
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `repeating-linear-gradient(
            to bottom,
            transparent 0px,
            rgba(140,120,95,0.12) 0.3px,
            rgba(140,120,95,0.12) 0.5px,
            transparent 0.5px,
            transparent 1px
          )`,
        }}
      />
      <div
        className="absolute inset-x-0 top-0"
        style={{
          height: 1,
          background: 'linear-gradient(to right, rgba(100,80,50,0.12), rgba(139,115,85,0.06) 30%, transparent 60%)',
        }}
      />
    </div>
  )
}

export function RibbonBookmark() {
  return (
    <div
      className="absolute pointer-events-none z-30"
      style={{
        top: -1,
        left: 120,
        width: 12,
        height: 80,
        background: 'linear-gradient(to bottom, #d97757, #c86a4e 30%, #b85d43 80%, #a85038)',
        clipPath: 'polygon(0 0, 100% 0, 100% 82%, 50% 100%, 0 82%)',
        filter: 'drop-shadow(1px 2px 3px rgba(0,0,0,0.18))',
      }}
    >
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(90deg, transparent 20%, rgba(255,255,255,0.15) 45%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.15) 55%, transparent 80%)',
      }} />
    </div>
  )
}

export function CoverOrnament() {
  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
      <svg
        className="absolute inset-8 w-[calc(100%-4rem)] h-[calc(100%-4rem)]"
        viewBox="0 0 540 780"
        fill="none"
      >
        <rect
          x="10" y="10" width="520" height="760"
          rx="3"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="0.8"
        />
        <rect
          x="18" y="18" width="504" height="744"
          rx="2"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="0.5"
          strokeDasharray="6 4"
        />
        <path
          d="M10 10 L40 10 M10 10 L10 40"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1.5"
        />
        <path
          d="M530 10 L500 10 M530 10 L530 40"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1.5"
        />
        <path
          d="M10 770 L40 770 M10 770 L10 740"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1.5"
        />
        <path
          d="M530 770 L500 770 M530 770 L530 740"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1.5"
        />
        <path
          d="M250 4 Q270 -4 290 4"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="0.6"
          fill="none"
        />
        <path
          d="M250 776 Q270 784 290 776"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="0.6"
          fill="none"
        />
        <circle cx="270" cy="390" r="80" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" fill="none" />
        <circle cx="270" cy="390" r="60" stroke="rgba(255,255,255,0.02)" strokeWidth="0.4" fill="none" strokeDasharray="3 3" />
      </svg>
    </div>
  )
}
