import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/icons/Icon'
import { Mascot, type DuckMood } from '../../components/mascot/Mascot'
import { SAVE_FAILED_LINE } from '../../content/microcopy'
import { defaultStartChoice } from '../../content/onboarding'
import { db } from '../../db/db'
import { profileRepo } from '../../db/repositories/profileRepo'
import { useNow } from '../../hooks/useNow'
import { useStartDateChoice } from '../../hooks/useStartDateChoice'
import { clearDraft, loadDraft, saveDraft } from '../../lib/onboardingDraft'
import { onboardingSteps, resumeStep, type OnboardingMode, type OnboardingStep } from '../../logic/onboarding'
import { isValidName, isValidWhy } from '../../logic/profile'
import type { ChallengeVariant } from '../../logic/rulesets'
import { ChallengeStep, NameStep, ReadyStep, StartStep, WelcomeStep, WhyStep } from './OnboardingSteps'

interface OnboardingFlowProps {
  mode: OnboardingMode
  today: string
}

const STEP_MOODS: Record<OnboardingStep, DuckMood> = {
  welcome: 'content',
  name: 'watching',
  challenge: 'tapping',
  why: 'watching',
  start: 'waiting',
  ready: 'judging',
}

/** The steps with the most content: a smaller duck keeps their button in reach. */
const LONG_STEPS: ReadonlySet<OnboardingStep> = new Set(['challenge', 'ready'])

/** How long the duck holds the signed deal before the app takes over. */
export const SIGNED_BEAT_MS = 1200

/**
 * The welcome flow: one question per screen, shown until the player has a
 * profile. A new player also picks the challenge and its start, and holding
 * "Hold to commit" signs the deal: the duck has a moment, then attempt #1 is
 * created with the profile (profileRepo.completeOnboarding). The answers so
 * far are kept on the device, so a restart (iOS closing the app) comes back to
 * the same step, or to the first one whose answer no longer holds.
 */
export function OnboardingFlow({ mode, today }: OnboardingFlowProps) {
  const steps = onboardingSteps(mode)
  const [draft] = useState(() => loadDraft(db.name))
  const nowMin = useNow()
  const start = useStartDateChoice(
    today,
    draft ? { choice: draft.startChoice, pickedDate: draft.pickedDate } : undefined,
    defaultStartChoice(nowMin),
  )
  const [index, setIndex] = useState(() =>
    draft
      ? resumeStep(steps, draft.step, {
          name: isValidName(draft.name),
          challenge: draft.variant !== null,
          why: isValidWhy(draft.why),
          start: start.dateError === null,
        })
      : 0,
  )
  const [name, setName] = useState(draft?.name ?? '')
  const [variant, setVariant] = useState<ChallengeVariant | null>(draft?.variant ?? null)
  const [why, setWhy] = useState(draft?.why ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signed, setSigned] = useState(false)
  const beat = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (beat.current) clearTimeout(beat.current)
    },
    [],
  )

  const clamp = (i: number) => Math.min(i, steps.length - 1)
  const step = steps[clamp(index)]
  // Moving is tied to the step that asks for it: a second tap while that step is still leaving does nothing.
  const next = (from: OnboardingStep) => setIndex((i) => (steps[clamp(i)] === from ? clamp(i) + 1 : clamp(i)))
  const back = (from: OnboardingStep) => setIndex((i) => (steps[clamp(i)] === from ? Math.max(clamp(i) - 1, 0) : clamp(i)))

  const { choice: startChoice, pickedDate } = start
  useEffect(() => {
    saveDraft(db.name, { step, name, variant, why, startChoice, pickedDate })
  }, [step, name, variant, why, startChoice, pickedDate])

  const finish = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await profileRepo.completeOnboarding(
        { name, why },
        mode === 'new' && variant ? { startDate: start.startDate, variant } : undefined,
      )
      // On success the profile appears, and the app takes over from this flow.
      if (result.ok) {
        clearDraft(db.name)
        return
      }
    } catch {
      // Same as a refused save, below.
    }
    setError(SAVE_FAILED_LINE)
    setBusy(false)
    setSigned(false)
  }

  // The hold completed: the duck takes the signature, then the save runs and the app takes over.
  const sign = () => {
    setSigned(true)
    setError(null)
    beat.current = setTimeout(() => {
      beat.current = null
      void finish()
    }, SIGNED_BEAT_MS)
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <TopBar index={clamp(index)} total={steps.length} onBack={() => back(step)} hideBack={signed} />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
            className="flex flex-1 flex-col items-center pt-6 text-center"
          >
            <Mascot mood={signed ? 'triumphant' : STEP_MOODS[step]} size={LONG_STEPS.has(step) ? 64 : 96} />
            {step === 'welcome' && <WelcomeStep mode={mode} onNext={() => next('welcome')} />}
            {step === 'name' && <NameStep name={name} onChange={setName} onNext={() => next('name')} />}
            {step === 'challenge' && (
              <ChallengeStep variant={variant} onChange={setVariant} onNext={() => next('challenge')} />
            )}
            {step === 'why' && <WhyStep why={why} onChange={setWhy} onNext={() => next('why')} />}
            {step === 'start' && variant && (
              <StartStep start={start} today={today} variant={variant} nowMin={nowMin} onNext={() => next('start')} />
            )}
            {step === 'ready' && (
              <ReadyStep
                mode={mode}
                name={name}
                why={why}
                variant={variant}
                startDate={start.startDate}
                today={today}
                dateError={mode === 'new' ? start.dateError : null}
                busy={busy}
                error={error}
                signed={signed}
                onSign={sign}
                onChangeStart={() => setIndex(Math.max(steps.indexOf('start'), 0))}
                onFinish={() => void finish()}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

interface TopBarProps {
  index: number
  total: number
  onBack: () => void
  /** Once the deal is signed, there's no going back. */
  hideBack: boolean
}

/** Back (from the second screen on) and how far along the flow is: empty on the welcome, full on the deal. */
function TopBar({ index, total, onBack, hideBack }: TopBarProps) {
  return (
    <div className="flex items-center gap-3">
      {index > 0 && !hideBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="-ml-3 flex min-h-touch min-w-touch items-center justify-center rounded-2xl text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
        >
          <Icon name="chevron" size={26} strokeWidth={2.5} className="rotate-180" />
        </button>
      ) : (
        <span aria-hidden="true" className="-ml-3 min-h-touch min-w-touch" />
      )}
      <div
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={index + 1}
        aria-valuetext={`Step ${index + 1} of ${total}`}
        className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10"
      >
        <div
          className="h-full origin-left rounded-full bg-world motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out"
          style={{ transform: `scaleX(${index / (total - 1)})` }}
        />
      </div>
    </div>
  )
}
