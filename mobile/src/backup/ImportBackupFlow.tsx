import type { EncryptedBackup } from '@logic/backupCrypto'
import { findBackupGap, withGapRestored, type BackupGap, type ExportPayload } from '@logic/backupFormat'
import { openProtectedBackup, readBackupText } from '@logic/backupReading'
import { CHALLENGE_LENGTH } from '@logic/constants'
import { useState, type ReactNode } from 'react'
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { challengeRepo } from '../db/repositories/challengeRepo'
import { expoStore, type FileStore } from '../files/store'
import { useToday } from '../hooks/useToday'
import { useTheme } from '../theme/ThemeProvider'
import { decryptOnPhone } from './decrypt'
import { importBackup, PictureSwapError } from './importBackup'
import { pickBackupFile } from './pickBackupFile'

interface ImportBackupProps {
  /** What the opener says. */
  label?: string
  /** A button (Settings) or a quiet link (the welcome screen). */
  look?: 'button' | 'link'
  /** Where the file's text comes from. The file picker, except in tests. */
  pick?: () => Promise<string | null>
  /** Where pictures go. The phone's documents folder, except in tests. */
  store?: FileStore
}

/**
 * Importing a backup made by the web app: the same steps and wording as its
 * restore (src/components/BackupRestore.tsx). Picks the file, asks for its
 * password if it is protected, confirms the replacement when the phone already
 * holds an attempt, asks about the days the backup can't know about, then imports.
 */
