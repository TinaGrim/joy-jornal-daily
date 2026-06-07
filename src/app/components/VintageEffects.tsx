interface VintageEffectsProps {
  side?: 'left' | 'right'
  isCover?: boolean
}

export function VintageVignette({ isCover }: VintageEffectsProps) {
  if (isCover) {
    return (
      <div
        className="absolute inset-0 pointer-events-none z-20 rounded-e-2xl"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(139,115,85,0.08) 80%, rgba(139,115,85,0.15) 100%)',
        }}
      />
    )
  }

  return (
    <div
      className="absolute inset-0 pointer-events-none z-20"
      style={{
        background: 'radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(139,115,85,0.06) 80%, rgba(139,115,85,0.12) 100%)',
      }}
    />
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function VintageCorners(_props: { side?: 'left' | 'right' }) {
  const color = 'rgba(139,115,85,0.12)'
  const strokeColor = 'rgba(139,115,85,0.2)'

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {/* Top-left */}
      <svg className="absolute top-0 left-0 w-16 h-16" viewBox="0 0 60 60" fill="none">
        <path d="M0 0h30M0 0v30" stroke={color} strokeWidth="1" opacity="0.5" />
        <path
          d="M2 2h24M2 2v24"
          stroke={strokeColor}
          strokeWidth="0.5"
          opacity="0.4"
          strokeDasharray="2 2"
        />
      </svg>

      {/* Top-right */}
      <svg className="absolute top-0 right-0 w-16 h-16" viewBox="0 0 60 60" fill="none">
        <path d="M60 0H30M60 0v30" stroke={color} strokeWidth="1" opacity="0.5" />
        <path
          d="M58 2H34M58 2v24"
          stroke={strokeColor}
          strokeWidth="0.5"
          opacity="0.4"
          strokeDasharray="2 2"
        />
      </svg>

      {/* Bottom-left */}
      <svg className="absolute bottom-0 left-0 w-16 h-16" viewBox="0 0 60 60" fill="none">
        <path d="M0 60h30M0 60V30" stroke={color} strokeWidth="1" opacity="0.5" />
        <path
          d="M2 58h24M2 58V34"
          stroke={strokeColor}
          strokeWidth="0.5"
          opacity="0.4"
          strokeDasharray="2 2"
        />
      </svg>

      {/* Bottom-right */}
      <svg className="absolute bottom-0 right-0 w-16 h-16" viewBox="0 0 60 60" fill="none">
        <path d="M60 60H30M60 60V30" stroke={color} strokeWidth="1" opacity="0.5" />
        <path
          d="M58 58H34M58 58V34"
          stroke={strokeColor}
          strokeWidth="0.5"
          opacity="0.4"
          strokeDasharray="2 2"
        />
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
          ? 'linear-gradient(to right, transparent 92%, rgba(139,115,85,0.06) 96%, rgba(139,115,85,0.1) 100%)'
          : 'linear-gradient(to left, transparent 92%, rgba(139,115,85,0.06) 96%, rgba(139,115,85,0.1) 100%)',
      }}
    />
  )
}

export function ForeEdgePage({ side = 'right' }: { side?: 'left' | 'right' }) {
  return (
    <div
      className="absolute inset-y-0 pointer-events-none z-20"
      style={{
        width: 8,
        [side]: 0,
        background: 'linear-gradient(to bottom, #e0cdb0, #d5c0a0, #e0cdb0)',
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `repeating-linear-gradient(
            to right,
            transparent 0px,
            rgba(160,140,120,0.12) 0.4px,
            rgba(160,140,120,0.12) 0.6px,
            transparent 0.6px,
            transparent 1.2px
          )`,
        }}
      />
      <div
        className="absolute inset-y-0"
        style={{
          width: 2,
          [side === 'right' ? 'left' : 'right']: 0,
          background: side === 'right'
            ? 'linear-gradient(to right, rgba(139,115,85,0.12), transparent)'
            : 'linear-gradient(to left, rgba(139,115,85,0.12), transparent)',
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
        height: 5,
        bottom: 0,
        background: 'linear-gradient(to top, #d5c0a0, #e0cdb0)',
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `repeating-linear-gradient(
            to bottom,
            transparent 0px,
            rgba(160,140,120,0.10) 0.4px,
            rgba(160,140,120,0.10) 0.6px,
            transparent 0.6px,
            transparent 1.2px
          )`,
        }}
      />
      <div
        className="absolute inset-x-0 top-0"
        style={{
          height: 1.5,
          background: 'linear-gradient(to right, rgba(139,115,85,0.1), transparent 60%)',
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
        width: 10,
        height: 76,
        background: 'linear-gradient(to bottom, #d97757, #c06a4e 80%, #a85d43)',
        clipPath: 'polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%)',
        filter: 'drop-shadow(1px 2px 2px rgba(0,0,0,0.12))',
      }}
    />
  )
}

export function CoverOrnament() {
  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
      {/* Decorative frame */}
      <svg
        className="absolute inset-6 w-[calc(100%-3rem)] h-[calc(100%-3rem)]"
        viewBox="0 0 580 800"
        fill="none"
      >
        {/* Corner ornaments */}
        <path
          d="M20 20 L50 20 M20 20 L20 50"
          stroke="rgba(139,115,85,0.15)"
          strokeWidth="1.5"
        />
        <path
          d="M560 20 L530 20 M560 20 L560 50"
          stroke="rgba(139,115,85,0.15)"
          strokeWidth="1.5"
        />
        <path
          d="M20 780 L50 780 M20 780 L20 750"
          stroke="rgba(139,115,85,0.15)"
          strokeWidth="1.5"
        />
        <path
          d="M560 780 L530 780 M560 780 L560 750"
          stroke="rgba(139,115,85,0.15)"
          strokeWidth="1.5"
        />

        {/* Inner decorative line */}
        <rect
          x="30" y="30" width="520" height="740"
          rx="4"
          stroke="rgba(139,115,85,0.06)"
          strokeWidth="0.5"
          strokeDasharray="4 4"
        />

        {/* Top center ornament */}
        <path
          d="M265 12 Q290 2 315 12"
          stroke="rgba(139,115,85,0.1)"
          strokeWidth="0.8"
          fill="none"
        />
        <path
          d="M270 16 Q290 8 310 16"
          stroke="rgba(139,115,85,0.06)"
          strokeWidth="0.5"
          fill="none"
        />

        {/* Bottom center ornament */}
        <path
          d="M265 788 Q290 798 315 788"
          stroke="rgba(139,115,85,0.1)"
          strokeWidth="0.8"
          fill="none"
        />
        <path
          d="M270 784 Q290 792 310 784"
          stroke="rgba(139,115,85,0.06)"
          strokeWidth="0.5"
          fill="none"
        />
      </svg>
    </div>
  )
}
