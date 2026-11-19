import { DEFAULT_BEDTIME, EARLIEST_BEDTIME, isValidBedtime, LATEST_BEDTIME } from '@logic/menace'
import { SAVE_FAILED_LINE } from '@logic/microcopy'
import { cleanText, isValidName, isValidWhy, NAME_MAX_LENGTH, WHY_MAX_LENGTH, type Profile } from '@logic/profile'
import { rulesFor } from '@logic/rulesets'
import { SETTING_KEYS } from '@logic/settingKeys'
import { isThemePreference, THEME_PREFERENCES, type ThemePreference } from '@logic/theme'
import { dailyRuleLines, DAY_END_LINE, NO_REMINDERS_LINE, stakesLine } from '@logic/variantsCopy'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ImportBackup } from '../backup/ImportBackupFlow'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { TimeField } from '../components/ui/PickerField'
import { Toggle } from '../components/ui/controls'
import { profileRepo } from '../db/repositories/profileRepo'
import { settingsRepo } from '../db/repositories/settingsRepo'
import type { Challenge } from '../db/types'
import { useLiveQuery } from '../db/useLiveQuery'
import { useTheme } from '../theme/ThemeProvider'
import { Card, CardTitle, Input, Muted, StatusLine, settingsStyles } from './rows'

// The web's simple Settings pages: ProfileSection, RulesSection, AppearanceSection, the sound toggle,
// CompanionSection, and what Backup & storage holds on the phone until the cloud backup.

