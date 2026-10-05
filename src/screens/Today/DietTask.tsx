import { Button } from '../../components/ui/Button'
import { Toggle } from '../../components/ui/Toggle'
import { dietToggleLabel } from '../../content/variants'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import type { DayEntry } from '../../db/types'
import type { Ruleset } from '../../logic/rulesets'
import { NoDrinkEmoji } from './DietSwitches'

interface DietTaskProps {
  entry: DayEntry
  rules: Ruleset
  /** Whether today is a declared social occasion: a drink is allowed. */
  socialToday: boolean
  /** Whether the "Plan a social occasion" button should show at all (the rules allow it, and there's still a day left to declare). */
  canPlanSocial: boolean
  onPlanSocial: () => void
}

/** The diet sheet's body: the two ticks, and the social occasion. */
export function DietTask({ entry, rules, socialToday, canPlanSocial, onPlanSocial }: DietTaskProps) {
  return (
    <div className="flex flex-col gap-2">
      <Toggle
        checked={entry.dietFollowed}
        onChange={(checked) => void dayEntryRepo.update(entry.id, { dietFollowed: checked })}
        label={dietToggleLabel(rules)}
        icon="🍽️"
      />
      {socialToday ? (
        <p className="rounded-xl bg-canvas px-3 py-2 font-rounded text-sm font-bold text-ink">
          🥂 Social occasion today — a drink is allowed.
        </p>
      ) : (
        <Toggle
          checked={entry.noAlcohol}
          onChange={(checked) => void dayEntryRepo.update(entry.id, { noAlcohol: checked })}
          label="No alcohol"
          icon={<NoDrinkEmoji />}
        />
      )}
      {canPlanSocial && (
        <Button variant="secondary" className="w-full" onClick={onPlanSocial}>
          🥂 Plan a social occasion
        </Button>
      )}
    </div>
  )
}
