import { CHALLENGE_LENGTH } from '@logic/constants'
import { addDaysISO, dateForDayNumber, dayNumberForDate, formatShortDay } from '@logic/dates'
import { SAVE_FAILED_LINE } from '@logic/onboardingCopy'
import { challengeWeek } from '@logic/rulesets'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { DateField } from '../components/ui/PickerField'
import { SheetHeader } from '../components/ui/Sheet'
import { challengeRepo } from '../db/repositories/challengeRepo'
import type { Challenge } from '../db/types'
import { useAnnounceChanges } from '../hooks/useAnnounce'
import { useTheme } from '../theme/ThemeProvider'

interface SocialFormProps {
  challenge: Challenge
  today: string
  todayDayNumber: number
  onClose: () => void
  /** Called after a successful declaration, with the day number just declared. */
  onDeclared: (dayNumber: number) => void
}

/**
 * "Plan a social night": declares, or cancels, a day when a drink is allowed.
 * The web's SocialOccasionSheet (src/screens/Today/SocialOccasionSheet.tsx).
 * It is mounted each time it opens, so no day is picked at first: "Pick a
 * day" stands where the web's empty date field does.
 */
export function SocialForm({ challenge, today, todayDayNumber, onClose, onDeclared }: SocialFormProps) {
  const { colors, fonts } = useTheme()
  const [picked, setPicked] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useAnnounceChanges(error ?? '')

  const tomorrow = addDaysISO(today, 1)
  const min = tomorrow > challenge.startDate ? tomorrow : challenge.startDate
  const maxDate = dateForDayNumber(challenge.startDate, CHALLENGE_LENGTH)
  const declaredDays = (challenge.socialDays ?? []).filter((dayNumber) => dayNumber >= todayDayNumber)

  const declare = async () => {
    if (!picked) return
    setSaving(true)
    setError(null)
    try {
      const dayNumber = dayNumberForDate(challenge.startDate, picked)
      const result = await challengeRepo.setSocialDay(challenge.id, dayNumber, true, today)
      if (result.ok) {
        onDeclared(dayNumber)
        onClose()
        return
      }
      switch (result.reason) {
        case 'too-late':
          setError('Declare it the day before at the latest.')
          break
        case 'week-taken':
          setError(`Week ${challengeWeek(dayNumber)} already has one: Day ${result.dayNumber}.`)
          break
        case 'out-of-range':
          setError('Pick a day of this challenge.')
          break
        case 'not-allowed':
          setError("This challenge doesn't allow social occasions.")
          break
      }
    } catch {
      setError(SAVE_FAILED_LINE)
    }
    setSaving(false)
  }

  return (
    <>
      <SheetHeader
        icon="drink"
        title="Plan a social night"
        ruleLine="Tomorrow at the earliest, one per week. On that day a drink is allowed — the diet still counts."
        onClose={onClose}
      />
      <View style={styles.gap}>
        <Field label="Day">
          {picked ? (
            <DateField
              label="Day"
              value={picked}
              min={min}
              max={maxDate}
              onChange={(date) => {
                setPicked(date)
                setError(null)
              }}
            />
          ) : (
            <Button label="Pick a day" variant="secondary" onPress={() => setPicked(min)} disabled={min > maxDate} />
          )}
        </Field>
      </View>

      {error !== null && <Text style={[styles.error, { color: colors.dangerInk, fontFamily: fonts.rounded.semibold }]}>{error}</Text>}

      <View style={styles.actions}>
        <Button label={saving ? 'Saving…' : 'Declare'} onPress={() => void declare()} disabled={saving || !picked} style={styles.action} />
        <Button label="Close" variant="secondary" onPress={onClose} disabled={saving} style={styles.action} />
      </View>

      {declaredDays.length > 0 && (
        <View style={styles.declared}>
          <Text accessibilityRole="header" style={[styles.small, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}>
            Declared
          </Text>
          {declaredDays.map((dayNumber) => (
            <DeclaredRow key={dayNumber} challenge={challenge} today={today} dayNumber={dayNumber} isToday={dayNumber === todayDayNumber} />
          ))}
        </View>
      )}
    </>
  )
}

interface DeclaredRowProps {
  challenge: Challenge
  today: string
  dayNumber: number
  isToday: boolean
}

/**
 * One declared day in the list. Today's row asks before cancelling (it can't
 * be declared again, and losing it flips the diet task); other days cancel as
 * soon as Cancel is tapped.
 */
function DeclaredRow({ challenge, today, dayNumber, isToday }: DeclaredRowProps) {
  const { colors, fonts } = useTheme()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useAnnounceChanges(error ?? '')

  const cancel = async () => {
    setBusy(true)
    setError(null)
    try {
      await challengeRepo.setSocialDay(challenge.id, dayNumber, false, today)
    } catch {
      setError(SAVE_FAILED_LINE)
    }
    setBusy(false)
  }

  const bold = { color: colors.ink, fontFamily: fonts.rounded.bold }
  const alert = error !== null && <Text style={[styles.small, { color: colors.dangerInk, fontFamily: fonts.rounded.semibold }]}>{error}</Text>

  if (isToday && confirming) {
    return (
      <View style={[styles.row, { backgroundColor: colors.canvas }]}>
        <Text style={[styles.small, bold]}>Cancel today&apos;s occasion? You can&apos;t declare today again, and a drink today would break your diet.</Text>
        {alert}
        <View style={styles.rowActions}>
          <Button label={busy ? 'Cancelling…' : 'Cancel it'} variant="danger" onPress={() => void cancel()} disabled={busy} style={styles.action} />
          <Button label="Keep it" variant="secondary" onPress={() => setConfirming(false)} disabled={busy} style={styles.action} />
        </View>
      </View>
    )
  }

  const label = isToday ? `Today · Day ${dayNumber}` : `${formatShortDay(dateForDayNumber(challenge.startDate, dayNumber))} · Day ${dayNumber}`

  return (
    <View style={[styles.row, { backgroundColor: colors.canvas }]}>
      <View style={styles.rowHead}>
        <Text style={[styles.small, styles.rowLabel, bold]}>{label}</Text>
        <Button
          label="Cancel"
          variant="secondary"
          accessibilityLabel={`Cancel Day ${dayNumber}`}
          disabled={busy}
          onPress={() => (isToday ? setConfirming(true) : void cancel())}
        />
      </View>
      {alert}
    </View>
  )
}

const styles = StyleSheet.create({
  gap: { marginTop: 8 },
  small: { fontSize: 14 },
  error: { marginTop: 8, fontSize: 14 },
  actions: { marginTop: 16, flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
  declared: { marginTop: 16, gap: 8 },
  row: { gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowLabel: { flex: 1 },
  rowActions: { flexDirection: 'row', gap: 8 },
})
