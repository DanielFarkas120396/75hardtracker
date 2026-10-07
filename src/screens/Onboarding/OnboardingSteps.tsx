import { motion, type Variants } from 'framer-motion'
import type { KeyboardEvent, ReactNode } from 'react'
import { BackupRestore } from '../../components/BackupRestore'
import { Icon } from '../../components/icons/Icon'
import { StartDateChoice } from '../../components/StartDateChoice'
import { Button } from '../../components/ui/Button'
import { HoldButton } from '../../components/ui/HoldButton'
import { VariantPicker } from '../../components/VariantPicker'
import { finishLine, lateStartHint, startsInLine, WHY_IDEAS } from '../../content/onboarding'
import { dailyRuleLines, stakesLine, VARIANT_NAMES } from '../../content/variants'
import type { StartDateChoiceState } from '../../hooks/useStartDateChoice'
import { dateForDayNumber, formatShortDay } from '../../lib/dates'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import type { OnboardingMode } from '../../logic/onboarding'
import { cleanText, isValidName, isValidWhy, NAME_MAX_LENGTH, WHY_MAX_LENGTH } from '../../logic/profile'
import { RULESETS, type ChallengeVariant } from '../../logic/rulesets'
import { GateHeading } from '../RestartFlow/GateHeading'

/** From this length on, the why field shows how much room is left. */
const WHY_COUNTER_FROM = 100

/** Past this length, the reason on the deal is set a size smaller, so it doesn't fill the card. */
const LONG_REASON_FROM = 60

const FIELD = 'w-full rounded-xl border border-ink/15 bg-canvas font-rounded text-lg font-bold text-ink'

/** The deal appears line by line: each part fades up after the one before. Reduce motion keeps only the fade. */
const DEAL_CARD: Variants = {
  hidden: { opacity: 0, y: 12 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut', delayChildren: 0.15, staggerChildren: 0.08 } },
}
const DEAL_LINE: Variants = {
  hidden: { opacity: 0, y: 8 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
}

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
function StepTitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <div className="mt-4">
      <GateHeading id={id}>{children}</GateHeading>
    </div>
  )
}

/** Under a disabled button: what's missing to move on. */
function MissingHint({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-2 text-sm text-ink-muted">
      {children}
    </p>
  )
}

/** The first screen. "Restore it" brings back a backup — on a new phone, or after installing the app. */
export function WelcomeStep({ mode, onNext }: { mode: OnboardingMode; onNext: () => void }) {
  return (
    <>
      <StepTitle>75 days. 5 tasks. One duck with a knife.</StepTitle>
      <p className="mt-3 text-ink-muted">
        Workouts, diet, water, reading and a progress photo, every single day. I'll be watching.
      </p>
      <Button className="mt-8 w-full" onClick={onNext}>
        Get started
      </Button>
      <div className="mt-4">
        <BackupRestore look="link" label="Already have a backup? Restore it" confirmReplace={mode === 'returning'} />
      </div>
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
      <StepTitle id="name-title">What should the duck call you?</StepTitle>
      <input
        type="text"
        value={name}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={enterMovesOn(valid, onNext)}
        aria-labelledby="name-title"
        aria-describedby="name-hint"
        placeholder="Your name"
        maxLength={NAME_MAX_LENGTH}
        autoComplete="given-name"
        autoCapitalize="words"
        enterKeyHint="next"
        className={`mt-6 min-h-touch px-4 text-center ${FIELD}`}
      />
      <p id="name-hint" className="mt-2 text-sm text-ink-muted">
        {valid ? `Up to ${NAME_MAX_LENGTH} characters.` : `Type a name to continue. Up to ${NAME_MAX_LENGTH} characters.`}
      </p>
      <Button className="mt-6 w-full" onClick={onNext} disabled={!valid}>
        Continue
      </Button>
    </>
  )
}

interface ChallengeStepProps {
  /** null until the player taps a card: none is preselected. */
  variant: ChallengeVariant | null
  onChange: (variant: ChallengeVariant) => void
  onNext: () => void
}

