import { Icon } from '../../components/icons/Icon'
import type { IconName } from '../../components/icons/icons'
import { dietToggleLabel } from '../../content/variants'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import type { DayEntry } from '../../db/types'
import type { Ruleset } from '../../logic/rulesets'

interface DietSwitchesProps {
  entry: DayEntry
  rules: Ruleset
  /** A declared social occasion: the crossed-out glass gives way to a plain one. */
  socialToday: boolean
}

/** The diet tile's two switches, stacked on its right, each named by its icon: the diet's leaf, and the crossed-out glass. */
export function DietSwitches({ entry, rules, socialToday }: DietSwitchesProps) {
  return (
    <div data-fill-anchor className="absolute inset-y-0 right-5 flex flex-col items-end justify-center">
      <MiniSwitch
        label={dietToggleLabel(rules)}
        icon="diet"
        checked={entry.dietFollowed}
        onChange={(checked) => void dayEntryRepo.update(entry.id, { dietFollowed: checked })}
      />
      {socialToday ? (
        <span className="flex h-11 items-center px-2 text-ink">
          <Icon name="drink" size={22} label="Social occasion today — a drink is allowed" />
        </span>
      ) : (
        <MiniSwitch
          label="No alcohol"
          icon="noDrink"
          checked={entry.noAlcohol}
          onChange={(checked) => void dayEntryRepo.update(entry.id, { noAlcohol: checked })}
        />
      )}
    </div>
  )
}

interface MiniSwitchProps {
  label: string
  icon: IconName
  checked: boolean
  onChange: (checked: boolean) => void
}

function MiniSwitch({ label, icon, checked, onChange }: MiniSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex h-11 touch-manipulation items-center gap-1.5 rounded-full px-1 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
    >
      <Icon name={icon} size={20} />
      <span
        className={`relative inline-flex h-5 w-8 shrink-0 items-center rounded-full motion-safe:transition-colors ${checked ? 'bg-green-ink' : 'bg-ink-muted'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow motion-safe:transition-transform ${checked ? 'translate-x-3.5' : 'translate-x-0.5'}`}
        />
      </span>
    </button>
  )
}
