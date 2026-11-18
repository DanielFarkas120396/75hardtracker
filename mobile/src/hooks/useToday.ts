import { msUntilNextLocalMidnight, todayISO } from '@logic/dates'
import { useEffect, useState } from 'react'
import { AppState } from 'react-native'

/**
 * Today's local date (yyyy-MM-dd), kept current: it changes at midnight, and
 * when the app comes back to the front after the phone slept through one.
 * Screens read the date from here, never from todayISO() while rendering:
 * a render doesn't happen again just because the clock moved on.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => todayISO())

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      setToday(todayISO())
      clearTimeout(timer)
      // One second past midnight, so a timer that fires a touch early still lands on the new day.
      timer = setTimeout(refresh, msUntilNextLocalMidnight() + 1000)
    }
    refresh()
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh()
    })
    return () => {
      clearTimeout(timer)
      subscription.remove()
    }
  }, [])

  return today
}
