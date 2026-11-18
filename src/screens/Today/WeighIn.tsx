import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion, useReducedMotion, type TargetAndTransition } from 'framer-motion'
import { useId, useRef, useState } from 'react'
import { Icon } from '../../components/icons/Icon'
import { measurementRepo } from '../../db/repositories/measurementRepo'
import { useNow } from '../../hooks/useNow'
import { validateMeasurement } from '../../logic/measurements'

/** From noon, "before breakfast" is no longer advice anyone can follow. */
const NOON = 12 * 60

interface WeighInCardProps {
  today: string
  dayNumber: number
}

/**
 * On Today, under the hero, until today's weight is logged. The field sits in
 * the card because iOS only raises the keyboard for a field the player taps.
 * It never counts toward the day.
 */
export function WeighInCard({ today, dayNumber }: WeighInCardProps) {
  // One query, so the card and its hint arrive together, and nothing shows while it loads.
  const state = useLiveQuery(
    async () => ({ weighedToday: (await measurementRepo.getByDate(today)) !== undefined, lastWeight: await measurementRepo.getLatestWeight() }),
    [today],
  )
  const reduceMotion = useReducedMotion()
  return (
    <AnimatePresence>
      {state && !state.weighedToday && (
        <motion.div key="weigh-in" className="overflow-hidden" exit={reduceMotion ? FADE : FOLD}>
          <WeighInForm today={today} dayNumber={dayNumber} lastWeight={state.lastWeight} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const EASE_FOLD = [0.55, 0, 0.2, 1] as const
const FADE: TargetAndTransition = { opacity: 0, transition: { duration: 0.2 } }
/** Once saved, the card says what it kept for a moment, then fades and folds closed; the tiles below follow. */
const LOGGED_S = 0.55
const FOLD: TargetAndTransition = {
  opacity: 0,
  height: 0,
  scale: 0.97,
  transition: {
    height: { delay: LOGGED_S, duration: 0.42, ease: EASE_FOLD },
    scale: { delay: LOGGED_S, duration: 0.42, ease: EASE_FOLD },
    opacity: { delay: LOGGED_S, duration: 0.28 },
  },
}

function WeighInForm({ today, dayNumber, lastWeight }: WeighInCardProps & { lastWeight?: number }) {
  const [weight, setWeight] = useState('')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const nowMin = useNow()
  const [saved, setSaved] = useState<number>()
  const inputRef = useRef<HTMLInputElement>(null)
  const reduceMotion = useReducedMotion()
  const inputId = useId()
  const errorId = useId()

  const save = async () => {
    const result = validateMeasurement({ date: today, weight, body: {} }, today)
    if (!result.ok) {
      setError(result.errors.weight)
      return
    }
    setSaving(true)
    try {
      await measurementRepo.save(result.value)
      // The card stays a moment as it leaves: the keyboard goes now, and the card says what it kept.
      inputRef.current?.blur()
      setSaved(result.value.weight_kg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      className={`mx-4 mb-4 rounded-card border-2 border-world bg-surface p-4 motion-safe:transition-shadow motion-safe:duration-300 ${
        saved !== undefined ? 'shadow-[inset_0_0_28px_-6px_var(--color-world)]' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-world-soft text-world-ink">
          {saved !== undefined ? (
            <motion.span
              aria-hidden="true"
              initial={reduceMotion ? false : { scale: 0, rotate: -35 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 520, damping: 14 }}
              className="text-xl font-bold"
            >
              ✓
            </motion.span>
          ) : (
            <Icon name="scale" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-rounded font-bold text-ink">Weigh in</h2>
          <p className="font-rounded text-sm text-ink-muted">
            {saved !== undefined ? `${saved.toFixed(1)} kg logged.` : dayNumber === 1 ? 'Your starting weight.' : nowMin < NOON ? 'Before breakfast is best.' : 'Any time today works.'}
          </p>
        </div>
      </div>
      <form
        className="mt-3"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Weight in kg
        </label>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder={lastWeight?.toFixed(1)}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="min-h-touch w-full min-w-0 flex-1 rounded-xl bg-canvas px-3 font-rounded text-lg font-bold text-ink placeholder:text-ink-muted"
          />
          <span aria-hidden="true" className="font-rounded text-sm font-bold text-ink-muted">
            kg
          </span>
          <button
            type="submit"
            disabled={saving || saved !== undefined}
            className="min-h-touch shrink-0 rounded-full bg-world px-5 font-rounded text-sm font-semibold text-on-world active:scale-95 motion-safe:transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Save
          </button>
        </div>
        {error && (
          <p id={errorId} className="mt-1 font-rounded text-sm font-semibold text-danger-ink">
            {error}
          </p>
        )}
      </form>
    </section>
  )
}
