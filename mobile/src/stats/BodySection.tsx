import { formatDisplayDate } from '@logic/dates'
import { attemptWeights, BODY_MEASUREMENTS, validateMeasurement, weightSummary, weightTrend, type BodyMeasurement, type MeasurementErrors } from '@logic/measurements'
import { format, parseISO } from 'date-fns'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Icon } from '../components/icons/Icon'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { DateField } from '../components/ui/PickerField'
import { Sheet } from '../components/ui/Sheet'
import { measurementRepo } from '../db/repositories/measurementRepo'
import type { Measurement } from '../db/types'
import { useLiveQuery } from '../db/useLiveQuery'
import { useTabBarHidden } from '../hooks/useTabBar'
import { useTheme } from '../theme/ThemeProvider'
import { withAlpha } from '../theme/tokens'
import { WeightChart } from './WeightChart'

/** Rows shown before "Show all". */
const COLLAPSED_ROWS = 8

interface BodySectionProps {
  today: string
  /** The attempt's Day 1. */
  startDate: string
  /** The day the attempt has reached (1 to 75). */
  lastDay: number
}

/** What the one sheet holds: the form (a new weigh-in, or one to edit), or the question before deleting one. */
type SheetContent = { kind: 'form'; measurement: Measurement | null } | { kind: 'delete'; measurement: Measurement }

function formatChange(changeKg: number): string {
  if (changeKg === 0) return '±0 kg'
  return `${changeKg > 0 ? '+' : '−'}${Math.abs(changeKg).toFixed(1)} kg`
}

function bodySummary(measurement: Measurement): string {
  const values = measurement.bodyMeasurements_cm ?? {}
  return BODY_MEASUREMENTS.filter((key) => values[key] !== undefined)
    .map((key) => `${key} ${values[key]}`)
    .join(' · ')
}

/**
 * This attempt's weight, compact: the latest weight and its change from the start (or, once a finger has read the
 * chart, that weigh-in), then the chart. The arrow under it unfolds the weigh-ins; a row opens one to edit or delete.
 * The web's BodySection, with its form and its delete question in one sheet.
 */
