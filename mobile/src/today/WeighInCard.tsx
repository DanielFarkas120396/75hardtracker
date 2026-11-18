import { validateMeasurement } from '@logic/measurements'
import { useEffect, useRef, useState, type ComponentRef } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Icon } from '../components/icons/Icon'
import { measurementRepo } from '../db/repositories/measurementRepo'
import { useLiveQuery } from '../db/useLiveQuery'
import { useAnnounceChanges } from '../hooks/useAnnounce'
import { useNowMinutes } from '../hooks/useNowMinutes'
import { useTheme } from '../theme/ThemeProvider'
import { withAlpha } from '../theme/tokens'

/** From noon, "before breakfast" is no longer advice anyone can follow. */
const NOON = 12 * 60
/** Once saved, the card says what it kept for this long, then leaves. */
export const LOGGED_MS = 550

interface WeighInCardProps {
  today: string
  dayNumber: number
}

/**
 * On Today, under the hero, until today's weight is logged. It never counts
 * toward the day. The web's WeighInCard (src/screens/Today/WeighIn.tsx); its
 * fold as it leaves comes with part 4c.
 */
export function WeighInCard({ today, dayNumber }: WeighInCardProps) {
  // One query, so the card and its hint arrive together, and nothing shows while it loads.
  const state = useLiveQuery(
    async () => ({ weighedToday: (await measurementRepo.getByDate(today)) !== undefined, lastWeight: (await measurementRepo.getLatestWeight()) ?? null }),
    [today],
  )
  // Just saved: the card stays a moment to say so, though today now has its weigh-in.
  const [saved, setSaved] = useState<number>()
  useEffect(() => {
    if (saved === undefined) return
    const timer = setTimeout(() => setSaved(undefined), LOGGED_MS)
    return () => clearTimeout(timer)
  }, [saved])

  if (!state || (state.weighedToday && saved === undefined)) return null
  return <WeighInForm today={today} dayNumber={dayNumber} lastWeight={state.lastWeight ?? undefined} saved={saved} onSaved={setSaved} />
}

function WeighInForm({ today, dayNumber, lastWeight, saved, onSaved }: WeighInCardProps & { lastWeight?: number; saved?: number; onSaved: (kg: number) => void }) {
  const { colors, fonts, mode } = useTheme()
  const [weight, setWeight] = useState('')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const nowMin = useNowMinutes()
  const field = useRef<ComponentRef<typeof TextInput>>(null)

  const save = async () => {
    const result = validateMeasurement({ date: today, weight, body: {} }, today)
    if (!result.ok) {
      setError(result.errors.weight)
      return
    }
    setSaving(true)
    try {
      await measurementRepo.save(result.value)
      // The card stays a moment as it leaves: the keyboard goes now, and the card says what it kept.
      field.current?.blur()
      onSaved(result.value.weight_kg)
    } finally {
      setSaving(false)
    }
  }

  const line =
    saved !== undefined
      ? `${saved.toFixed(1)} kg logged.`
      : dayNumber === 1
        ? 'Your starting weight.'
        : nowMin < NOON
          ? 'Before breakfast is best.'
          : 'Any time today works.'
  useAnnounceChanges(saved !== undefined ? line : (error ?? ''))
  const locked = saving || saved !== undefined

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: saved !== undefined ? colors.world : mode === 'light' ? withAlpha(colors.ink, 0.1) : 'transparent' },
      ]}
    >
      <View style={styles.head}>
        <View style={[styles.well, { backgroundColor: colors.worldSoft }]}>
          {saved !== undefined ? (
            <Text style={[styles.tick, { color: colors.worldInk, fontFamily: fonts.rounded.bold }]}>✓</Text>
          ) : (
            <Icon name="scale" color={colors.worldInk} />
          )}
        </View>
        <View style={styles.titles}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>
            Weigh in
          </Text>
          <Text style={[styles.line, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>{line}</Text>
        </View>
      </View>
      <View style={styles.row}>
        <TextInput
          ref={field}
          accessibilityLabel="Weight in kg"
          value={weight}
          onChangeText={setWeight}
          onSubmitEditing={() => void save()}
          keyboardType="decimal-pad"
          returnKeyType="done"
          autoComplete="off"
          placeholder={lastWeight?.toFixed(1)}
          placeholderTextColor={colors.inkMuted}
          style={[styles.field, { backgroundColor: colors.canvas, color: colors.ink, fontFamily: fonts.rounded.bold }]}
        />
        <Text style={[styles.line, { color: colors.inkMuted, fontFamily: fonts.rounded.bold }]}>kg</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save"
          accessibilityState={{ disabled: locked }}
          disabled={locked}
          onPress={() => void save()}
          style={({ pressed }) => [styles.save, { backgroundColor: colors.world }, pressed && styles.pressed]}
        >
          <Text style={[styles.line, { color: colors.onWorld, fontFamily: fonts.rounded.semibold }]}>Save</Text>
        </Pressable>
      </View>
      {error !== undefined && <Text style={[styles.line, styles.error, { color: colors.dangerInk, fontFamily: fonts.rounded.semibold }]}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 16, borderRadius: 20, borderWidth: 1, padding: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  well: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  tick: { fontSize: 20 },
  titles: { flex: 1, minWidth: 0 },
  title: { fontSize: 16 },
  line: { fontSize: 14 },
  row: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  field: { flex: 1, minHeight: 48, borderRadius: 12, paddingHorizontal: 12, fontSize: 18 },
  save: { minHeight: 48, justifyContent: 'center', borderRadius: 24, paddingHorizontal: 20 },
  pressed: { transform: [{ scale: 0.95 }] },
  error: { marginTop: 4 },
})
