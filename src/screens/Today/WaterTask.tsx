import { Button } from '../../components/ui/Button'
import { formatLiters } from '../../content/variants'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import type { DayEntry } from '../../db/types'
import type { Ruleset } from '../../logic/rulesets'

interface WaterTaskProps {
  entry: DayEntry
  rules: Ruleset
}

/** The water sheet's body: the bottle, and the pours. */
export function WaterTask({ entry, rules }: WaterTaskProps) {
  const addWater = (deltaMl: number) => {
    void dayEntryRepo.adjustWater(entry.id, deltaMl)
  }

  const fillPercent = Math.min(100, (entry.water_ml / rules.waterTargetMl) * 100)
  const liters = formatLiters(entry.water_ml)
  const targetLiters = formatLiters(rules.waterTargetMl)

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="relative h-24 w-14 shrink-0 overflow-hidden rounded-2xl border-2 border-blue bg-blue-light">
          <div
            className="absolute inset-x-0 bottom-0 bg-blue motion-safe:transition-[height] motion-safe:duration-500"
            style={{ height: `${fillPercent}%` }}
          />
        </div>
        <div>
          <p className="font-rounded text-2xl font-extrabold text-ink">{liters} L</p>
          <p className="text-sm text-ink-muted">of {targetLiters} L</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="water" onClick={() => addWater(250)}>
          + 250 ml
        </Button>
        <Button variant="water" onClick={() => addWater(500)}>
          + 500 ml
        </Button>
        <Button variant="secondary" onClick={() => addWater(-250)} disabled={entry.water_ml === 0}>
          − 250 ml
        </Button>
      </div>
    </div>
  )
}
