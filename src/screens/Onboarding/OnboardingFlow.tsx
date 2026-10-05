import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { Mascot, type DuckMood } from '../../components/mascot/Mascot'
import { profileRepo } from '../../db/repositories/profileRepo'
import { useStartDateChoice } from '../../hooks/useStartDateChoice'
import { onboardingSteps, type OnboardingMode, type OnboardingStep } from '../../logic/onboarding'
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
  why: 'judging',
  start: 'waiting',
  ready: 'triumphant',
}

/**
 * The welcome flow: one question per screen, shown until the player has a
 * profile. A new player also picks the challenge and its start, and "Let's
 * go" creates attempt #1 with the profile (profileRepo.completeOnboarding).
 */
export function OnboardingFlow({ mode, today }: OnboardingFlowProps) {
  const steps = onboardingSteps(mode)
  const [index, setIndex] = useState(0)
  const [name, setName] = useState('')
  const [variant, setVariant] = useState<ChallengeVariant>('hard')
  const [why, setWhy] = useState('')
  const start = useStartDateChoice(today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clamp = (i: number) => Math.min(i, steps.length - 1)
  const step = steps[clamp(index)]
  // Moving is tied to the step that asks for it: a second tap while that step is still leaving does nothing.
  const next = (from: OnboardingStep) => setIndex((i) => (steps[clamp(i)] === from ? clamp(i) + 1 : clamp(i)))
  const back = (from: OnboardingStep) => setIndex((i) => (steps[clamp(i)] === from ? Math.max(clamp(i) - 1, 0) : clamp(i)))

  const finish = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await profileRepo.completeOnboarding(
        { name, why },
        mode === 'new' ? { startDate: start.startDate, variant } : undefined,
      )
      // On success the profile appears, and the app takes over from this flow.
      if (!result.ok) {
        setError("Couldn't save that — try again.")
        setBusy(false)
      }
    } catch {
      setError("Couldn't save that — try again.")
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-surface px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <TopBar index={clamp(index)} total={steps.length} onBack={() => back(step)} />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.2 }}
          className="flex flex-1 flex-col items-center pt-6 text-center"
        >
          <Mascot mood={STEP_MOODS[step]} size={96} />
          {step === 'welcome' && <WelcomeStep mode={mode} onNext={() => next('welcome')} />}
          {step === 'name' && <NameStep name={name} onChange={setName} onNext={() => next('name')} />}
          {step === 'challenge' && (
            <ChallengeStep variant={variant} onChange={setVariant} onNext={() => next('challenge')} />
          )}
          {step === 'why' && <WhyStep why={why} onChange={setWhy} onNext={() => next('why')} />}
          {step === 'start' && <StartStep start={start} today={today} onNext={() => next('start')} />}
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
              onFinish={() => void finish()}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/** Back (from the second screen on) and how far along the flow is. */
function TopBar({ index, total, onBack }: { index: number; total: number; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3">
      {index > 0 ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="-ml-3 min-h-touch min-w-touch rounded-2xl font-rounded text-3xl font-extrabold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
        >
          ‹
        </button>
      ) : (
        <span aria-hidden="true" className="-ml-3 min-h-touch min-w-touch" />
      )}
      <div
        role="progressbar"
        aria-label="Welcome progress"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={index + 1}
        aria-valuetext={`Step ${index + 1} of ${total}`}
        className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10"
      >
        <div
          className="h-full rounded-full bg-green motion-safe:transition-[width] motion-safe:duration-300"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>
    </div>
  )
}