/** Settings → Profile: the name the duck uses and the reason he quotes back. */
export function ProfilePage({ profile }: { profile: Profile }) {
  const [name, setName] = useState(profile.name)
  const [why, setWhy] = useState(profile.why)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const changed = cleanText(name) !== profile.name || cleanText(why) !== profile.why
  const valid = isValidName(name) && isValidWhy(why)

  const save = async () => {
    setSaving(true)
    try {
      const result = await profileRepo.save({ name, why })
      setStatus(result.ok ? 'Saved.' : SAVE_FAILED_LINE)
    } catch {
      setStatus(SAVE_FAILED_LINE)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardTitle>Profile</CardTitle>
      <Field label="Name">
        <Input
          accessibilityLabel="Name"
          value={name}
          maxLength={NAME_MAX_LENGTH}
          autoComplete="given-name"
          onChangeText={(text) => {
            setName(text)
            setStatus(null)
          }}
        />
      </Field>
      <Muted size={12}>Up to {NAME_MAX_LENGTH} characters.</Muted>
      <Field label="Why you're doing this">
        <Input
          accessibilityLabel="Why you're doing this"
          value={why}
          multiline
          maxLength={WHY_MAX_LENGTH}
          onChangeText={(text) => {
            setWhy(text)
            setStatus(null)
          }}
        />
      </Field>
      <Button variant="secondary" label={saving ? 'Saving…' : 'Save'} disabled={saving || !changed || !valid} onPress={() => void save()} style={settingsStyles.top} />
      {status !== null && <StatusLine>{status}</StatusLine>}
    </Card>
  )
}

/** The attempt's rules, in the deal's words, for checking them after onboarding. */
export function RulesPage({ challenge }: { challenge: Challenge }) {
  const { colors, fonts } = useTheme()
  const rules = rulesFor(challenge)
  return (
    <Card gap={16}>
      <View>
        <CardTitle>Every day</CardTitle>
        {dailyRuleLines(rules).map((line) => (
          <View key={line} style={styles.bullet}>
            <Text style={[styles.dot, { color: colors.worldInk }]}>•</Text>
            <Text style={[styles.bulletText, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>{line}</Text>
          </View>
        ))}
      </View>
      <Rule title="Missing a day">{stakesLine(rules)}</Rule>
      <Rule title="When a day ends">{DAY_END_LINE}</Rule>
      <Rule title="Reminders">{NO_REMINDERS_LINE}</Rule>
    </Card>
  )
}

function Rule({ title, children }: { title: string; children: string }) {
  return (
    <View>
      <CardTitle>{title}</CardTitle>
      <Muted>{children}</Muted>
    </View>
  )
}

const THEME_LABELS: Record<ThemePreference, string> = { system: '🖥️ System', light: '☀️ Light', dark: '🌙 Dark' }

/** Reads the saved theme preference ('system' while reading, or when the saved one is unusable). */
export function useThemePreference(): ThemePreference | undefined {
  const saved = useLiveQuery(() => settingsRepo.get<unknown>(SETTING_KEYS.theme, 'system'), [])
  return saved === undefined ? undefined : isThemePreference(saved) ? saved : 'system'
}

export const THEME_NAMES: Record<ThemePreference, string> = { system: 'System', light: 'Light', dark: 'Dark' }

/** Theme picker: follow the system, or force light or dark. */
export function AppearancePage() {
  const { colors, fonts } = useTheme()
  const preference = useThemePreference()
  return (
    <Card>
      <CardTitle>Appearance</CardTitle>
      <View accessibilityRole="radiogroup" accessibilityLabel="Appearance" style={[styles.segments, { backgroundColor: colors.canvas }]}>
        {THEME_PREFERENCES.map((option) => {
          const selected = preference === option
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={THEME_NAMES[option]}
              onPress={() => void settingsRepo.set(SETTING_KEYS.theme, option)}
              style={[styles.segment, selected && { backgroundColor: colors.surface, borderColor: colors.inkMuted, borderWidth: 1 }]}
            >
              <Text style={[styles.segmentText, { color: selected ? colors.ink : colors.inkMuted, fontFamily: fonts.rounded.bold }]}>{THEME_LABELS[option]}</Text>
            </Pressable>
          )
        })}
      </View>
    </Card>
  )
}

/** The sound setting (on unless turned off), `undefined` while reading. */
export function useSoundEnabled(): boolean | undefined {
  return useLiveQuery(() => settingsRepo.get<boolean>(SETTING_KEYS.soundEnabled, true), [])
}

export function SoundPage() {
  const enabled = useSoundEnabled()
  return (
    <Card>
      <Toggle checked={enabled ?? true} onChange={(on) => void settingsRepo.set(SETTING_KEYS.soundEnabled, on)} label="Sound effects" />
    </Card>
  )
}

/** The bedtime the duck counts down to (the default while reading or when the saved one is unusable). */
export function useBedtime(): string | undefined {
  const saved = useLiveQuery(() => settingsRepo.get<unknown>(SETTING_KEYS.bedtime, DEFAULT_BEDTIME), [])
  return saved === undefined ? undefined : typeof saved === 'string' && isValidBedtime(saved) ? saved : DEFAULT_BEDTIME
}

/** The duck's settings: the bedtime his menace counts down to. Saved as it changes, when it is in range. */
export function CompanionPage() {
  const saved = useBedtime()
  // A local draft, so an out-of-range time can be shown while it is being fixed.
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? saved ?? DEFAULT_BEDTIME
  const valid = isValidBedtime(value)
  return (
    <Card>
      <CardTitle>Companion</CardTitle>
      <Field label="Bedtime" error={valid ? undefined : `Pick a time between ${EARLIEST_BEDTIME} and ${LATEST_BEDTIME}.`}>
        <TimeField
          label="Bedtime"
          value={value}
          disabled={saved === undefined}
          onChange={(time) => {
            setDraft(time)
            if (isValidBedtime(time)) void settingsRepo.set(SETTING_KEYS.bedtime, time)
          }}
        />
      </Field>
      <Muted top={8}>
        The duck only gets menacing when what&apos;s left no longer fits before this time. Reading, the photo and the diet only count in the last half hour.
      </Muted>
    </Card>
  )
}

/** Backup & storage on the phone: the web app's backup comes in here; the cloud backup arrives later. */
export function BackupPage() {
  return (
    <Card>
      <CardTitle>Backup & storage</CardTitle>
      <Muted>Everything lives only on this phone for now. Moving from the web app? Bring your attempt over with its backup file.</Muted>
      <View style={settingsStyles.stack}>
        <ImportBackup />
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  bullet: { flexDirection: 'row', gap: 8, marginTop: 4, paddingLeft: 4 },
  dot: { fontSize: 14, lineHeight: 20 },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 20 },
  segments: { marginTop: 12, flexDirection: 'row', gap: 4, borderRadius: 16, padding: 4 },
  segment: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingHorizontal: 4 },
  segmentText: { fontSize: 14 },
})
