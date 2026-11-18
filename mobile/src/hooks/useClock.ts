import { msUntilNextLocalMidnight, todayISO } from '@logic/dates'
import { useEffect, useState } from 'react'
import { AppState } from 'react-native'

export interface Clock {
  /** Today's local date (yyyy-MM-dd). */
  today: string
  /** The time of day, in minutes since midnight. */
  nowMin: number
}

const read = (): Clock => {
  const now = new Date()
  return { today: todayISO(now), nowMin: now.getHours() * 60 + now.getMinutes() }
}

/**
 * The date and the time of day, read from the clock at the same instant and
 * kept current: every half minute, a second past midnight, and when the app
 * comes back to the front. For rules that weigh one against the other (until
 * noon, yesterday can still be finished): with a date and a time that tick on
 * their own, the new date would meet 23:59 for a moment and read as a missed day.
 */
export function useClock(): Clock {
  const [clock, setClock] = useState(read)

  useEffect(() => {
    let midnight: ReturnType<typeof setTimeout>
    const refresh = () => {
      const next = read()
      setClock((current) => (current.today === next.today && current.nowMin === next.nowMin ? current : next))
      clearTimeout(midnight)
      midnight = setTimeout(refresh, msUntilNextLocalMidnight() + 1000)
    }
    refresh()
    const tick = setInterval(refresh, 30_000)
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh()
    })
    return () => {
      clearTimeout(midnight)
      clearInterval(tick)
      subscription.remove()
    }
  }, [])

  return clock
}
