import { Icon } from '../../components/icons/Icon'
import { Button } from '../../components/ui/Button'
import { Toggle } from '../../components/ui/Toggle'
import { dietToggleLabel } from '../../content/variants'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import type { DayEntry } from '../../db/types'
import type { Ruleset } from '../../logic/rulesets'

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
        icon={<Icon name="diet" size={20} className="text-world-ink" />}
      />
      {socialToday ? (
        <p className="flex items-center gap-2 rounded-xl bg-canvas px-3 py-2 font-rounded text-sm font-bold text-ink">
          <Icon name="drink" size={18} className="shrink-0 text-world-ink" />
          Social occasion today — a drink is allowed.
        </p>
      ) : (
        <Toggle
          checked={entry.noAlcohol}
          onChange={(checked) => void dayEntryRepo.update(entry.id, { noAlcohol: checked })}
          label="No alcohol"
          icon={<Icon name="noDrink" size={20} className="text-world-ink" />}
        />
      )}
      {canPlanSocial && (
        <Button variant="secondary" className="flex w-full items-center justify-center gap-2" onClick={onPlanSocial}>
          <Icon name="drink" size={18} className="text-world-ink" />
          Plan a social occasion
        </Button>
      )}
    </div>
  )
}
