import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import type { DayEntry } from '../../db/types'
import { WATER_TARGET_ML } from '../../logic/constants'

interface WaterCardProps {
  entry: DayEntry
  complete: boolean
  cheer: string
}

export function WaterCard({ entry, complete, cheer }: WaterCardProps) {
  const [lastDelta, setLastDelta] = useState<number | null>(null)

  const addWater = (deltaMl: number) => {
    void dayEntryRepo.adjustWater(entry.id, deltaMl)
    setLastDelta(deltaMl)
  }

  const undo = () => {
    if (lastDelta === null) return
    void dayEntryRepo.adjustWater(entry.id, -lastDelta)
    setLastDelta(null)
  }

  const fillPercent = Math.min(100, (entry.water_ml / WATER_TARGET_ML) * 100)
  const liters = (entry.water_ml / 1000).toFixed(2)
  const targetLiters = (WATER_TARGET_ML / 1000).toFixed(1)

  return (
    <Card complete={complete} cheer={cheer}>
      <h2 className="font-rounded text-lg font-extrabold text-ink">💧 Water</h2>
      <p className="mt-1 text-sm text-ink-muted">Goal: {targetLiters} L a day.</p>

      <div className="mt-4 flex items-center gap-4">
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
        <Button variant="secondary" onClick={undo} disabled={lastDelta === null}>
          Undo
        </Button>
      </div>
    </Card>
  )
}
