export default function PaperTexture({ density = 0.025 }: { density?: number }) {
  return (
    <>
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ mixBlendMode: 'multiply' }}>
        <filter id="paper-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#paper-grain)" opacity={density} />
      </svg>
      {/* Subtle warm wash over the paper */}
      <div
        className="absolute inset-0 pointer-events-none z-[1]"
        style={{
          opacity: 0.03,
          mixBlendMode: 'multiply',
          background: 'linear-gradient(135deg, rgba(139,115,85,0.4) 0%, transparent 50%, rgba(217,119,87,0.15) 100%)',
        }}
      />
    </>
  )
}