export function ChallengeStep({ variant, onChange, onNext }: ChallengeStepProps) {
  return (
    <>
      <StepTitle>Pick your challenge</StepTitle>
      <p className="mt-2 text-ink-muted">Tap one. You can switch until the end of Day&nbsp;1.</p>
      <div className="mt-4 w-full pb-6 text-left">
        <VariantPicker value={variant} onChange={onChange} />
      </div>
      {/* Pinned to the bottom, so the four cards never push Continue off a small screen. */}
      <div className="sticky bottom-0 -mx-6 mt-auto w-[calc(100%+3rem)] bg-canvas px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] before:pointer-events-none before:absolute before:inset-x-0 before:-top-8 before:h-8 before:bg-gradient-to-t before:from-canvas before:to-transparent">
        <Button
          className="w-full"
          onClick={onNext}
          disabled={variant === null}
          aria-describedby={variant === null ? 'challenge-hint' : undefined}
        >
          Continue
        </Button>
        {variant === null && <MissingHint id="challenge-hint">Pick a challenge to continue.</MissingHint>}
      </div>
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
  const cleaned = cleanText(why)
  // The ideas only fill an empty field (or swap one idea for another): a tap never wipes the player's own words.
  const showIdeas = cleaned === '' || (WHY_IDEAS as readonly string[]).includes(cleaned)
  return (
    <>
      <StepTitle>Why are you doing this?</StepTitle>
      <p className="mt-2 text-ink-muted">I'll remind you when it gets hard.</p>
      <textarea
        value={why}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={enterMovesOn(valid, onNext)}
        aria-label="Your why"
        aria-describedby={valid ? undefined : 'why-hint'}
        placeholder="Because…"
        maxLength={WHY_MAX_LENGTH}
        rows={3}
        enterKeyHint="next"
        className={`mt-4 resize-none p-4 ${FIELD}`}
      />
      {why.length >= WHY_COUNTER_FROM && (
        <p className="mt-1 self-end text-sm text-ink-muted tabular-nums">
          {why.length}/{WHY_MAX_LENGTH}
        </p>
      )}
      {showIdeas && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {WHY_IDEAS.map((idea) => {
            const chosen = cleaned === idea
            return (
              <button
                key={idea}
                type="button"
                onClick={() => onChange(idea)}
                className={`min-h-touch rounded-full border px-4 font-rounded text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                  chosen ? 'border-world-edge bg-world-soft text-world-ink ring-1 ring-world-edge' : 'border-ink/15 bg-canvas text-ink'
                }`}
              >
                {idea}
              </button>
            )
          })}
        </div>
      )}
      <Button
        className="mt-6 w-full"
        onClick={onNext}
        disabled={!valid}
        aria-describedby={valid ? undefined : 'why-hint'}
      >
        Continue
      </Button>
      {!valid && <MissingHint id="why-hint">Write a reason or tap an idea to continue.</MissingHint>}
    </>
  )
}

interface StartStepProps {
  start: StartDateChoiceState
  today: string
  variant: ChallengeVariant
  /** Minutes since midnight, for the evening warning. */
  nowMin: number
  onNext: () => void
}

