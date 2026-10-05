import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { PinPad } from '../../components/PinPad'
import { appLockRepo } from '../../db/repositories/appLockRepo'
import { formatCountdown, useCountdown } from '../../hooks/useCountdown'
import { FREE_ATTEMPTS } from '../../lib/pin'

/** Asks for the current PIN (to change it or turn the lock off). Wrong PINs count and wait, as on the lock screen. */
export function CheckPinPad({ title, onVerified }: { title: string; onVerified: () => void }) {
  const failures = useLiveQuery(() => appLockRepo.getFailures(), [])
  const [error, setError] = useState<string | null>(null)
  const secondsLeft = useCountdown(failures?.lockedUntil ?? null)

  const submit = async (pin: string) => {
    const result = await appLockRepo.checkPin(pin)
    if (result.ok) return onVerified()
    const left = FREE_ATTEMPTS - result.failures.count
    setError(left > 0 ? `Wrong PIN. ${left} ${left === 1 ? 'try' : 'tries'} left before a wait.` : null)
  }

  return (
    <PinPad
      title={title}
      disabled={secondsLeft > 0}
      error={secondsLeft > 0 ? null : error}
      hint={secondsLeft > 0 ? `Too many wrong PINs. Try again in ${formatCountdown(secondsLeft)}.` : null}
      onComplete={(pin) => void submit(pin)}
    />
  )
}
