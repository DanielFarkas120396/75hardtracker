import { useId, type CSSProperties, type ReactNode } from 'react'

/** A stats tile: a small illustration, the number, and what it counts. */
export function StatTile({ art, value, label, tone }: { art: ReactNode; value: string; label: string; tone: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-card bg-surface p-4 ring-1 ring-ink/10 dark:ring-0">
      <div className={`flex h-16 items-end ${tone}`}>{art}</div>
      <p className={`font-display text-2xl leading-none font-semibold tracking-wide ${tone}`}>{value}</p>
      <p className="font-rounded text-xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
    </div>
  )
}

const BOTTLE = 'M12 7h8v3c0 2.5 8 4 8 11v31a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6V21c0-7 8-8.5 8-11z'
const BOTTLE_TOP = 14
const BOTTLE_BOTTOM = 58

/** Five humps, 80 wide: sliding left by one 32-wide stretch loops seamlessly inside the 32-wide bottle. */
const wave = (y: number) => `M0 ${y} q8 -3 16 0 t16 0 t16 0 t16 0 t16 0 V64 H0z`

/** A glass bottle filled to `fill` (0 to 1): two waves rolling on the water and a few bubbles (still with "reduce motion"). */
export function BottleArt({ fill }: { fill: number }) {
  const id = useId()
  const level = Math.min(1, Math.max(0, fill))
  const y = BOTTLE_BOTTOM - (BOTTLE_BOTTOM - BOTTLE_TOP) * level
  return (
    <svg width="32" height="64" viewBox="0 0 32 64" aria-hidden="true">
      <defs>
        <clipPath id={`${id}clip`}>
          <path d={BOTTLE} />
        </clipPath>
        <linearGradient id={`${id}water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="color-mix(in srgb, var(--color-blue), white 25%)" />
          <stop offset="1" stopColor="var(--color-blue-dark)" />
        </linearGradient>
      </defs>
      <path d={BOTTLE} fill="currentColor" opacity="0.1" />
      {level > 0 && (
        <g clipPath={`url(#${id}clip)`}>
          <path d={wave(y + 1.5)} fill="var(--color-blue)" opacity="0.45" className="motion-safe:animate-wave-back" />
          <path d={wave(y)} fill={`url(#${id}water)`} className="motion-safe:animate-wave" />
          <circle cx="12" cy={BOTTLE_BOTTOM - 4} r="1.2" fill="white" opacity="0.7" className="motion-safe:animate-bubble" />
          <circle
            cx="19"
            cy={BOTTLE_BOTTOM - 8}
            r="0.9"
            fill="white"
            opacity="0.7"
            className="motion-safe:animate-bubble"
            style={{ animationDelay: '-1.6s' }}
          />
        </g>
      )}
      <rect x="10.5" y="1" width="11" height="6" rx="2" fill="currentColor" />
      <path d={BOTTLE} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8.5 25v20" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
    </svg>
  )
}

const BOOK_COLORS = [
  'var(--color-green)',
  'var(--color-orange)',
  'var(--color-blue)',
  'var(--color-yellow)',
  'var(--color-purple)',
  'var(--color-danger)',
  'var(--color-world)',
  'var(--color-blue-dark)',
]
const BOOK_WIDTHS = [11, 9, 12, 10, 13, 9, 11, 12]
const BOOK_HEIGHTS = [36, 31, 39, 33, 38, 30, 35, 38]
/** The shelf is wood whatever the world, so the books carry the colour. */
const WOOD = '#8a5a2a'
/** The shelf's top edge: the tallest book still clears the top of the drawing. */
const SHELF = 56

/** Dust gathers with the books: two specks a book, two on an empty shelf. */
const DUST_PER_BOOK = 2

/**
 * Specks of dust drifting in the light: fixed spots and paces (no randomness), each fading in,
 * floating a little and fading out. They stand still with "reduce motion".
 */
