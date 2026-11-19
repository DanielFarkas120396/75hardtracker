import { CHALLENGE_LENGTH } from '@logic/constants'
import { variantOf } from '@logic/rulesets'
import { VARIANT_NAMES } from '@logic/variantsCopy'
import { useEffect, useState, type ReactNode } from 'react'
import { AccessibilityInfo, StyleSheet, Text, TextInput, View } from 'react-native'
import { Mascot } from '../components/mascot/Mascot'
import { Button } from '../components/ui/Button'
import { Sheet } from '../components/ui/Sheet'
import { challengeRepo } from '../db/repositories/challengeRepo'
import type { Challenge } from '../db/types'
import { Alert, useFieldStyle } from '../onboarding/parts'
import { useTheme } from '../theme/ThemeProvider'
import { YouSaid } from './screens'
import { useChallengeStats } from './stats'

interface GiveUpFlowProps {
  open: boolean
  onClose: () => void
  challenge: Challenge
  today: string
  todayDayNumber: number
  streak: number
}

/** How long step 3's "Give up" stays locked. */
const LOCK_SECONDS = 5

/** What step 4 asks the player to type. */
const CONFIRM_PHRASE = 'GIVE UP'

/** Ignores case, surrounding spaces and repeated spaces between the words. */
function matchesConfirmPhrase(typed: string): boolean {
  return typed.trim().replace(/\s+/g, ' ').toUpperCase() === CONFIRM_PHRASE
}

/** The duck's answer to how many perfect days the attempt has. */
function perfectDaysLine(perfectDays: number): string {
  if (perfectDays === 0) return "Not one perfect day yet, and you're already out?"
  if (perfectDays === 1) return "1 perfect day. You'd throw it away?"
  return `${perfectDays} perfect days. You'd throw them away?`
}

/**
 * "Give up this challenge": four confirmations before the attempt ends for good. Every step's first button is the
 * way out, and closing changes nothing; only step 4's "Give up for good" calls challengeRepo.giveUp. The web's
 * GiveUpFlow (src/screens/Settings/GiveUpFlow.tsx), its steps swapping inside one sheet.
 */
export function GiveUpFlow({ open, onClose, ...rest }: GiveUpFlowProps) {
  return (
    <Sheet open={open} onClose={onClose} label="Give up this challenge">
      <GiveUpSteps onClose={onClose} {...rest} />
    </Sheet>
  )
}

