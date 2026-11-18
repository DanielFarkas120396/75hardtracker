import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Stepper } from '../../components/ui/Stepper'
import { formatLiters } from '../../content/variants'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import type { DayEntry } from '../../db/types'
import type { Ruleset } from '../../logic/rulesets'

interface WaterTaskProps {
  entry: DayEntry
  rules: Ruleset
}

/** One line per label, even on a 320 px phone. Button's own px-6 beats a plain px-* in Tailwind's order, hence the `!`. */
const POUR = 'whitespace-nowrap px-2!'

/** "Other amount": a 330 ml can to start, in 50 ml steps, up to a 2 L jug. */
const OTHER_START_ML = 330
const OTHER_STEP_ML = 50
const OTHER_MAX_ML = 2000

/** The water sheet's body: the bottle, and the pours. A glass is the one primary action, like the tile's "+ 250 ml". */
export function WaterTask({ entry, rules }: WaterTaskProps) {
  const [otherMl, setOtherMl] = useState(OTHER_START_ML)
  const addWater = (deltaMl: number) => {
    void dayEntryRepo.adjustWater(entry.id, deltaMl)
  }

  const fillPercent = Math.min(100, (entry.water_ml / rules.waterTargetMl) * 100)
  const liters = formatLiters(entry.water_ml)
  const targetLiters = formatLiters(rules.waterTargetMl)

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="relative h-24 w-14 shrink-0 overflow-hidden rounded-2xl border-2 border-world bg-world-soft">
          <div
            className="absolute inset-0 origin-bottom bg-world motion-safe:transition-transform motion-safe:duration-500"
            style={{ transform: `scaleY(${fillPercent / 100})` }}
          />
        </div>
        <div>
          <p className="font-rounded text-2xl font-bold text-ink">{liters} L</p>
          <p className="text-sm text-ink-muted">of {targetLiters} L</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Button className={POUR} onClick={() => addWater(250)}>
          + 250 ml
        </Button>
        <Button variant="soft" className={POUR} onClick={() => addWater(500)}>
          + 500 ml
        </Button>
        <Button variant="secondary" className={POUR} onClick={() => addWater(-250)} disabled={entry.water_ml === 0}>
          − 250 ml
        </Button>
      </div>

      {/* For a can or a bottle that isn't a glass: any amount in 50 ml steps. */}
      <p className="mt-4 font-rounded text-sm font-bold text-ink-muted">Other amount</p>
      <div className="mt-1 flex items-center justify-between gap-2 rounded-2xl bg-canvas p-2">
        <Stepper
          value={otherMl}
          onStep={(delta) => setOtherMl((ml) => Math.min(OTHER_MAX_ML, Math.max(OTHER_STEP_ML, ml + delta)))}
          step={OTHER_STEP_ML}
          min={OTHER_STEP_ML}
          max={OTHER_MAX_ML}
          unit="ml"
        />
        <Button variant="secondary" className={POUR} onClick={() => addWater(otherMl)} aria-label={`Add ${otherMl} ml`}>
          Add
        </Button>
      </div>
    </div>
  )
}
