import type { KeyboardEvent, ReactNode } from 'react'
import { StartDateChoice } from '../../components/StartDateChoice'
import { Button } from '../../components/ui/Button'
import { VariantPicker } from '../../components/VariantPicker'
import { startsWhen, WHY_IDEAS } from '../../content/onboarding'
import { VARIANT_NAMES } from '../../content/variants'
import type { StartDateChoiceState } from '../../hooks/useStartDateChoice'
import type { OnboardingMode } from '../../logic/onboarding'
import { cleanText, isValidName, isValidWhy, NAME_MAX_LENGTH, WHY_MAX_LENGTH } from '../../logic/profile'
import type { ChallengeVariant } from '../../logic/rulesets'
import { GateHeading } from '../RestartFlow/GateHeading'

/** Enter moves on when the step's answer is valid; it never inserts a new line. */
function enterMovesOn(valid: boolean, onNext: () => void) {
  return (event: KeyboardEvent) => {
    if (event.key !== 'Enter') return
    // An IME (Japanese, Chinese…) uses Enter to confirm the composed word, not to submit.
    if (event.nativeEvent.isComposing) return
    event.preventDefault()
    if (valid) onNext()
  }
}

/** A step's title: it takes focus as the step appears, so VoiceOver reads the new question. */
function StepTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4">
      <GateHeading>{children}</GateHeading>
    </div>
  )
}

export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <>
      <StepTitle>75 days. 5 tasks. One duck with a knife.</StepTitle>
      <p className="mt-3 text-ink-muted">
        Workouts, diet, water, reading and a progress photo, every single day. I'll be watching.
      </p>
      <Button className="mt-8 w-full" onClick={onNext}>
        Get started
      </Button>
    </>
  )
}

interface NameStepProps {
  name: string
  onChange: (name: string) => void
  onNext: () => void
}

export function NameStep({ name, onChange, onNext }: NameStepProps) {
  const valid = isValidName(name)
  return (
    <>
      <StepTitle>What should the duck call you?</StepTitle>
      <input
        type="text"
        value={name}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={enterMovesOn(valid, onNext)}
        aria-label="Your name"
        placeholder="Your name"
        maxLength={NAME_MAX_LENGTH}
        autoComplete="given-name"
        autoCapitalize="words"
        enterKeyHint="next"
        className="mt-6 min-h-touch w-full rounded-xl bg-canvas px-4 text-center font-rounded text-lg font-bold text-ink"
      />
      <p className="mt-2 text-sm text-ink-muted">Up to {NAME_MAX_LENGTH} characters.</p>
      <Button className="mt-6 w-full" onClick={onNext} disabled={!valid}>
        Continue
      </Button>
    </>
  )
}

interface ChallengeStepProps {
  variant: ChallengeVariant
  onChange: (variant: ChallengeVariant) => void
  onNext: () => void
}

export function ChallengeStep({ variant, onChange, onNext }: ChallengeStepProps) {
  return (
    <>
      <StepTitle>Pick your challenge</StepTitle>
      <p className="mt-2 text-ink-muted">You can still switch in Settings until the end of Day 1. After that, it's locked.</p>
      <div className="mt-4 w-full text-left">
        <VariantPicker value={variant} onChange={onChange} />
      </div>
      <Button className="mt-6 w-full" onClick={onNext}>
        Continue
      </Button>
    </>
  )
}

interface WhyStepProps {
  why: string
  onChange: (why: string) => void
  onNext: () => void
}

export function WhyStep({ why, onChange, onNext }: WhyStepProps) {
  const valid = isValidWhy(why)
  return (
    <>
      <StepTitle>Why are you doing this?</StepTitle>
      <p className="mt-2 text-ink-muted">I'll remind you when it gets hard.</p>
      <textarea
        value={why}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={enterMovesOn(valid, onNext)}
        aria-label="Your why"
        placeholder="Because…"
        maxLength={WHY_MAX_LENGTH}
        rows={3}
        enterKeyHint="next"
        className="mt-4 w-full resize-none rounded-xl bg-canvas p-4 font-rounded text-lg font-bold text-ink"
      />
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {WHY_IDEAS.map((idea) => {
          const chosen = cleanText(why) === idea
          return (
            <button
              key={idea}
              type="button"
              aria-pressed={chosen}
              onClick={() => onChange(idea)}
              className={`min-h-touch rounded-full px-4 font-rounded text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                chosen ? 'bg-green-light text-green-ink ring-2 ring-green-ink' : 'bg-canvas text-ink'
              }`}
            >
              {idea}
            </button>
          )
        })}
      </div>
      <Button className="mt-6 w-full" onClick={onNext} disabled={!valid}>
        Continue
      </Button>
    </>
  )
}

interface StartStepProps {
  start: StartDateChoiceState
  today: string
  onNext: () => void
}

export function StartStep({ start, today, onNext }: StartStepProps) {
  return (
    <>
      <StepTitle>When do you start?</StepTitle>
      <p className="mt-2 text-ink-muted">Day 1 is the first day you log.</p>
      <div className="mt-4 w-full">
        <StartDateChoice state={start} today={today} />
      </div>
      {start.dateError && (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger-ink">
          {start.dateError}
        </p>
      )}
      <Button className="mt-6 w-full" onClick={onNext} disabled={start.dateError !== null}>
        Continue
      </Button>
    </>
  )
}

interface ReadyStepProps {
  mode: OnboardingMode
  name: string
  why: string
  variant: ChallengeVariant
  startDate: string
  today: string
  /** The start step's error when the chosen date can't be used any more (new mode only). */
  dateError: string | null
  busy: boolean
  error: string | null
  onFinish: () => void
}

export function ReadyStep({ mode, name, why, variant, startDate, today, dateError, busy, error, onFinish }: ReadyStepProps) {
  const alert = dateError ?? error
  const valid = isValidName(name) && isValidWhy(why)
  return (
    <>
      <StepTitle>{mode === 'new' ? `Deal, ${cleanText(name)}.` : `Welcome back, ${cleanText(name)}.`}</StepTitle>
      <p className="mt-3 text-ink-muted">
        {mode === 'new'
          ? `${VARIANT_NAMES[variant]} starts ${startsWhen(startDate, today)}.`
          : 'Your challenge is right where you left it.'}
      </p>
      <p className="mt-4 font-rounded italic text-ink">“{cleanText(why)}”</p>
      <p className="mt-4 font-rounded font-bold text-ink">I'm watching.</p>
      {alert && (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger-ink">
          {alert}
        </p>
      )}
      <Button className="mt-6 w-full" onClick={onFinish} disabled={busy || dateError !== null || !valid}>
        {busy ? 'Starting…' : "Let's go"}
      </Button>
    </>
  )
}
