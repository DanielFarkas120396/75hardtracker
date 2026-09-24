import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  complete?: boolean
  className?: string
}

/** Rounded surface card used for each task on the Today screen; shows a check badge when complete. */
export function Card({ children, complete = false, className = '' }: CardProps) {
  return (
    <div
      className={`relative rounded-card border-2 bg-surface p-4 shadow-sm motion-safe:transition-colors ${complete ? 'border-green' : 'border-transparent'} ${className}`}
    >
      {complete && (
        <span className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-green text-sm text-white shadow-sm">
          ✓
        </span>
      )}
      {children}
    </div>
  )
}
