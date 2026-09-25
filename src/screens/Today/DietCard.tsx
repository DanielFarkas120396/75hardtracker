import { Card } from '../../components/ui/Card'
import { Toggle } from '../../components/ui/Toggle'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import type { DayEntry } from '../../db/types'

interface DietCardProps {
  entry: DayEntry
  complete: boolean
  cheer: string
}

export function DietCard({ entry, complete, cheer }: DietCardProps) {
  return (
    <Card complete={complete} cheer={cheer}>
      <h2 className="font-rounded text-lg font-extrabold text-ink">🥗 Diet</h2>
      <p className="mt-1 text-sm text-ink-muted">No cheat meals, no alcohol.</p>

      <div className="mt-4 flex flex-col gap-2">
        <Toggle
          checked={entry.dietFollowed}
          onChange={(checked) => void dayEntryRepo.update(entry.id, { dietFollowed: checked })}
          label="I followed my diet"
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
