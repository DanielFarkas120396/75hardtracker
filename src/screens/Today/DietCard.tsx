import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Toggle } from '../../components/ui/Toggle'
import { dietRuleLine, dietToggleLabel } from '../../content/variants'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import type { DayEntry } from '../../db/types'
import type { Ruleset } from '../../logic/rulesets'

interface DietCardProps {
  entry: DayEntry
  complete: boolean
  cheer: string
  rules: Ruleset
  /** Whether today is a declared social occasion: a drink is allowed. */
  socialToday: boolean
  onPlanSocial: () => void
}

export function DietCard({ entry, complete, cheer, rules, socialToday, onPlanSocial }: DietCardProps) {
  return (
    <Card complete={complete} cheer={cheer}>
      <h2 className="font-rounded text-lg font-extrabold text-ink">🥗 Diet</h2>
      <p className="mt-1 text-sm text-ink-muted">{dietRuleLine(rules)}</p>

      <div className="mt-4 flex flex-col gap-2">
        <Toggle
          checked={entry.dietFollowed}
          onChange={(checked) => void dayEntryRepo.update(entry.id, { dietFollowed: checked })}
          label={dietToggleLabel(rules)}
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
          />
        )}
        {rules.socialDaysPerWeek > 0 && (
          <Button variant="secondary" className="w-full" onClick={onPlanSocial}>
            🥂 Plan a social occasion
          </Button>
        )}
      </div>
    </Card>
  )
}
