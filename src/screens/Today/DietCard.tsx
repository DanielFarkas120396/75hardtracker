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
}

export function DietCard({ entry, complete, cheer, rules }: DietCardProps) {
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
        <Toggle
          checked={entry.noAlcohol}
          onChange={(checked) => void dayEntryRepo.update(entry.id, { noAlcohol: checked })}
          label="No alcohol"
        />
      </div>
    </Card>
  )
}
