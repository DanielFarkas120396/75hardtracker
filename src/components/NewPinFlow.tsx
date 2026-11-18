import { useState } from 'react'
import { isTooSimplePin } from '../lib/pin'
import { PinPad } from './PinPad'

/** Choosing a PIN: type it, then type it again. Refuses PINs that are too easy to guess (111111, 123456). */
export function NewPinFlow({
  onDone,
  title = 'Choose a 6-digit PIN',
  faceId = false,
}: {
  onDone: (pin: string) => void
  title?: string
  /** Face ID is on: the PIN is its fallback. Without it, the PIN is how the app opens. */
  faceId?: boolean
}) {
  const [first, setFirst] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (first === null) {
    return (
      <PinPad
        key="first"
        title={title}
        error={error}
        hint={faceId ? "You'll use it when Face ID can't." : "You'll type it to open the app."}
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
