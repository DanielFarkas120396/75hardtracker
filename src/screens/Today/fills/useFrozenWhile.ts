import { useState } from 'react'

/** The value as it was when `frozen` turned on, until it turns off. A change made under a sheet then plays once the sheet closes, from where the board was. */
export function useFrozenWhile<T>(frozen: boolean, value: T): T {
  const [kept, setKept] = useState(value)
  // React's "adjust state when a prop changes" pattern: compared during render, no effect needed.
  if (!frozen && kept !== value) setKept(value)
  return frozen ? kept : value
}
