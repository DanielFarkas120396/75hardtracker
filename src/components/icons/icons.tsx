import type { ReactNode } from 'react'

/** A soft fill under an outline: a light wash of the current colour. */
const SOFT = { fill: 'currentColor', fillOpacity: 0.18 } as const

/**
 * The app's own icons, drawn on a 24×24 grid with 2px round strokes and soft
 * fills. They take the current text colour, so they follow the world.
 */
export const ICONS = {
  workout: (
    <>
      <rect x="4" y="7" width="3.5" height="10" rx="1.2" {...SOFT} />
      <rect x="16.5" y="7" width="3.5" height="10" rx="1.2" {...SOFT} />
      <path d="M7.5 12h9M2 10v4M22 10v4" />
    </>
  ),
  diet: (
    <>
      <path d="M5 19c0-8 5-13.5 14-14 .5 9-4.5 14-12.5 14z" {...SOFT} />
      <path d="M5 19c3-4 6-7 9.5-9.5" />
    </>
  ),
  water: <path d="M12 3.5c3.6 4.3 6 7.6 6 10.5a6 6 0 0 1-12 0c0-2.9 2.4-6.2 6-10.5z" {...SOFT} />,
  reading: (
    <>
      <path d="M3.5 5.5c3-1 6-.8 8.5 1 2.5-1.8 5.5-2 8.5-1v13c-3-1-6-.8-8.5 1-2.5-1.8-5.5-2-8.5-1z" {...SOFT} />
      <path d="M12 6.5v13" />
    </>
  ),
  photo: (
    <>
      <path d="M3.5 9A2 2 0 0 1 5.5 7h2l1.5-2.5h6L16.5 7h2a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" {...SOFT} />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  streak: (
    <path d="M12 3c.8 3.4 5.5 5.6 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2.6 1.4-4.4 2.8-5.5.2 1.8.9 2.9 2 3.4-.4-3.2-.3-5.8.7-8.4z" {...SOFT} />
  ),
  xp: <path d="M12 3.5l2.6 5.3 5.8.9-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.2-4.1 5.8-.9z" {...SOFT} />,
  journey: (
    <>
      <path d="M6 21V3.5" />
      <path d="M6 4.5h12l-2.5 4 2.5 4H6" {...SOFT} />
    </>
  ),
  today: (
    <>
      <circle cx="12" cy="12" r="9" {...SOFT} />
      <path d="M8 12.5l2.8 2.8L16.2 9.5" />
    </>
  ),
  stats: (
    <>
      <rect x="4" y="12" width="4" height="8" rx="1.2" {...SOFT} />
      <rect x="10" y="4" width="4" height="16" rx="1.2" {...SOFT} />
      <rect x="16" y="8.5" width="4" height="11.5" rx="1.2" {...SOFT} />
    </>
  ),
  gallery: (
    <>
      <path d="M7.5 3.5h10a3 3 0 0 1 3 3v9" />
      <rect x="3.5" y="7" width="13.5" height="13.5" rx="2.5" {...SOFT} />
      <path d="M3.5 17.5l4-4 3 3 2-2 4.5 4.5" />
    </>
  ),
  settings: (
    <>
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
      <circle cx="12" cy="12" r="6" {...SOFT} />
      <circle cx="12" cy="12" r="2.2" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" {...SOFT} />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2" />
    </>
  ),
  notes: (
    <>
      <path d="M4.5 19.5l1-4.2L16.3 4.5a2.1 2.1 0 0 1 3 3L8.5 18.4z" {...SOFT} />
      <path d="M14.3 6.5l3 3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  chevron: <path d="M9 5l7 7-7 7" />,
  joker: (
    <>
      <rect x="5.5" y="3" width="13" height="18" rx="2.5" {...SOFT} />
      <path d="M12 8.5l1.2 2.3 2.3 1.2-2.3 1.2L12 15.5l-1.2-2.3-2.3-1.2 2.3-1.2z" />
    </>
  ),
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof ICONS

export const ICON_NAMES = Object.keys(ICONS) as IconName[]
