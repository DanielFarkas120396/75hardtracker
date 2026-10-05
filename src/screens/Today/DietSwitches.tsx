import type { ReactNode } from 'react'
import { dietToggleLabel } from '../../content/variants'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import type { DayEntry } from '../../db/types'
import type { Ruleset } from '../../logic/rulesets'

interface DietSwitchesProps {
  entry: DayEntry
  rules: Ruleset
  /** A declared social occasion: the glass gives way to a toast. */
  socialToday: boolean
}

/** The diet tile's two switches, stacked on its right, each named by its emoji: the plate, and the crossed-out glass. */
export function DietSwitches({ entry, rules, socialToday }: DietSwitchesProps) {
  return (
    // Two rows, each centred on the tile's own rows: the icon box, and the title.
    <div className="absolute top-2 right-3 bottom-0 flex flex-col items-end justify-between">
      <MiniSwitch
        label={dietToggleLabel(rules)}
        emoji="🍽️"
        checked={entry.dietFollowed}
        onChange={(checked) => void dayEntryRepo.update(entry.id, { dietFollowed: checked })}
      />
      {socialToday ? (
        <span role="img" aria-label="Social occasion today — a drink is allowed" className="flex h-11 items-center px-2 text-xl leading-none">
          🥂
        </span>
      ) : (
        <MiniSwitch
          label="No alcohol"
          emoji={<NoDrinkEmoji />}
          checked={entry.noAlcohol}
          onChange={(checked) => void dayEntryRepo.update(entry.id, { noAlcohol: checked })}
        />
      )}
    </div>
  )
}

interface MiniSwitchProps {
  label: string
  emoji: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
}

function MiniSwitch({ label, emoji, checked, onChange }: MiniSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex h-11 touch-manipulation items-center gap-1.5 rounded-full px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
    >
      <span aria-hidden="true" className="text-xl leading-none">
        {emoji}
      </span>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full motion-safe:transition-colors ${checked ? 'bg-green-ink' : 'bg-ink-muted'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-surface shadow motion-safe:transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
        />
      </span>
    </button>
  )
}

/** A glass with a small "no" sign over it: there's no such emoji, so two are stacked. */
export function NoDrinkEmoji() {
  return (
    <span className="relative inline-block">
      🍷
      <span className="absolute inset-0 flex items-center justify-center text-[0.55em]">🚫</span>
    </span>
  )
}
