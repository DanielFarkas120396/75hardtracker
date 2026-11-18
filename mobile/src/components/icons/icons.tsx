import type { ReactNode } from 'react'
import { Circle, G, Path, Rect } from 'react-native-svg'

/** A soft fill under an outline: a light wash of the current colour. */
const SOFT = { fill: 'currentColor', fillOpacity: 0.18 } as const

/**
 * The app's own icons, drawn on a 24×24 grid with 2px round strokes and soft
 * fills: the web app's drawings (src/components/icons/icons.tsx) as react-native-svg
 * shapes. A test compares the two files, so change them there and here together.
 * They take the colour of the Icon around them.
 */
export const ICONS = {
  workout: (
    <>
      <Rect x="4" y="7" width="3.5" height="10" rx="1.2" {...SOFT} />
      <Rect x="16.5" y="7" width="3.5" height="10" rx="1.2" {...SOFT} />
      <Path d="M7.5 12h9M2 10v4M22 10v4" />
    </>
  ),
  // The activities a workout can be (ACTIVITY_ICONS in src/content/activities.ts).
  running: (
    <>
      <Circle cx="15" cy="4.5" r="2" {...SOFT} />
      <Path d="M14 7.5L11 13.5M8 12l2-3 3.5-.5 2.5 2.5 2.5-.5M11 13.5l3.5 2.5-1 4.5M11 13.5l-1.5 4.5-4.5.5" />
    </>
  ),
  walking: (
    <>
      <G transform="rotate(-8 7.5 13)">
        <Path d="M4.6 13.5c-.5-3.6.4-7.5 2.9-7.5s3.3 3.9 2.8 7.5c-.3 1.9-1.3 2.9-2.8 2.9s-2.6-1-2.9-2.9z" {...SOFT} />
        <Path d="M5.4 18.5h4.2a2.1 2.1 0 0 1-4.2 0z" {...SOFT} />
      </G>
      <G transform="rotate(8 16.5 10)">
        <Path d="M13.6 10c-.5-3.6.4-7.5 2.9-7.5s3.3 3.9 2.8 7.5c-.3 1.9-1.3 2.9-2.8 2.9s-2.6-1-2.9-2.9z" {...SOFT} />
        <Path d="M14.4 15h4.2a2.1 2.1 0 0 1-4.2 0z" {...SOFT} />
      </G>
    </>
  ),
  weights: (
    <>
      <Path d="M7.6 9.9C6.9 9 6.5 8 6.5 7.2 6.5 5.4 9 4 12 4s5.5 1.4 5.5 3.2c0 .8-.4 1.8-1.1 2.7" />
      <Path d="M5.5 14.5a6.5 6.5 0 0 1 13 0c0 2.3-.7 4.3-1.8 5.5H7.3c-1.1-1.2-1.8-3.2-1.8-5.5z" {...SOFT} />
    </>
  ),
  yoga: (
    <>
      <Path d="M12 5c1.8 1.8 2.7 4 2.7 6.4S13.8 15.7 12 17c-1.8-1.3-2.7-3.2-2.7-5.6S10.2 6.8 12 5z" {...SOFT} />
      <Path d="M9.6 9.3C7.3 8.6 5 8.8 3.5 9.6c.3 3.6 2.9 6.6 6.4 7.2M14.4 9.3c2.3-.7 4.6-.5 6.1.3-.3 3.6-2.9 6.6-6.4 7.2M4 19.5h16" />
    </>
  ),
  cycling: (
    <>
      <Circle cx="5.5" cy="15.5" r="3.5" {...SOFT} />
      <Circle cx="18.5" cy="15.5" r="3.5" {...SOFT} />
      <Path d="M5.5 15.5l4-7h6M11.5 15.5h-6M11.5 15.5l-2-7M11.5 15.5l4-7 3 7M9.5 8.5V6.5M8 6.5h3M15.5 8.5l-1-3h2.5" />
    </>
  ),
  swimming: (
    <>
      <Circle cx="17.5" cy="9.5" r="2" {...SOFT} />
      <Path d="M15 12.5L10.5 7 5.5 11" />
      <Path d="M2.5 15.5c1.6 0 1.9-1.2 3.2-1.2s1.6 1.2 3.2 1.2 1.9-1.2 3.2-1.2 1.6 1.2 3.2 1.2 1.9-1.2 3.2-1.2 1.6 1.2 3.2 1.2M2.5 19.5c1.6 0 1.9-1.2 3.2-1.2s1.6 1.2 3.2 1.2 1.9-1.2 3.2-1.2 1.6 1.2 3.2 1.2 1.9-1.2 3.2-1.2 1.6 1.2 3.2 1.2" />
    </>
  ),
  stopwatch: (
    <>
      <Circle cx="12" cy="13.5" r="7" {...SOFT} />
      <Path d="M12 13.5V10M10 3.5h4M12 3.5v3M17.5 7.5l1.5-1.5" />
    </>
  ),
  diet: (
    <>
      <Path d="M5 19c0-8 5-13.5 14-14 .5 9-4.5 14-12.5 14z" {...SOFT} />
      <Path d="M5 19c3-4 6-7 9.5-9.5" />
    </>
  ),
  water: <Path d="M12 3.5c3.6 4.3 6 7.6 6 10.5a6 6 0 0 1-12 0c0-2.9 2.4-6.2 6-10.5z" {...SOFT} />,
  reading: (
    <>
      <Path d="M3.5 5.5c3-1 6-.8 8.5 1 2.5-1.8 5.5-2 8.5-1v13c-3-1-6-.8-8.5 1-2.5-1.8-5.5-2-8.5-1z" {...SOFT} />
      <Path d="M12 6.5v13" />
    </>
  ),
  photo: (
    <>
      <Path d="M3.5 9A2 2 0 0 1 5.5 7h2l1.5-2.5h6L16.5 7h2a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" {...SOFT} />
      <Circle cx="12" cy="13" r="3.5" />
    </>
  ),
  streak: (
    <Path d="M12 3c.8 3.4 5.5 5.6 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2.6 1.4-4.4 2.8-5.5.2 1.8.9 2.9 2 3.4-.4-3.2-.3-5.8.7-8.4z" {...SOFT} />
  ),
  journey: (
    <>
      <Path d="M6 21V3.5" />
      <Path d="M6 4.5h12l-2.5 4 2.5 4H6" {...SOFT} />
    </>
  ),
  today: (
    <>
      <Circle cx="12" cy="12" r="9" {...SOFT} />
      <Path d="M8 12.5l2.8 2.8L16.2 9.5" />
    </>
  ),
  stats: (
    <>
      <Rect x="4" y="12" width="4" height="8" rx="1.2" {...SOFT} />
      <Rect x="10" y="4" width="4" height="16" rx="1.2" {...SOFT} />
      <Rect x="16" y="8.5" width="4" height="11.5" rx="1.2" {...SOFT} />
    </>
  ),
  gallery: (
    <>
      <Path d="M7.5 3.5h10a3 3 0 0 1 3 3v9" />
      <Rect x="3.5" y="7" width="13.5" height="13.5" rx="2.5" {...SOFT} />
      <Path d="M3.5 17.5l4-4 3 3 2-2 4.5 4.5" />
    </>
  ),
  settings: (
    <>
      <Path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
      <Circle cx="12" cy="12" r="6" {...SOFT} />
      <Circle cx="12" cy="12" r="2.2" />
    </>
  ),
  lock: (
    <>
      <Rect x="5" y="10.5" width="14" height="10" rx="2.5" {...SOFT} />
      <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2" />
    </>
  ),
  notes: (
    <>
      <Path d="M4.5 19.5l1-4.2L16.3 4.5a2.1 2.1 0 0 1 3 3L8.5 18.4z" {...SOFT} />
      <Path d="M14.3 6.5l3 3" />
    </>
  ),
  scale: (
    <>
      <Rect x="3.5" y="3.5" width="17" height="17" rx="4" {...SOFT} />
      <Path d="M8 10a5.5 5.5 0 0 1 8 0M12 10l1.5-2.2" />
    </>
  ),
  profile: (
    <>
      <Circle cx="12" cy="8.5" r="4" {...SOFT} />
      <Path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6" />
    </>
  ),
  badge: (
    <>
      <Circle cx="12" cy="9.5" r="6" {...SOFT} />
      <Path d="M8.5 14.5L7 21l5-2.5 5 2.5-1.5-6.5" />
    </>
  ),
  history: (
    <>
      <Circle cx="12" cy="12" r="8.5" {...SOFT} />
      <Path d="M12 7.5V12l3 2" />
    </>
  ),
  appearance: (
    <>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
    </>
  ),
  sound: (
    <>
      <Path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" {...SOFT} />
      <Path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  companion: (
    <>
      <Path d="M6 12a6 6 0 1 1 12 0v3a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z" {...SOFT} />
      <Path d="M10 13.5h4l-2 2z" fill="currentColor" />
      <Path d="M9.5 10.5h.01M14.5 10.5h.01" strokeWidth="2.8" />
    </>
  ),
  install: (
    <>
      <Rect x="6.5" y="2.5" width="11" height="19" rx="2.5" {...SOFT} />
      <Path d="M12 7v7M9 11.5l3 3 3-3" />
    </>
  ),
  backup: (
    <>
      <Path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5V9H4z" {...SOFT} />
      <Path d="M5 9h14v8.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zM10 13h4" />
    </>
  ),
  warning: (
    <>
      <Path d="M12 3.5l9 16H3z" {...SOFT} />
      <Path d="M12 10v4.5M12 17.5h.01" />
    </>
  ),
  share: (
    <>
      <Path d="M7.5 9.5H6a1.5 1.5 0 0 0-1.5 1.5v8A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 18 9.5h-1.5" {...SOFT} />
      <Path d="M12 14V3.5M8.5 7L12 3.5 15.5 7" />
    </>
  ),
  calendar: (
    <>
      <Rect x="3.5" y="5" width="17" height="15.5" rx="2.5" {...SOFT} />
      <Path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  // A drink is allowed (a social occasion), and its crossed-out twin: the diet's "No alcohol" switch.
  drink: (
    <>
      <Path d="M7 3.5h10V7a5 5 0 0 1-10 0z" {...SOFT} />
      <Path d="M12 12v8M8.5 20.5h7" />
    </>
  ),
  noDrink: (
    <>
      <Path d="M7 3.5h10V7a5 5 0 0 1-10 0z" {...SOFT} />
      <Path d="M12 12v8M8.5 20.5h7M3.5 3.5l17 17" />
    </>
  ),
  plus: <Path d="M12 5v14M5 12h14" />,
  minus: <Path d="M5 12h14" />,
  close: <Path d="M6 6l12 12M18 6L6 18" />,
  chevron: <Path d="M9 5l7 7-7 7" />,
  ruler: (
    <>
      <Rect x="2.5" y="8" width="19" height="8" rx="1.5" {...SOFT} />
      <Path d="M6.5 8v3M10.5 8v4M14.5 8v3M18.5 8v4" />
    </>
  ),
  star: <Path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" {...SOFT} />,
  joker: (
    <>
      <Rect x="5.5" y="3" width="13" height="18" rx="2.5" {...SOFT} />
      <Path d="M12 8.5l1.2 2.3 2.3 1.2-2.3 1.2L12 15.5l-1.2-2.3-2.3-1.2 2.3-1.2z" />
    </>
  ),
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof ICONS

export const ICON_NAMES = Object.keys(ICONS) as IconName[]