const DUST = Array.from({ length: 8 * DUST_PER_BOOK }, (_, i) => ({
  x: 10 + ((i * 37) % 100),
  y: 8 + ((i * 23) % 42),
  r: 0.5 + (i % 3) * 0.3,
  opacity: 0.35 + ((i * 7) % 5) / 12,
  duration: 8 + ((i * 5) % 6),
  delay: (i * 1.7) % 9,
  dx: ((i * 11) % 9) - 4,
  dy: -4 - ((i * 7) % 8),
}))

/**
 * A wooden shelf with a book for every 100 pages read (eight fit, then "+n"), under a faint beam
 * of warm light that slowly sways, with dust floating in it: the more books, the more dust.
 * Before the first 100 pages, the shelf waits.
 */
export function BookShelfArt({ pages }: { pages: number }) {
  const beamId = useId()
  const finished = Math.floor(pages / 100)
  const shown = Math.min(BOOK_COLORS.length, finished)
  // Each book starts where the ones before it end, 0.6 apart.
  const xAt = (i: number) => 6 + BOOK_WIDTHS.slice(0, i).reduce((sum, w) => sum + w + 0.6, 0)

  return (
    <svg width="100%" height="64" viewBox="0 0 120 64" preserveAspectRatio="xMinYMax meet" aria-hidden="true">
      <defs>
        <linearGradient id={beamId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--color-dust)" stopOpacity="0.14" />
          <stop offset="1" stopColor="var(--color-dust)" stopOpacity="0" />
        </linearGradient>
        <filter id={`${beamId}soft`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>
      <g className="origin-[85px_0] [transform-box:view-box] motion-safe:animate-beam-sway">
        <path d={`M72 0H98L64 ${SHELF}H26Z`} fill={`url(#${beamId})`} filter={`url(#${beamId}soft)`} />
      </g>

      <rect x="0" y={SHELF} width="120" height="4" rx="1.5" fill={WOOD} />
      <rect x="0" y={SHELF + 4} width="120" height="2" fill="black" opacity="0.25" />

      {Array.from({ length: shown }, (_, i) => {
        const x = xAt(i)
        const w = BOOK_WIDTHS[i]
        const h = BOOK_HEIGHTS[i]
        return (
          <g key={i}>
            <rect x={x} y={SHELF - h} width={w} height={h} rx="1.5" fill={BOOK_COLORS[i]} />
            <rect x={x} y={SHELF - h} width="2" height={h} fill="black" opacity="0.15" />
            <path d={`M${x} ${SHELF - h + 4}h${w}M${x} ${SHELF - 4}h${w}`} stroke="black" strokeWidth="1.2" opacity="0.22" />
            <rect x={x + w / 2 - 1.2} y={SHELF - h + 8} width="2.4" height={h * 0.3} rx="1" fill="white" opacity="0.5" />
          </g>
        )
      })}

      {shown === 0 && (
        <text x="60" y={SHELF - 14} textAnchor="middle" fontFamily="var(--font-quote)" fontStyle="italic" fontSize="9" fill="var(--color-ink-muted)">
          first book at 100
        </text>
      )}
      {finished > shown && (
        <text x="117" y="10" textAnchor="end" fontSize="9" fontWeight="700" fontFamily="var(--font-rounded)" fill="currentColor">
          +{finished - shown}
        </text>
      )}

      {DUST.slice(0, Math.max(1, shown) * DUST_PER_BOOK).map((speck, i) => (
        <circle
          key={i}
          cx={speck.x}
          cy={speck.y}
          r={speck.r}
          fill="var(--color-dust)"
          className="motion-safe:animate-dust"
          style={
            {
              opacity: speck.opacity,
              animationDuration: `${speck.duration}s`,
              animationDelay: `-${speck.delay}s`,
              '--dust-o': speck.opacity,
              '--dust-dx': `${speck.dx}px`,
              '--dust-dy': `${speck.dy}px`,
            } as CSSProperties
          }
        />
      ))}
    </svg>
  )
}
