import { isTimeTravelling } from './timeTravel'

/** Dev only: a small reminder, top right, that this is the time-travel test copy, not your data. */
export function TimeTravelBadge() {
  if (!isTimeTravelling()) return null
  return (
    <a
      href="/"
      className="fixed top-[calc(0.5rem+env(safe-area-inset-top))] right-3 z-50 rounded-full bg-ink px-3 py-1 font-rounded text-xs font-bold text-canvas shadow-md"
    >
      Time travel · test data ✕
    </a>
  )
}
