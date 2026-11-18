import { addDaysISO, isValidISODate } from '@logic/dates'
import { resolveStartChoice, type StartChoice } from '@logic/startChoice'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { DateField } from '../components/ui/PickerField'
import { useTheme } from '../theme/ThemeProvider'
import { withAlpha } from '../theme/tokens'

export interface StartDateChoiceState {
  choice: StartChoice
  setChoice: (choice: StartChoice) => void
  pickedDate: string
  setPickedDate: (date: string) => void
  /** The start date the choice gives (ISO). */
  startDate: string
  /** The latest start date allowed (ISO). */
  maxDate: string
  /** Why that date can't start an attempt, or null when it can. */
  dateError: string | null
}

/**
 * When an attempt starts: today, tomorrow or a picked date (tomorrow at first), never in the
 * past nor too far ahead. The web's useStartDateChoice, on the same shared rule.
 */
export function useStartChoice(
  today: string,
  initial?: { choice: StartChoice; pickedDate: string },
  defaultChoice: StartChoice = 'today',
): StartDateChoiceState {
  const [choice, setChoice] = useState<StartChoice>(initial?.choice ?? defaultChoice)
  const [pickedDate, setPickedDate] = useState(initial?.pickedDate ?? addDaysISO(today, 1))
  const { startDate, maxDate, dateError } = resolveStartChoice({ choice, pickedDate, today })
  return { choice, setChoice, pickedDate, setPickedDate, startDate, maxDate, dateError }
}

const START_CHOICES: ReadonlyArray<{ id: StartChoice; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'pick', label: 'Pick a date' },
]

/** Today / Tomorrow / Pick a date, with the phone's date picker while picking. */
export function StartDateChoice({ state, today }: { state: StartDateChoiceState; today: string }) {
  const { colors, fonts } = useTheme()
  // The picker can only show a real date inside its range; a stale picked date falls back to today.
  const shown = isValidISODate(state.pickedDate) && state.pickedDate >= today ? state.pickedDate : today
  return (
    <>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="When to start"
        style={[styles.group, { borderColor: withAlpha(colors.ink, 0.15), backgroundColor: colors.canvas }]}
      >
        {START_CHOICES.map(({ id, label }) => {
          const selected = state.choice === id
          return (
            <Pressable
              key={id}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ checked: selected }}
              onPress={() => state.setChoice(id)}
              style={[styles.option, selected && { backgroundColor: colors.surface, borderColor: colors.inkMuted }]}
            >
              <Text style={[styles.label, { color: selected ? colors.ink : colors.inkMuted, fontFamily: fonts.rounded.bold }]}>
                {label}
              </Text>
            </Pressable>
          )
        })}
      </View>
      {state.choice === 'pick' && (
        <View style={styles.picker}>
          <DateField label="Start date" value={shown} min={today} max={state.maxDate} onChange={state.setPickedDate} />
        </View>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  group: { alignSelf: 'stretch', flexDirection: 'row', gap: 4, borderRadius: 16, borderWidth: 1, padding: 4 },
  option: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 8,
  },
  label: { fontSize: 14, textAlign: 'center' },
  picker: { marginTop: 8 },
})