/** Mounted each time the flow opens, so it always starts at step 1. */
function GiveUpSteps({ onClose, challenge, today, todayDayNumber, streak }: Omit<GiveUpFlowProps, 'open'>) {
  const { colors, fonts } = useTheme()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  // Loaded as the flow opens, so step 2 has its numbers by the time it shows.
  const { perfectDays } = useChallengeStats(challenge.id)

  if (step === 1) {
    return (
      <View>
        <StepHeading announced={false}>{`Give up ${VARIANT_NAMES[variantOf(challenge)]}?`}</StepHeading>
        <Text style={[styles.small, styles.lead, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>
          You&apos;re on Day {todayDayNumber} of {CHALLENGE_LENGTH}. Giving up ends this attempt for good: you can&apos;t pick it back up. It stays in your
          history.
        </Text>
        <StepButtons stay="Keep going" onStay={onClose}>
          <Button label="Give up" variant="secondary" onPress={() => setStep(2)} style={styles.half} />
        </StepButtons>
      </View>
    )
  }

  if (step === 2) {
    return (
      <View>
        <View style={styles.duck}>
          <Mascot mood="judging" size={96} />
        </View>
        <StepHeading>Look at what you built.</StepHeading>
        <Text style={[styles.small, styles.built, { backgroundColor: colors.canvas, color: colors.ink, fontFamily: fonts.rounded.bold }]}>
          🔥 {streak}-day streak · {perfectDays} perfect {perfectDays === 1 ? 'day' : 'days'}
        </Text>
        <View style={styles.said}>
          <YouSaid centred={false} />
        </View>
        <Text style={[styles.body, styles.line, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>{perfectDaysLine(perfectDays)}</Text>
        <StepButtons stay="I'll stay" onStay={onClose}>
          <Button label="I'm sure" variant="secondary" onPress={() => setStep(3)} style={styles.half} />
        </StepButtons>
      </View>
    )
  }

  if (step === 3) return <LastWarning todayDayNumber={todayDayNumber} onStay={onClose} onGoOn={() => setStep(4)} />
  return <TypeToConfirm challenge={challenge} today={today} onCancel={onClose} />
}

/** A step's heading, said as its step appears (step 1's is the sheet's own opening). */
function StepHeading({ children, announced = true }: { children: string; announced?: boolean }) {
  const { colors, fonts } = useTheme()
  useEffect(() => {
    if (announced) AccessibilityInfo.announceForAccessibility(children)
  }, [announced, children])
  return (
    <Text accessibilityRole="header" style={[styles.heading, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>
      {children}
    </Text>
  )
}

/** The way out (primary, first), then the way on. */
function StepButtons({ stay, onStay, stayDisabled = false, children }: { stay: string; onStay: () => void; stayDisabled?: boolean; children: ReactNode }) {
  return (
    <View style={styles.buttons}>
      <Button label={stay} onPress={onStay} disabled={stayDisabled} style={styles.half} />
      {children}
    </View>
  )
}

/** Step 3: the duck's last warning, with "Give up" locked for LOCK_SECONDS. */
function LastWarning({ todayDayNumber, onStay, onGoOn }: { todayDayNumber: number; onStay: () => void; onGoOn: () => void }) {
  const { colors, fonts } = useTheme()
  const [secondsLeft, setSecondsLeft] = useState(LOCK_SECONDS)

  useEffect(() => {
    if (secondsLeft === 0) return
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft])

  const line =
    todayDayNumber < CHALLENGE_LENGTH
      ? `Tomorrow is Day ${todayDayNumber + 1}. Quitters don't get a Day ${todayDayNumber + 1}.`
      : `It's Day ${CHALLENGE_LENGTH}. Quitters don't get a finish line.`

  return (
    <View>
      <View style={styles.duck}>
        <Mascot mood="hunting" size={96} />
      </View>
      <StepHeading>Last warning.</StepHeading>
      <Text style={[styles.body, styles.line, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>{line}</Text>
      <StepButtons stay="Keep going" onStay={onStay}>
        <Button
          label={secondsLeft > 0 ? `Give up (${secondsLeft})` : 'Give up'}
          accessibilityLabel={secondsLeft > 0 ? 'Give up, locked for a few seconds' : 'Give up'}
          variant="secondary"
          disabled={secondsLeft > 0}
          onPress={onGoOn}
          style={styles.half}
        />
      </StepButtons>
    </View>
  )
}

/** Step 4: typing GIVE UP unlocks the button that ends the attempt. */
function TypeToConfirm({ challenge, today, onCancel }: { challenge: Challenge; today: string; onCancel: () => void }) {
  const { colors, fonts } = useTheme()
  const field = useFieldStyle()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const giveUp = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await challengeRepo.giveUp(challenge.id, today)
      // On success the gate turns 'abandoned': the flow closes and Today becomes the "You gave up" screen.
      if (result.ok) return
      setError("This attempt can't be given up anymore.")
      setBusy(false)
    } catch {
      setError("Couldn't give up — try again.")
      setBusy(false)
    }
  }

  return (
    <View>
      <StepHeading>{`Type ${CONFIRM_PHRASE} to confirm.`}</StepHeading>
      <Text style={[styles.small, styles.lead, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>This can&apos;t be undone.</Text>
      <TextInput
        accessibilityLabel={`Type ${CONFIRM_PHRASE} to confirm`}
        value={typed}
        onChangeText={setTyped}
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect={false}
        spellCheck={false}
        // Done hides the keyboard: it would cover "Give up for good".
        returnKeyType="done"
        style={[field, styles.field]}
      />
      {error !== null && <Alert>{error}</Alert>}
      <StepButtons stay="Cancel" onStay={onCancel} stayDisabled={busy}>
        <Button label={busy ? 'Giving up…' : 'Give up for good'} variant="danger" disabled={busy || !matchesConfirmPhrase(typed)} onPress={() => void giveUp()} style={styles.half} />
      </StepButtons>
    </View>
  )
}

const styles = StyleSheet.create({
  heading: { fontSize: 18 },
  small: { fontSize: 14, lineHeight: 20 },
  body: { fontSize: 16, lineHeight: 23 },
  lead: { marginTop: 8 },
  line: { marginTop: 12 },
  duck: { alignItems: 'center' },
  built: { marginTop: 12, overflow: 'hidden', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  said: { marginTop: 12 },
  field: { marginTop: 12 },
  buttons: { marginTop: 16, flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
})
