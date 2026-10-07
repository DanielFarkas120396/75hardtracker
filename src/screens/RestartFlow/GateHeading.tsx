import { useEffect, useRef, type ReactNode } from 'react'

/**
 * The title of a screen that replaces the whole app (a missed day, a joker,
 * giving up). The control that had focus disappears with the old screen, so
 * the title takes focus as it appears, telling VoiceOver where the player is.
 */
export function GateHeading({ children, id, size = 'md' }: { children: ReactNode; id?: string; size?: 'md' | 'lg' }) {
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    heading.current?.focus()
  }, [])

  return (
    <h1 ref={heading} id={id} tabIndex={-1} className={`font-display tracking-wide text-ink outline-none ${size === 'lg' ? 'text-4xl leading-none uppercase' : 'text-2xl'}`}>
      {children}
    </h1>
  )
}