export function ImportBackup({
  label = 'Import a web app backup',
  look = 'button',
  pick = pickBackupFile,
  store = expoStore,
}: ImportBackupProps) {
  const { colors, fonts } = useTheme()
  const today = useToday()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [locked, setLocked] = useState<EncryptedBackup | null>(null)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [pending, setPending] = useState<ExportPayload | null>(null)
  const [gapped, setGapped] = useState<{ payload: ExportPayload; gap: BackupGap } | null>(null)

  const closeLocked = () => {
    setLocked(null)
    setPassword('')
    setPasswordError(null)
  }

  const restore = async (payload: ExportPayload) => {
    setBusy(true)
    try {
      await importBackup(payload, store, today)
      setDone(true)
    } catch (failure) {
      setError(
        failure instanceof PictureSwapError
          ? 'Your data was imported, but its photos aren’t in place yet. Close the app and open it again.'
          : 'Restoring failed. Your existing data was not changed.',
      )
    }
    setBusy(false)
    setPending(null)
    setGapped(null)
  }

  const restoreOrAsk = (payload: ExportPayload) => {
    const gap = findBackupGap(payload, today)
    setPending(null)
    if (gap) setGapped({ payload, gap })
    else void restore(payload)
  }

  const accept = async (payload: ExportPayload) => {
    // A phone with nothing on it has nothing to lose: no need to ask.
    const hasData = (await challengeRepo.getAll()).length > 0
    // The password step closes and the next one opens in the same update, so the sheet stays up.
    closeLocked()
    if (hasData) setPending(payload)
    else restoreOrAsk(payload)
  }

  const start = async () => {
    setError(null)
    setDone(false)
    let text: string | null
    try {
      text = await pick()
    } catch {
      return setError('Could not read that file. Make sure it’s a backup exported from this app.')
    }
    if (text === null) return
    const contents = readBackupText(text)
    if (contents.kind === 'invalid') setError(contents.error)
    else if (contents.kind === 'protected') setLocked(contents.file)
    else await accept(contents.payload)
  }

  const unlock = async () => {
    if (!locked) return
    setBusy(true)
    const result = await openProtectedBackup(locked, password, decryptOnPhone)
    setBusy(false)
    if (!result.ok) return setPasswordError(result.error)
    await accept(result.payload)
  }

  const closeAll = () => {
    closeLocked()
    setPending(null)
    setGapped(null)
  }

  const heading = { color: colors.ink, fontFamily: fonts.rounded.bold }
  const body = { color: colors.inkMuted, fontFamily: fonts.rounded.regular }

  return (
    <View style={styles.block}>
      {look === 'button' ? (
        <Button label={label} onPress={() => void start()} disabled={busy} kind="secondary" />
      ) : (
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void start()} style={styles.link}>
          <Text style={[styles.linkLabel, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}>{label}</Text>
        </Pressable>
      )}
      {error !== null && (
        <Text accessibilityRole="alert" style={[styles.note, { color: colors.dangerInk, fontFamily: fonts.rounded.semibold }]}>
          {error}
        </Text>
      )}
      {done && <Text style={[styles.note, { color: colors.greenInk, fontFamily: fonts.rounded.semibold }]}>Backup imported.</Text>}

      {/* One sheet whose content changes: on iOS a second pop-up opened while the first is closing may never appear. */}
      <Sheet open={locked !== null || pending !== null || gapped !== null} onClose={closeAll}>
        {locked !== null ? (
          <>
            <Text style={[styles.heading, heading]}>This backup is protected</Text>
            <TextInput
              accessibilityLabel="Its password"
              placeholder="Its password"
              placeholderTextColor={colors.inkMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={(text) => {
                setPassword(text)
                setPasswordError(null)
              }}
              style={[styles.input, { color: colors.ink, borderColor: colors.inkMuted, fontFamily: fonts.rounded.regular }]}
            />
            {passwordError !== null && (
              <Text
                accessibilityRole="alert"
                style={[styles.note, { color: colors.dangerInk, fontFamily: fonts.rounded.semibold }]}
              >
                {passwordError}
              </Text>
            )}
            <Button label={busy ? 'Opening…' : 'Open'} onPress={() => void unlock()} disabled={busy || password === ''} />
            <Button label="Cancel" onPress={closeLocked} disabled={busy} kind="secondary" />
          </>
        ) : pending !== null ? (
          <>
            <Text style={[styles.heading, heading]}>Replace all data?</Text>
            <Text style={[styles.text, body]}>
              Restoring this file will replace everything currently on this device — all attempts, photos, and badges —
              with the contents of the file. This can&apos;t be undone.
            </Text>
            <Button
              label={busy ? 'Restoring…' : 'Replace data'}
              onPress={() => restoreOrAsk(pending)}
              disabled={busy}
              kind="danger"
            />
            <Button label="Cancel" onPress={() => setPending(null)} disabled={busy} kind="secondary" />
          </>
        ) : gapped !== null ? (
          <GapQuestion
            gap={gapped.gap}
            busy={busy}
            onDidThem={() => void restore(withGapRestored(gapped.payload, gapped.gap))}
            onMissedThem={() => void restore(gapped.payload)}
            onClose={() => setGapped(null)}
          />
        ) : null}
      </Sheet>
    </View>
  )
}

function GapQuestion(props: {
  gap: BackupGap
  busy: boolean
  onDidThem: () => void
  onMissedThem: () => void
  onClose: () => void
}) {
  const { colors, fonts } = useTheme()
  const { gap, busy } = props
  const first = gap.days[0]
  const last = gap.days[gap.days.length - 1]
  const one = gap.days.length === 1
  const body = [styles.text, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]
  return (
    <>
      <Text style={[styles.heading, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>
        {gap.backupDay < 1 ? 'This backup is from before Day 1' : `This backup stops at Day ${gap.backupDay}`}
      </Text>
      <Text style={body}>
        {gap.todayDayNumber <= CHALLENGE_LENGTH ? `Today is Day ${gap.todayDayNumber}. ` : ''}
        {one ? `Day ${first} isn't in it. Did you do it?` : `Days ${first} to ${last} aren't in it. Did you do them?`}
      </Text>
      <Text style={body}>Their tasks, photos and notes aren&apos;t in the backup either way.</Text>
      <Button label={one ? 'Yes, I did it' : 'Yes, I did them'} onPress={props.onDidThem} disabled={busy} />
      <Button
        label={one ? 'No, count it as missed' : 'No, count them as missed'}
        onPress={props.onMissedThem}
        disabled={busy}
        kind="secondary"
      />
      <Button label="Not now" onPress={props.onClose} disabled={busy} kind="quiet" />
    </>
  )
}

function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const { colors } = useTheme()
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>{children}</View>
      </View>
    </Modal>
  )
}

function Button(props: { label: string; onPress: () => void; disabled?: boolean; kind?: 'primary' | 'secondary' | 'danger' | 'quiet' }) {
  const { colors, fonts } = useTheme()
  const { kind = 'primary' } = props
  const fill = { primary: colors.world, danger: colors.dangerDark, secondary: 'transparent', quiet: 'transparent' }[kind]
  const ink = { primary: colors.onWorld, danger: '#ffffff', secondary: colors.worldInk, quiet: colors.inkMuted }[kind]
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled === true }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={[
        styles.button,
        { backgroundColor: fill, borderColor: kind === 'secondary' ? colors.worldInk : 'transparent' },
        props.disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonLabel, { color: ink, fontFamily: fonts.rounded.bold }]}>{props.label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  block: { alignSelf: 'stretch', gap: 8 },
  note: { fontSize: 15, textAlign: 'center' },
  backdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  card: { gap: 12, borderRadius: 20, padding: 20 },
  heading: { fontSize: 20 },
  text: { fontSize: 16, lineHeight: 22 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, fontSize: 17 },
  button: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 18 },
  buttonLabel: { fontSize: 17 },
  disabled: { opacity: 0.5 },
  link: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  linkLabel: { fontSize: 15, textDecorationLine: 'underline' },
})
