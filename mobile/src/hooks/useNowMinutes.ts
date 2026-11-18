import { useEffect, useState } from 'react'
import { AppState } from 'react-native'

const minutesNow = () => {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

/**
 * The time of day in minutes since midnight, kept current: it ticks every half
 * minute and catches up when the app comes back to the front. The web's useNow.
 * Like useToday, screens read the clock from here, never while rendering.
 */
export function useNowMinutes(): number {
  const [minutes, setMinutes] = useState(minutesNow)
  useEffect(() => {
    const refresh = () => setMinutes(minutesNow())
    const timer = setInterval(refresh, 30_000)
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh()
    })
    return () => {
      clearInterval(timer)
      subscription.remove()
    }
  }, [])
  return minutes
}
