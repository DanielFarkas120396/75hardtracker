import { todayISO } from '@logic/dates'
import { formatHHmm, parseHHmm } from '@logic/menace'
import DateTimePicker from '@react-native-community/datetimepicker'
import { StyleSheet, View } from 'react-native'
import { useTheme } from '../../theme/ThemeProvider'

/** A local date (yyyy-MM-dd) as a Date at noon, clear of any daylight-saving edge. */
const dateFromISO = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

const timeFromHHmm = (value: string) => {
  const minutes = parseHHmm(value) ?? 0
  const date = new Date()
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return date
}

interface DateFieldProps {
  label: string
  /** yyyy-MM-dd */
  value: string
  min: string
  max: string
  onChange: (date: string) => void
}

/** The phone's own date picker, as a field that opens it. */
export function DateField({ label, value, min, max, onChange }: DateFieldProps) {
  const { mode, colors } = useTheme()
  return (
    <View style={styles.field}>
      <DateTimePicker
        testID="date-field"
        accessibilityLabel={label}
        mode="date"
        display="compact"
        themeVariant={mode}
        accentColor={colors.worldInk}
        value={dateFromISO(value)}
        minimumDate={dateFromISO(min)}
        maximumDate={dateFromISO(max)}
        onValueChange={(_event, date) => onChange(todayISO(date))}
      />
    </View>
  )
}

interface TimeFieldProps {
  label: string
  /** HH:mm */
  value: string
  disabled?: boolean
  onChange: (time: string) => void
}

/** The phone's own time picker, as a field that opens it. */
export function TimeField({ label, value, disabled = false, onChange }: TimeFieldProps) {
  const { mode, colors } = useTheme()
  return (
    <View style={styles.field}>
      <DateTimePicker
        testID="time-field"
        accessibilityLabel={label}
        mode="time"
        display="compact"
        themeVariant={mode}
        accentColor={colors.worldInk}
        disabled={disabled}
        value={timeFromHHmm(value)}
        onValueChange={(_event, date) => onChange(formatHHmm(date.getHours() * 60 + date.getMinutes()))}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  field: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
})
