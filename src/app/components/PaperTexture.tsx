export default function PaperTexture({ density = 0.04 }: { density?: number }) {
  return (
    <>
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ mixBlendMode: 'multiply' }}>
        <filter id="paper-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="5" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#paper-grain)" opacity={density} />
      </svg>
      <div
        className="absolute inset-0 pointer-events-none z-[1]"
        style={{
          opacity: 0.04,
          mixBlendMode: 'multiply',
          background: 'linear-gradient(135deg, rgba(139,115,85,0.5) 0%, transparent 40%, rgba(217,119,87,0.2) 100%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none z-[1]"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(139,115,85,0.04) 100%)',
        }}
      />
    </>
  )
}
