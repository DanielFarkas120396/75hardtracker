import type { ReactNode } from 'react'
import { Icon } from '../../components/icons/Icon'

const TILE = 'flex flex-col gap-2 rounded-card bg-surface p-4 shadow-sm ring-1 ring-ink/10 dark:ring-0'

/** A stats tile: a small illustration, the number, and what it counts. With `onClick`, it opens more. */
export function StatTile({ art, value, label, tone, onClick }: { art: ReactNode; value: string; label: string; tone: string; onClick?: () => void }) {
  const body = (
    <>
      <span className={`flex h-12 items-end ${tone}`}>{art}</span>
      <span className={`block font-display text-2xl leading-none tracking-wide ${tone}`}>{value}</span>
      <span className="block font-rounded text-xs font-bold text-ink-muted">{label}</span>
    </>
  )
  if (!onClick) return <div className={TILE}>{body}</div>
  return (
    <button type="button" onClick={onClick} className={`relative text-left motion-safe:transition-transform active:scale-[0.98] ${TILE}`}>
      {body}
      <Icon name="chevron" size={18} className="absolute top-4 right-4 text-ink-muted" />
    </button>
  )
}

const BOTTLE = 'M11 2h8v7c0 2 6 4 6 9v24a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V18c0-5 6-7 6-9z'

/** A bottle, filled to `fill` (0 to 1). */
export function BottleArt({ fill }: { fill: number }) {
  const height = 44 * Math.min(1, Math.max(0, fill))
  return (
    <svg width="30" height="48" viewBox="0 0 30 48" aria-hidden="true">
      <defs>
        <clipPath id="stats-bottle">
          <path d={BOTTLE} />
        </clipPath>
      </defs>
      <rect x="0" y={46 - height} width="30" height={height} fill="var(--color-blue)" clipPath="url(#stats-bottle)" />
      <path d={BOTTLE} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  )
}

const BOOK_COLORS = ['var(--color-green)', 'var(--color-orange)', 'var(--color-blue)', 'var(--color-yellow)', 'var(--color-world)']

/** A stack of books, one more for every 100 pages (up to five). */
export function BookStackArt({ pages }: { pages: number }) {
  const books = pages > 0 ? Math.min(5, Math.floor(pages / 100) + 1) : 0
  return (
    <svg width="44" height="48" viewBox="0 0 44 48" aria-hidden="true">
      <rect x="2" y="46" width="40" height="2" rx="1" fill="currentColor" opacity="0.3" />
      {Array.from({ length: books }, (_, i) => (
        <rect
          key={i}
          x={i % 2 ? 6 : 3}
          y={37 - i * 8.5}
          width={i % 2 ? 32 : 36}
          height="7.5"
          rx="2"
          fill={BOOK_COLORS[i]}
          stroke="currentColor"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  )
}
