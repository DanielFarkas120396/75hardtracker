import { Icon } from '../../components/icons/Icon'
import { dietToggleLabel } from '../../content/variants'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import type { DayEntry } from '../../db/types'
import type { Ruleset } from '../../logic/rulesets'

interface DietSwitchesProps {
  entry: DayEntry
  rules: Ruleset
  /** A declared social occasion: the plain glass takes the alcohol switch's place. */
  socialToday: boolean
}

/** The diet tile's two switches, stacked on its right with a gap, so a near-miss doesn't open the sheet. Each has a short visible label. */
export function DietSwitches({ entry, rules, socialToday }: DietSwitchesProps) {
  return (
    <div data-fill-anchor className="absolute inset-y-0 right-2 flex flex-col items-end justify-center gap-1.5">
      <MiniSwitch
        label={dietToggleLabel(rules)}
        text="Diet"
        checked={entry.dietFollowed}
        onChange={(checked) => void dayEntryRepo.update(entry.id, { dietFollowed: checked })}
      />
      {socialToday ? (
        // Centred under the switch's track.
        <span className="box-content flex h-11 w-8 items-center justify-center pr-1 text-ink">
          <Icon name="drink" size={22} label="Social occasion today — a drink is allowed" />
        </span>
      ) : (
        <MiniSwitch
          label="No alcohol"
          text="No drink"
          checked={entry.noAlcohol}
          onChange={(checked) => void dayEntryRepo.update(entry.id, { noAlcohol: checked })}
        />
      )}
    </div>
  )
}

interface MiniSwitchProps {
  /** The switch's name for VoiceOver ("No alcohol"). */
  label: string
  /** The short label shown beside the track ("No drink"). */
  text: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function MiniSwitch({ label, text, checked, onChange }: MiniSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex h-11 touch-manipulation items-center gap-1.5 rounded-full pr-1 pl-1.5 font-rounded text-xs font-bold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
    >
      {text}
      <span
        className={`relative inline-flex h-5 w-8 shrink-0 items-center rounded-full motion-safe:transition-colors ${checked ? 'bg-green-ink' : 'bg-ink/20'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-1 ring-black/10 motion-safe:transition-transform ${checked ? 'translate-x-3.5' : 'translate-x-0.5'}`}
        />
      </span>
    </button>
  )
}
