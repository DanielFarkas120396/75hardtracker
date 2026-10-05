import { useEffect, useRef, type ReactNode } from 'react'

/**
 * The title of a screen that replaces the whole app (a missed day, a joker,
 * giving up). The control that had focus disappears with the old screen, so
 * the title takes focus as it appears, telling VoiceOver where the player is.
 */
export function GateHeading({ children }: { children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    heading.current?.focus()
  }, [])

  return (
    <h1 ref={heading} tabIndex={-1} className="font-display text-2xl tracking-wide text-ink outline-none">
      {children}
    </h1>
  )
}
