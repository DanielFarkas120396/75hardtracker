import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Mascot } from '../../components/mascot/Mascot'
import { YouSaid } from '../../components/ProfileLines'
import { VARIANT_NAMES } from '../../content/variants'
import { challengeRepo } from '../../db/repositories/challengeRepo'
import type { Challenge } from '../../db/types'
import { useChallengeStats } from '../../hooks/useChallengeStats'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { variantOf } from '../../logic/rulesets'

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
 * "Give up this challenge": four confirmations before the attempt ends for
 * good. Every step's first button is the way out, and closing changes
 * nothing; only step 4's "Give up for good" calls challengeRepo.giveUp.
 */
export function GiveUpFlow({ open, onClose, ...rest }: GiveUpFlowProps) {
  return (
    <Modal open={open} onClose={onClose}>
      <GiveUpSteps onClose={onClose} {...rest} />
    </Modal>
  )
}

/** Mounted each time the flow opens, so it always starts at step 1. */
function GiveUpSteps({ onClose, challenge, today, todayDayNumber, streak }: Omit<GiveUpFlowProps, 'open'>) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  // Loaded as the flow opens, so step 2 has its numbers by the time it shows.
  const { perfectDays, xp } = useChallengeStats(challenge.id)

  if (step === 1) {
    return (
      <>
        <StepHeading focusOnMount={false}>Give up {VARIANT_NAMES[variantOf(challenge)]}?</StepHeading>
        <p className="mt-2 text-sm text-ink-muted">
          You're on Day {todayDayNumber} of {CHALLENGE_LENGTH}. Giving up ends this attempt for good: you can't pick
          it back up. It stays in your history.
        </p>
        <StepButtons stay="Keep going" onStay={onClose}>
          <Button variant="secondary" className="flex-1" onClick={() => setStep(2)}>
            Give up
          </Button>
        </StepButtons>
      </>
    )
  }

  if (step === 2) {
    return (
      <>
        <div className="flex justify-center">
          <Mascot mood="judging" size={96} />
        </div>
        <StepHeading>Look at what you built.</StepHeading>
        <p className="mt-3 rounded-xl bg-canvas px-3 py-2 font-rounded text-sm font-bold text-ink">
          🔥 {streak}-day streak · {perfectDays} perfect {perfectDays === 1 ? 'day' : 'days'} · ⭐ {xp} XP
        </p>
        <YouSaid className="mt-3" />
        <p className="mt-3 font-rounded font-bold text-ink">{perfectDaysLine(perfectDays)}</p>
        <StepButtons stay="I'll stay" onStay={onClose}>
          <Button variant="secondary" className="flex-1" onClick={() => setStep(3)}>
            I'm sure
          </Button>
        </StepButtons>
      </>
    )
  }

  if (step === 3) return <LastWarning todayDayNumber={todayDayNumber} onStay={onClose} onGoOn={() => setStep(4)} />
  return <TypeToConfirm challenge={challenge} today={today} onCancel={onClose} />
}

/** A step's heading. It takes focus when its step appears; step 1 leaves focus to the Modal's own panel. */
function StepHeading({ children, focusOnMount = true }: { children: ReactNode; focusOnMount?: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (focusOnMount) heading.current?.focus()
  }, [focusOnMount])

  return (
    <h3 ref={heading} tabIndex={-1} className="font-rounded text-lg font-extrabold text-ink outline-none">
      {children}
    </h3>
  )
}

/** The way out (primary, first), then the way on. */
function StepButtons({
  stay,
  onStay,
  stayDisabled = false,
  children,
}: {
  stay: string
  onStay: () => void
  stayDisabled?: boolean
  children: ReactNode
}) {
  return (
    <div className="mt-4 flex gap-2">
      <Button className="flex-1" onClick={onStay} disabled={stayDisabled}>
        {stay}
      </Button>
      {children}
    </div>
  )
}

/** Step 3: the duck's last warning, with "Give up" locked for LOCK_SECONDS. */
function LastWarning({
  todayDayNumber,
  onStay,
  onGoOn,
}: {
  todayDayNumber: number
  onStay: () => void
  onGoOn: () => void
}) {
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
    <>
      <div className="flex justify-center">
        <Mascot mood="hunting" size={96} />
      </div>
      <StepHeading>Last warning.</StepHeading>
      <p className="mt-3 font-rounded font-bold text-ink">{line}</p>
      <StepButtons stay="Keep going" onStay={onStay}>
        <Button variant="secondary" className="flex-1" onClick={onGoOn} disabled={secondsLeft > 0}>
          {secondsLeft > 0 ? `Give up (${secondsLeft})` : 'Give up'}
        </Button>
      </StepButtons>
    </>
  )
}

/** Step 4: typing GIVE UP unlocks the button that ends the attempt. */
function TypeToConfirm({ challenge, today, onCancel }: { challenge: Challenge; today: string; onCancel: () => void }) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const giveUp = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await challengeRepo.giveUp(challenge.id, today)
      // On success the gate turns 'abandoned' and the app swaps to the "You gave up" screen.
      if (!result.ok) {
        setError("This attempt can't be given up anymore.")
        setBusy(false)
      }
    } catch {
      setError("Couldn't give up — try again.")
      setBusy(false)
    }
  }

  return (
    <>
      <StepHeading>Type {CONFIRM_PHRASE} to confirm.</StepHeading>
      <p className="mt-2 text-sm text-ink-muted">This can't be undone.</p>
      <input
        type="text"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        // The iPhone keyboard's Done key sends Enter: hide the keyboard instead of leaving it
        // covering "Give up for good", where a backdrop tap to dismiss it would close the flow.
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        aria-label={`Type ${CONFIRM_PHRASE} to confirm`}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="done"
        className="mt-3 min-h-touch w-full rounded-xl bg-canvas px-3 font-rounded font-bold text-ink"
      />
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger-ink">
          {error}
        </p>
      )}
      <StepButtons stay="Cancel" onStay={onCancel} stayDisabled={busy}>
        <Button
          variant="danger"
          className="flex-1"
          onClick={() => void giveUp()}
          disabled={busy || !matchesConfirmPhrase(typed)}
        >
          {busy ? 'Giving up…' : 'Give up for good'}
        </Button>
      </StepButtons>
    </>
  )
}