export function BodySection({ today, startDate, lastDay }: BodySectionProps) {
  const { colors, fonts, mode } = useTheme()
  const measurements = useLiveQuery(() => measurementRepo.getAll(), [])
  const [sheet, setSheet] = useState<SheetContent | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [open, setOpen] = useState(false)
  const [readingDay, setReadingDay] = useState<number | null>(null)
  // A screen that covers the app brings Today forward: the sheet closes first.
  const covered = useTabBarHidden()
  if (covered && sheetOpen) setSheetOpen(false)

  const weighIns = attemptWeights(
    (measurements ?? []).filter((m): m is Measurement & { weight_kg: number } => typeof m.weight_kg === 'number'),
    startDate,
    lastDay,
  )
  const summary = weightSummary(weighIns)
  const trend = weightTrend(weighIns)
  const reading = readingDay === null ? undefined : trend.find((p) => p.day === readingDay)
  // The weigh-in read is gone (deleted, or the chart with it): the header goes back to the latest.
  if (readingDay !== null && measurements !== undefined && (!reading || weighIns.length < 2)) setReadingDay(null)
  const newestFirst = [...weighIns].reverse()
  const rows = showAll ? newestFirst : newestFirst.slice(0, COLLAPSED_ROWS)
  const show = (content: SheetContent) => {
    setSheet(content)
    setSheetOpen(true)
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }, mode === 'light' && { borderWidth: 1, borderColor: withAlpha(colors.ink, 0.1) }]}>
      <View style={styles.top}>
        <Icon name="scale" color={colors.worldInk} />
        {summary ? (
          <View accessible accessibilityRole="header" style={styles.summary}>
            <Text style={[styles.weight, { color: colors.ink, fontFamily: fonts.display.bold }]}>
              {(reading ?? summary.latest).weight_kg.toFixed(1)}
              <Text style={styles.kg}> kg</Text>
            </Text>
            <Text numberOfLines={1} style={[styles.change, { color: colors.inkMuted, fontFamily: fonts.rounded.bold }]}>
              {reading
                ? `${reading.day === 0 ? 'Start' : `Day ${reading.day}`} · ${format(parseISO(reading.date), 'EEE d MMM')} · trend ${reading.trend.toFixed(1)}`
                : summary.changeKg !== undefined
                  ? formatChange(summary.changeKg)
                  : ''}
            </Text>
          </View>
        ) : (
          <Text accessibilityRole="header" style={[styles.title, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>
            Weight
          </Text>
        )}
        <Button label="+ Log" variant="secondary" style={styles.log} onPress={() => show({ kind: 'form', measurement: null })} />
      </View>

      {!summary && (
        <Text style={[styles.note, styles.empty, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>
          No weigh-ins yet. Log your weight — and waist, chest, hips or arms if you like — to see your trend.
        </Text>
      )}

      {weighIns.length >= 2 ? (
        <WeightChart points={trend} lastDay={lastDay} readDay={readingDay} onRead={setReadingDay} />
      ) : (
        summary && <Text style={[styles.note, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>Log another weigh-in to see your trend.</Text>
      )}

      {open && (
        <View style={styles.list}>
          {rows.map((m, i) => {
            const before = newestFirst[i + 1]
            const change = before && Math.round((m.weight_kg - before.weight_kg) * 10) / 10
            const body = bodySummary(m)
            return (
              <Pressable
                key={m.id}
                accessibilityRole="button"
                accessibilityLabel={`Edit weigh-in of ${formatDisplayDate(m.date)}`}
                accessibilityHint={body ? `${body} cm` : undefined}
                onPress={() => show({ kind: 'form', measurement: m })}
                style={[styles.row, { borderTopColor: withAlpha(colors.ink, 0.1) }]}
              >
                <Text style={[styles.rowDay, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}>
                  {m.day === 0 ? 'Start' : `Day ${m.day}`} · {format(parseISO(m.date), 'd MMM')}
                </Text>
                <Text style={[styles.rowWeight, { color: colors.ink, fontFamily: fonts.display.bold }]}>{m.weight_kg.toFixed(1)}</Text>
                <Text style={[styles.rowChange, { color: colors.inkMuted, fontFamily: fonts.rounded.bold }]}>
                  {change === undefined ? '' : change === 0 ? '±0' : `${change < 0 ? '▼' : '▲'} ${Math.abs(change).toFixed(1)}`}
                </Text>
                <View style={styles.ruler}>{body ? <Icon name="ruler" size={14} color={colors.worldInk} /> : null}</View>
              </Pressable>
            )
          })}
          {newestFirst.length > COLLAPSED_ROWS && (
            <Pressable accessibilityRole="button" onPress={() => setShowAll((v) => !v)} style={styles.more}>
              <Text style={[styles.moreText, { color: colors.inkMuted, fontFamily: fonts.rounded.bold }]}>
                {showAll ? 'Show fewer' : `Show all ${newestFirst.length}`}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {weighIns.length > 0 && (
        <Pressable accessibilityRole="button" accessibilityLabel="Weigh-ins" accessibilityState={{ expanded: open }} onPress={() => setOpen((v) => !v)} style={styles.arrow}>
          <View style={{ transform: [{ rotate: open ? '-90deg' : '90deg' }] }}>
            <Icon name="chevron" size={20} color={colors.inkMuted} />
          </View>
        </Pressable>
      )}

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} label={sheet?.kind === 'delete' ? 'Delete this weigh-in?' : 'Weigh-in'}>
        {sheet?.kind === 'form' && (
          <MeasurementForm
            key={sheet.measurement?.id ?? 'new'}
            measurement={sheet.measurement}
            today={today}
            onDone={() => setSheetOpen(false)}
            onDelete={sheet.measurement ? () => setSheet({ kind: 'delete', measurement: sheet.measurement! }) : undefined}
          />
        )}
        {sheet?.kind === 'delete' && (
          <View>
            <Text accessibilityRole="header" style={[styles.sheetTitle, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>
              Delete this weigh-in?
            </Text>
            <Text style={[styles.note, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>
              {formatDisplayDate(sheet.measurement.date)} — this can&apos;t be undone.
            </Text>
            <View style={styles.buttons}>
              <Button
                label="Delete"
                variant="danger"
                style={styles.flex}
                onPress={() => {
                  void measurementRepo.remove(sheet.measurement.id)
                  setSheetOpen(false)
                }}
              />
              <Button label="Cancel" variant="secondary" style={styles.flex} onPress={() => setSheetOpen(false)} />
            </View>
          </View>
        )}
      </Sheet>
    </View>
  )
}

const BODY_LABELS: Record<BodyMeasurement, string> = { waist: 'Waist', chest: 'Chest', hips: 'Hips', arms: 'Arms' }
const numberText = (value: number | undefined) => (value === undefined ? '' : String(value))

interface MeasurementFormProps {
  /** The weigh-in being edited, or `null` for a new one. */
  measurement: Measurement | null
  today: string
  onDone: () => void
  /** Editing only: asks before deleting the weigh-in. */
  onDelete?: () => void
}

/** Add or edit a weigh-in: date, weight in kg, and optional body measurements in cm. The web's MeasurementModal's form. */
function MeasurementForm({ measurement, today, onDone, onDelete }: MeasurementFormProps) {
  const { colors, fonts } = useTheme()
  const [date, setDate] = useState(measurement?.date ?? today)
  const [weight, setWeight] = useState(numberText(measurement?.weight_kg))
  const [body, setBody] = useState<Partial<Record<BodyMeasurement, string>>>(() =>
    Object.fromEntries(BODY_MEASUREMENTS.map((key) => [key, numberText(measurement?.bodyMeasurements_cm?.[key])])),
  )
  const [errors, setErrors] = useState<MeasurementErrors>({})
  const [saving, setSaving] = useState(false)
  const input = [styles.input, { backgroundColor: colors.canvas, color: colors.ink, fontFamily: fonts.rounded.bold }]

  const save = async () => {
    const result = validateMeasurement({ date, weight, body }, today)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setSaving(true)
    try {
      const saved = await measurementRepo.save(result.value, measurement?.id)
      if (!saved.ok) {
        setErrors({ date: `There's already a weigh-in on ${formatDisplayDate(date)} — edit that one instead.` })
        return
      }
      onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <View>
      <Text accessibilityRole="header" style={[styles.sheetTitle, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>
        {measurement ? 'Edit weigh-in' : 'Log a weigh-in'}
      </Text>
      <Field label="Date" error={errors.date}>
        <DateField label="Date" value={date} min="2000-01-01" max={today} onChange={setDate} />
      </Field>
      <Field label="Weight" unit="kg" error={errors.weight}>
        <TextInput accessibilityLabel="Weight" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="82.5" placeholderTextColor={colors.inkMuted} style={[input, styles.big]} />
      </Field>
      <Text style={[styles.optional, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}>Optional measurements (cm)</Text>
      <View style={styles.grid}>
        {BODY_MEASUREMENTS.map((key) => (
          <View key={key} style={styles.half}>
            <Field label={BODY_LABELS[key]} unit="cm" error={errors[key]}>
              <TextInput
                accessibilityLabel={BODY_LABELS[key]}
                value={body[key] ?? ''}
                onChangeText={(text) => setBody((current) => ({ ...current, [key]: text }))}
                keyboardType="decimal-pad"
                style={input}
              />
            </Field>
          </View>
        ))}
      </View>
      <View style={styles.buttons}>
        <Button label={saving ? 'Saving…' : 'Save'} disabled={saving} style={styles.flex} onPress={() => void save()} />
        <Button label="Cancel" variant="secondary" disabled={saving} style={styles.flex} onPress={onDone} />
      </View>
      {measurement && onDelete && (
        <Pressable accessibilityRole="button" disabled={saving} onPress={onDelete} style={styles.delete}>
          <Text style={[styles.deleteText, { color: colors.dangerInk, fontFamily: fonts.rounded.bold }]}>Delete this weigh-in</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 2 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summary: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  weight: { fontSize: 30, lineHeight: 32, letterSpacing: 0.75 },
  kg: { fontSize: 18 },
  change: { flexShrink: 1, fontSize: 12 },
  title: { flex: 1, fontSize: 18 },
  log: { paddingHorizontal: 16 },
  note: { marginTop: 8, fontSize: 14, lineHeight: 20 },
  empty: { marginTop: 4, paddingBottom: 12 },
  list: { marginTop: 8 },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, paddingHorizontal: 2 },
  rowDay: { width: 112, fontSize: 12 },
  rowWeight: { fontSize: 20, letterSpacing: 0.5 },
  rowChange: { marginLeft: 'auto', fontSize: 12 },
  ruler: { width: 16, alignItems: 'center' },
  more: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: 14 },
  arrow: { alignSelf: 'center', width: 64, height: 48, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontSize: 18 },
  input: { minHeight: 48, borderRadius: 12, paddingHorizontal: 12, fontSize: 16 },
  big: { fontSize: 18 },
  optional: { marginTop: 16, fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
  half: { width: '47%', flexGrow: 1 },
  buttons: { marginTop: 20, flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  delete: { marginTop: 8, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  deleteText: { fontSize: 14 },
})
