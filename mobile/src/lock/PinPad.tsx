import { formatCountdown, isTooSimplePin, PIN_LENGTH, wrongPinLine } from '@logic/appLock'
import { useEffect, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Icon } from '../components/icons/Icon'
import { appLockRepo } from '../db/repositories/appLockRepo'
import { useLiveQuery } from '../db/useLiveQuery'
import { useTheme } from '../theme/ThemeProvider'
import { withAlpha } from '../theme/tokens'

// The web's PinPad, NewPinFlow and CheckPinPad, and its useCountdown.

/** Whole seconds left until `until` (epoch ms), ticking every second; 0 once it has passed or when there is none. */
export function useCountdown(until: number | null): number {
  const [seconds, setSeconds] = useState(() => secondsUntil(until))
  useEffect(() => {
    const tick = () => setSeconds(secondsUntil(until))
    tick()
    if (until === null) return
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [until])
  return seconds
}

function secondsUntil(until: number | null): number {
  return until === null ? 0 : Math.max(0, Math.ceil((until - Date.now()) / 1000))
}

interface PinPadProps {
  title: string
  /** Shown under the dots, in red (a wrong PIN, a mismatch). */
  error?: string | null
  /** Shown under the dots when there's no error (a countdown, a hint). */
  hint?: string | null
  disabled?: boolean
  /** Called once all digits are typed; the pad then clears itself. */
  onComplete: (pin: string) => void
  /** The bottom-left key, e.g. Face ID. */
  extraKey?: ReactNode
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

/** A banking-app style PIN pad: dots for the digits typed, big round keys, delete. */
export function PinPad({ title, error, hint, disabled = false, onComplete, extraKey }: PinPadProps) {
  const { colors, fonts } = useTheme()
  const [digits, setDigits] = useState('')

  const press = (digit: string) => {
    if (disabled || digits.length >= PIN_LENGTH) return
    const next = digits + digit
    if (next.length === PIN_LENGTH) {
      setDigits('')
      onComplete(next)
    } else {
      setDigits(next)
    }
  }

  const key = (digit: string) => (
    <Pressable
      key={digit}
      accessibilityRole="button"
      accessibilityLabel={digit}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => press(digit)}
      style={({ pressed }) => [styles.key, { backgroundColor: pressed ? colors.worldSoft : colors.surface }, disabled && styles.faded]}
    >
      <Text style={[styles.digit, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>{digit}</Text>
    </Pressable>
  )
  const line = error ?? hint ?? ''

  return (
    <View style={styles.pad}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>
        {title}
      </Text>
      <View accessible accessibilityLabel={`${digits.length} of ${PIN_LENGTH} digits entered`} style={styles.dots}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < digits.length
                ? { borderColor: colors.world, backgroundColor: colors.world }
                : { borderColor: error ? colors.danger : withAlpha(colors.ink, 0.3) },
            ]}
          />
        ))}
      </View>
      <Text
        accessibilityRole={error ? 'alert' : undefined}
        style={[styles.line, { color: error ? colors.dangerInk : colors.inkMuted, fontFamily: fonts.rounded.semibold }]}
      >
        {line}
      </Text>
      <View style={styles.grid}>
        {KEYS.map(key)}
        <View style={styles.key}>{extraKey}</View>
        {key('0')}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete"
          accessibilityState={{ disabled: disabled || digits.length === 0 }}
          disabled={disabled || digits.length === 0}
          onPress={() => setDigits(digits.slice(0, -1))}
          style={[styles.key, (disabled || digits.length === 0) && styles.faint]}
        >
          <View style={styles.flip}>
            <Icon name="chevron" size={26} color={colors.inkMuted} />
          </View>
        </Pressable>
      </View>
    </View>
  )
}

interface NewPinFlowProps {
  onDone: (pin: string) => void
  title?: string
  /** Face ID is on: the PIN is its fallback. Without it, the PIN is how the app opens. */
  faceId?: boolean
}

/** Choosing a PIN: type it, then type it again. Refuses PINs that are too easy to guess (111111, 123456). */
export function NewPinFlow({ onDone, title = 'Choose a 6-digit PIN', faceId = false }: NewPinFlowProps) {
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

/** Asks for the current PIN (to change it or turn the lock off). Wrong PINs count and wait, as on the lock screen. */
export function CheckPinPad({ title, onVerified }: { title: string; onVerified: () => void }) {
  const failures = useLiveQuery(() => appLockRepo.getFailures(), [])
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const secondsLeft = useCountdown(failures?.lockedUntil ?? null)

  const submit = async (pin: string) => {
    setChecking(true)
    const result = await appLockRepo.checkPin(pin)
    setChecking(false)
    if (result.ok) onVerified()
    else setError(wrongPinLine(result.failures.count))
  }

  return (
    <PinPad
      title={title}
      disabled={secondsLeft > 0 || checking}
      error={secondsLeft > 0 ? null : error}
      hint={secondsLeft > 0 ? `Too many wrong PINs. Try again in ${formatCountdown(secondsLeft)}.` : checking ? 'Checking…' : null}
      onComplete={(pin) => void submit(pin)}
    />
  )
}

const styles = StyleSheet.create({
  pad: { alignItems: 'center', gap: 16 },
  title: { fontSize: 18, textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 12 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  line: { minHeight: 20, maxWidth: 300, textAlign: 'center', fontSize: 14 },
  grid: { width: 3 * 64 + 2 * 24, flexDirection: 'row', flexWrap: 'wrap', columnGap: 24, rowGap: 12 },
  key: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 32 },
  digit: { fontSize: 24 },
  faded: { opacity: 0.4 },
  faint: { opacity: 0.3 },
  flip: { transform: [{ rotate: '180deg' }] },
})
