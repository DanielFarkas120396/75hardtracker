import type { Mood } from '@logic/moods'
import type { Ruleset } from '@logic/rulesets'
import { dietToggleLabel, formatLiters } from '@logic/variantsCopy'
import { useEffect, useRef, useState } from 'react'
import { Image, Linking, StyleSheet, Text, TextInput, View } from 'react-native'
import { Icon } from '../components/icons/Icon'
import { Button } from '../components/ui/Button'
import { MoodPicker, Stepper, Toggle } from '../components/ui/controls'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import type { DayEntry } from '../db/types'
import { useAnnounceChanges } from '../hooks/useAnnounce'
import { useTheme } from '../theme/ThemeProvider'
import { usePhotoCapture } from './photoCaptureContext'

// The bodies of the diet, water, notes and photo sheets, as on the web
// (src/screens/Today/DietTask.tsx, WaterTask.tsx, DayNotesTask.tsx, PhotoTask.tsx).

interface DietTaskProps {
  entry: DayEntry
  rules: Ruleset
  /** Whether today is a declared social occasion: a drink is allowed. */
  socialToday: boolean
}

/** The diet sheet's body: the two ticks. Planning a social night comes with part 4b. */
export function DietTask({ entry, rules, socialToday }: DietTaskProps) {
  const { colors, fonts } = useTheme()
  return (
    <View style={styles.column}>
      <Toggle
        checked={entry.dietFollowed}
        onChange={(checked) => void dayEntryRepo.update(entry.id, { dietFollowed: checked })}
        label={dietToggleLabel(rules)}
        icon={<Icon name="diet" size={20} color={colors.worldInk} />}
      />
      {socialToday ? (
        <View style={[styles.social, { backgroundColor: colors.canvas }]}>
          <Icon name="drink" size={18} color={colors.worldInk} />
          <Text style={[styles.socialText, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>Social night today — a drink is allowed.</Text>
        </View>
      ) : (
        <Toggle
          checked={entry.noAlcohol}
          onChange={(checked) => void dayEntryRepo.update(entry.id, { noAlcohol: checked })}
          label="No alcohol"
          icon={<Icon name="noDrink" size={20} color={colors.worldInk} />}
        />
      )}
    </View>
  )
}

/** "Other amount": a 330 ml can to start, in 50 ml steps, up to a 2 L jug. */
const OTHER_START_ML = 330
const OTHER_STEP_ML = 50
const OTHER_MAX_ML = 2000

/** The water sheet's body: the bottle, and the pours. A glass is the one primary action, like the tile's "+ 250 ml". */
export function WaterTask({ entry, rules }: { entry: DayEntry; rules: Ruleset }) {
  const { colors, fonts } = useTheme()
  const [otherMl, setOtherMl] = useState(OTHER_START_ML)
  const addWater = (deltaMl: number) => {
    void dayEntryRepo.adjustWater(entry.id, deltaMl)
  }
  const fill = Math.min(1, entry.water_ml / rules.waterTargetMl)

  return (
    <View>
      <View style={styles.bottleRow}>
        <View style={[styles.bottle, { borderColor: colors.world, backgroundColor: colors.worldSoft }]}>
          <View style={[styles.bottleFill, { backgroundColor: colors.world, height: `${fill * 100}%` }]} />
        </View>
        <View>
          <Text style={[styles.big, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>{formatLiters(entry.water_ml)} L</Text>
          <Text style={[styles.small, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>of {formatLiters(rules.waterTargetMl)} L</Text>
        </View>
      </View>

      <View style={styles.pours}>
        <Button label="+ 250 ml" onPress={() => addWater(250)} style={styles.pour} />
        <Button label="+ 500 ml" variant="soft" onPress={() => addWater(500)} style={styles.pour} />
        <Button label="− 250 ml" variant="secondary" onPress={() => addWater(-250)} disabled={entry.water_ml === 0} style={styles.pour} />
      </View>

      {/* For a can or a bottle that isn't a glass: any amount in 50 ml steps. */}
      <Text style={[styles.label, styles.gap, { color: colors.inkMuted, fontFamily: fonts.rounded.bold }]}>Other amount</Text>
      <View style={[styles.other, { backgroundColor: colors.canvas }]}>
        <Stepper
          value={otherMl}
          onStep={(delta) => setOtherMl((ml) => Math.min(OTHER_MAX_ML, Math.max(OTHER_STEP_ML, ml + delta)))}
          step={OTHER_STEP_ML}
          min={OTHER_STEP_ML}
          max={OTHER_MAX_ML}
          unit="ml"
        />
        <Button label="Add" variant="secondary" accessibilityLabel={`Add ${otherMl} ml`} onPress={() => addWater(otherMl)} style={styles.add} />
      </View>
    </View>
  )
}

/** The mood sheet's body: the five moods and the notes. Neither counts toward completing the day. */
export function DayNotesTask({ entry }: { entry: DayEntry }) {
  const { colors } = useTheme()
  const setMood = (mood: Mood) => {
    void dayEntryRepo.update(entry.id, { mood: entry.mood === mood ? undefined : mood })
  }
  return (
    <View>
      <MoodPicker label="Mood" value={entry.mood} onPick={setMood} selected={{ fill: colors.yellowLight, ring: colors.yellowInk }} />
      {/* Keyed by entry so the text resets on a new day. */}
      <NotesField key={entry.id} entry={entry} />
    </View>
  )
}

/** How long typing has to pause before notes are saved. */
export const NOTES_SAVE_DELAY_MS = 600

/** Blank notes are stored as "no notes". */
const toNotes = (value: string) => (value.trim() === '' ? undefined : value)

/** Notes are saved once typing pauses, when the field is left, and, if still pending, when the sheet closes. */
function NotesField({ entry }: { entry: DayEntry }) {
  const { colors, fonts } = useTheme()
  const [text, setText] = useState(entry.notes ?? '')
  const [saved, setSaved] = useState(true)
  const pending = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // This field is keyed by entry, so the id never changes here.
  const entryId = entry.id

  const flush = () => {
    clearTimeout(timer.current)
    if (pending.current === null) return
    void dayEntryRepo.update(entryId, { notes: toNotes(pending.current) }).then(() => setSaved(true))
    pending.current = null
  }

  // Closing the sheet mid-sentence: what's still pending is saved.
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      if (pending.current !== null) void dayEntryRepo.update(entryId, { notes: toNotes(pending.current) })
    },
    [entryId],
  )

  const onChange = (value: string) => {
    setText(value)
    setSaved(false)
    pending.current = value
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, NOTES_SAVE_DELAY_MS)
  }

  const status = saved ? (text ? 'Saved' : '') : 'Saving…'
  useAnnounceChanges(status === 'Saved' ? status : '')

  return (
    <View style={styles.gap}>
      <View style={styles.notesHead}>
        <Text style={[styles.label, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}>Notes</Text>
        <Text style={[styles.tiny, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>{status}</Text>
      </View>
      <TextInput
        accessibilityLabel="Notes"
        value={text}
        onChangeText={onChange}
        onBlur={flush}
        multiline
        placeholder="What went well? What was hard?"
        placeholderTextColor={colors.inkMuted}
        style={[styles.notes, { backgroundColor: colors.canvas, color: colors.ink, fontFamily: fonts.rounded.regular }]}
      />
    </View>
  )
}

/** The photo sheet's body: the day's photo, and the ways to take or pick one. */
export function PhotoTask() {
  const { colors, fonts } = useTheme()
  const { photoUri, busy, error, cameraRefused, libraryOnly, takePhoto, chooseFromLibrary } = usePhotoCapture()
  const iconColor = busy ? colors.inkMuted : colors.worldInk

  return (
    <View>
      {photoUri ? (
        // ponytail: shown in a 3:4 frame, cropped to fill. Keep the picture's own shape if photos ever come in others.
        <Image source={{ uri: photoUri }} accessibilityLabel="Today's progress" style={styles.photo} />
      ) : (
        <View style={[styles.noPhoto, { backgroundColor: colors.canvas }]}>
          <Text style={[styles.base, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>No photo yet</Text>
        </View>
      )}

      {cameraRefused && (
        // Typed for the phone: the web's line promises another camera, and here there is only the permission.
        <View style={styles.gapSmall}>
          <Text style={[styles.label, { color: colors.ink, fontFamily: fonts.rounded.semibold }]}>
            The camera isn't allowed for this app. Allow it in Settings, or choose a photo from your library.
          </Text>
          <Button label="Open Settings" variant="secondary" onPress={() => void Linking.openSettings()} style={styles.gapSmall} />
        </View>
      )}

      <View style={[styles.column, styles.gapSmall]}>
        {!libraryOnly && (
          <Button
            label={busy ? 'Saving…' : photoUri ? 'Retake photo' : 'Take photo'}
            variant="secondary"
            onPress={takePhoto}
            disabled={busy}
            icon={busy ? undefined : <Icon name="photo" size={18} color={iconColor} />}
          />
        )}
        <Button
          label={busy && libraryOnly ? 'Saving…' : 'Choose from library'}
          variant="secondary"
          onPress={chooseFromLibrary}
          disabled={busy}
          icon={busy && libraryOnly ? undefined : <Icon name="gallery" size={18} color={iconColor} />}
        />
      </View>

      {error !== null && (
        <Text accessibilityRole="alert" style={[styles.label, styles.gapSmall, { color: colors.dangerInk, fontFamily: fonts.rounded.semibold }]}>
          {error}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  column: { gap: 8 },
  gap: { marginTop: 16 },
  gapSmall: { marginTop: 8 },
  social: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  socialText: { flex: 1, fontSize: 14 },
  bottleRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  bottle: { width: 56, height: 96, justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 16, borderWidth: 2 },
  bottleFill: { width: '100%' },
  big: { fontSize: 24 },
  small: { fontSize: 14 },
  base: { fontSize: 16 },
  tiny: { fontSize: 12 },
  label: { fontSize: 14 },
  pours: { marginTop: 16, flexDirection: 'row', gap: 8 },
  pour: { flex: 1, paddingHorizontal: 8 },
  other: { marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderRadius: 16, padding: 8 },
  add: { paddingHorizontal: 16 },
  notesHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  notes: { marginTop: 4, minHeight: 88, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 16, textAlignVertical: 'top' },
  photo: { width: '100%', aspectRatio: 3 / 4, borderRadius: 16 },
  noPhoto: { height: 160, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
})
