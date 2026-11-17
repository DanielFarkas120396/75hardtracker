import { useId, type ReactNode } from 'react'

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
const BOOK_HEIGHTS = [42, 36, 46, 39, 44, 34, 41, 45]
/** The shelf is wood whatever the world, so the books carry the colour. */
const WOOD = '#8a5a2a'
/** The shelf's top edge, and how far the book in progress sticks out above the others. */
const SHELF = 55
const PULLED = 9
/** Room for seven finished books; more show as "+n". */
const SHELF_ROOM = 7

/**
 * A wooden shelf with a book for every 100 pages read. The book in progress is pulled out, fills
 * up from the bottom as its 100 pages go by, and has a red ribbon on top.
 */
export function BookShelfArt({ pages }: { pages: number }) {
  const finished = Math.floor(pages / 100)
  const shown = Math.min(SHELF_ROOM, finished)
  const progress = (pages % 100) / 100

  // Each book starts where the ones before it end, 0.6 apart.
  const xAt = (i: number) => 6 + BOOK_WIDTHS.slice(0, i).reduce((sum, w) => sum + w + 0.6, 0)
  const books = Array.from({ length: shown }, (_, i) => ({ i, x: xAt(i), w: BOOK_WIDTHS[i], h: BOOK_HEIGHTS[i] }))
  const current = { x: xAt(shown), w: BOOK_WIDTHS[shown], h: BOOK_HEIGHTS[shown], color: BOOK_COLORS[shown] }
  const top = SHELF - PULLED - current.h
  const bookend = current.x + current.w + 3.5

  return (
    <svg width="100%" height="64" viewBox="0 0 120 64" preserveAspectRatio="xMinYMax meet" aria-hidden="true">
      <rect x="2" y={SHELF} width="116" height="4" rx="1.5" fill={WOOD} stroke="currentColor" />
      <path
        d={`M14 ${SHELF + 4}v5l5 -5M106 ${SHELF + 4}v5l-5 -5`}
        fill={WOOD}
        stroke="currentColor"
        strokeLinejoin="round"
      />

      {books.map(({ i, x, w, h }) => (
        <g key={i}>
          <rect x={x} y={SHELF - h} width={w} height={h} rx="1.5" fill={BOOK_COLORS[i]} stroke="currentColor" />
          <path d={`M${x} ${SHELF - h + 4}h${w}M${x} ${SHELF - 5}h${w}`} stroke="black" strokeWidth="1.2" opacity="0.3" />
          <rect x={x + w / 2 - 1.5} y={SHELF - h + 8} width="3" height={h * 0.3} rx="1" fill="white" opacity="0.55" />
        </g>
      ))}

      {pages === 0 ? (
        <rect
          x={current.x}
          y={SHELF - current.h}
          width={current.w}
          height={current.h}
          rx="1.5"
          fill="none"
          stroke="currentColor"
          strokeDasharray="2 2"
          opacity="0.5"
        />
      ) : (
        <g>
          <rect
            x={current.x}
            y={top}
            width={current.w}
            height={current.h}
            rx="1.5"
            fill={current.color}
            fillOpacity="0.25"
            stroke="currentColor"
            strokeDasharray="2 1.5"
          />
          <rect
            x={current.x}
            y={SHELF - PULLED - current.h * progress}
            width={current.w}
            height={current.h * progress}
            rx="1.5"
            fill={current.color}
          />
          <path d={`M${current.x + current.w / 2} ${top}v-6`} stroke="var(--color-danger)" strokeWidth="2.2" strokeLinecap="round" />
        </g>
      )}

      <path d={`M${bookend} ${SHELF}v-16h3v13h7v3z`} fill="var(--color-ink-muted)" stroke="currentColor" strokeLinejoin="round" />
      {finished > SHELF_ROOM && (
        <text x="117" y="10" textAnchor="end" fontSize="9" fontWeight="700" fontFamily="var(--font-rounded)" fill="currentColor">
          +{finished - SHELF_ROOM}
        </text>
      )}
    </svg>
  )
}