export function StartStep({ start, today, variant, nowMin, onNext }: StartStepProps) {
  const lateHint = start.choice === 'today' ? lateStartHint(nowMin, RULESETS[variant]) : null
  return (
    <>
      <StepTitle>When do you start?</StepTitle>
      <p className="mt-2 text-ink-muted">Day&nbsp;1 is the date you pick. Every task is due by midnight.</p>
      <div className="mt-4 w-full">
        <StartDateChoice
          state={start}
          today={today}
          errorId="start-date-error"
          hintId={lateHint ? 'late-start-hint' : undefined}
        />
      </div>
      {start.dateError ? (
        <p id="start-date-error" role="alert" className="mt-2 text-sm font-semibold text-danger-ink">
          {start.dateError}
        </p>
      ) : (
        <p aria-live="polite" className="mt-3 font-rounded font-bold text-ink">
          {finishLine(start.startDate)}
        </p>
      )}
      <div aria-live="polite" className="w-full">
        {lateHint && (
          <p
            id="late-start-hint"
            className="mt-3 flex items-start gap-2 rounded-2xl border border-danger-ink/30 bg-world-soft p-3 text-left text-sm font-semibold text-danger-ink"
          >
            <Icon name="warning" size={18} className="mt-0.5 shrink-0" />
            <span>{lateHint}</span>
          </p>
        )}
      </div>
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
  /** The picked challenge (always set by the deal: the flow can't reach it without one). */
  variant: ChallengeVariant | null
  startDate: string
  today: string
  /** The start step's error when the chosen date can't be used any more (new mode only). */
  dateError: string | null
  busy: boolean
  error: string | null
  /** The hold completed: the duck takes over for a moment before the app does. */
  signed: boolean
  onSign: () => void
  /** Back to the start step, when the date can't be used any more. */
  onChangeStart: () => void
  onFinish: () => void
}

/**
 * The last screen. A new player signs the deal: the rules, what a missed day
 * costs, the dates and their reason, held down to commit. A returning player
 * just picks up where they were.
 */
export function ReadyStep(props: ReadyStepProps) {
  const { mode, name, why, variant, startDate, today, dateError, busy, error, signed, onSign, onChangeStart, onFinish } = props
  const alert = dateError ?? error
  const valid = isValidName(name) && isValidWhy(why)

  if (mode === 'returning') {
    return (
      <>
        <StepTitle>Welcome back, {cleanText(name)}.</StepTitle>
        <p className="mt-3 text-ink-muted">Your challenge is right where you left it.</p>
        <Reason why={why} className="mt-5 rounded-card border border-ink/15 bg-canvas p-5" />
        {alert && <Alert>{alert}</Alert>}
        <Button className="mt-6 w-full" onClick={onFinish} disabled={busy || !valid}>
          {busy ? 'Saving…' : "Let's go"}
        </Button>
      </>
    )
  }

  if (variant === null) return null // unreachable: the challenge step won't move on without a pick

  const rules = RULESETS[variant]
  const startsIn = dateError ? null : startsInLine(startDate, today)
  return (
    <>
      <StepTitle>Deal, {cleanText(name)}.</StepTitle>

      <motion.section
        aria-label="The deal"
        variants={DEAL_CARD}
        initial="hidden"
        animate="shown"
        className="mt-5 w-full rounded-card border border-world-edge/40 bg-world-soft p-5 text-left"
      >
        <motion.p variants={DEAL_LINE} className="font-display text-3xl tracking-wide text-world-ink">
          {VARIANT_NAMES[variant]}
        </motion.p>
        {!dateError && (
          <motion.div variants={DEAL_LINE}>
            <p className="mt-1 font-rounded font-bold text-ink">
              {formatShortDay(startDate)} → {formatShortDay(dateForDayNumber(startDate, CHALLENGE_LENGTH))}
            </p>
            {startsIn && <p className="text-sm font-semibold text-ink-muted">{startsIn}</p>}
          </motion.div>
        )}
        <motion.p variants={DEAL_LINE} className="mt-4 text-sm font-bold text-ink-muted">
          Every day, for {CHALLENGE_LENGTH} days
        </motion.p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-ink marker:text-world-ink">
          {dailyRuleLines(rules).map((line) => (
            <motion.li key={line} variants={DEAL_LINE}>
              {line}
            </motion.li>
          ))}
        </ul>
        <motion.p variants={DEAL_LINE} className="mt-4 font-rounded font-extrabold text-world-ink">
          {stakesLine(rules)}
        </motion.p>
        <motion.div variants={DEAL_LINE}>
          <Reason why={why} className="mt-4 border-t border-world-edge/30 pt-4" />
        </motion.div>
      </motion.section>

      {alert && <Alert>{alert}</Alert>}
      {dateError && (
        <Button variant="secondary" className="mt-3 w-full" onClick={onChangeStart}>
          Change start date
        </Button>
      )}

      {/* After the whole card, not pinned over it: the player reads every rule before they reach the signature. */}
      <motion.div
        className="mt-6 w-full"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <p aria-live="polite" className="font-display text-2xl tracking-wide text-ink empty:hidden">
          {signed && (
            <motion.span
              className="inline-block"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              I'm watching, {cleanText(name)}.
            </motion.span>
          )}
        </p>
        {!signed && (
          <HoldButton
            className="w-full"
            onCommit={onSign}
            disabled={busy || dateError !== null || !valid}
            hint={busy ? undefined : "Hold for 1 second to sign. I'm watching."}
          >
            {busy ? 'Saving…' : 'Hold to commit'}
          </HoldButton>
        )}
      </motion.div>
    </>
  )
}

/** The player's reason, as they'll see it again at hard moments. */
function Reason({ why, className }: { why: string; className: string }) {
  const reason = cleanText(why)
  const size = reason.length > LONG_REASON_FROM ? 'text-xl' : 'text-2xl'
  return (
    <div className={`w-full text-left ${className}`}>
      <p className="text-sm font-bold text-ink-muted">Your reason</p>
      <p className={`mt-1 font-display tracking-wide text-ink ${size}`}>“{reason}”</p>
    </div>
  )
}

function Alert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mt-3 text-sm font-semibold text-danger-ink">
      {children}
    </p>
  )
}
