import { useState } from 'react'
import { isTooSimplePin } from '../lib/pin'
import { PinPad } from './PinPad'

/** Choosing a PIN: type it, then type it again. Refuses PINs that are too easy to guess (111111, 123456). */
export function NewPinFlow({ onDone, title = 'Choose a 6-digit PIN' }: { onDone: (pin: string) => void; title?: string }) {
  const [first, setFirst] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (first === null) {
    return (
      <PinPad
        key="first"
        title={title}
        error={error}
        hint="You'll use it when Face ID can't."
        onComplete={(pin) => {
          if (isTooSimplePin(pin)) {
            setError('Too easy to guess. Try another one.')
          } else {
            setError(null)
            setFirst(pin)
          }
        }}
      />
    )
  }

  return (
    <PinPad
      key="again"
      title="Type it again"
      onComplete={(pin) => {
        if (pin === first) {
          onDone(pin)
        } else {
          setFirst(null)
          setError("Those didn't match. Start again.")
        }
      }}
    />
  )
}
