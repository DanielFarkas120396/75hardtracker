import { canGiveUp, type ChallengeGate } from '@logic/challengeGate'
import { rulesFor } from '@logic/rulesets'
import { VARIANT_NAMES } from '@logic/variantsCopy'
import { useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Icon } from '../components/icons/Icon'
import { Button } from '../components/ui/Button'
import { Sheet } from '../components/ui/Sheet'
import { bookRepo } from '../db/repositories/bookRepo'
import { eraseEverything } from '../db/erase'
import { useLiveQuery } from '../db/useLiveQuery'
import { KeychainCheck } from '../dev/KeychainCheck'
import { SEEDS } from '../dev/seed'
import { GiveUpFlow } from '../endings/GiveUpFlow'
import { expoStore } from '../files/store'
import { useLockValue } from '../lock/useAppLock'
import { useTabBarHidden } from '../hooks/useTabBar'
import { useTheme } from '../theme/ThemeProvider'
import { useProfile } from '../today/hooks'
import { AppLockPage } from './AppLockPage'
import { BadgesPage } from './BadgesPage'
import { BooksPage } from './BooksPage'
import { ChallengePage } from './ChallengePage'
import { HistoryPage } from './HistoryPage'
import { AppearancePage, BackupPage, CompanionPage, ProfilePage, RulesPage, SoundPage, THEME_NAMES, useBedtime, useSoundEnabled, useThemePreference } from './pages'
import { Confirm, SettingsGroup, SettingsPage, SettingsRow, settingsStyles } from './rows'

type PageId = 'profile' | 'badges' | 'challenge' | 'rules' | 'books' | 'history' | 'appearance' | 'sound' | 'companion' | 'backup' | 'appLock' | 'developer'

const PAGE_TITLES: Record<PageId, string> = {
  profile: 'Profile',
  badges: 'Badges',
  challenge: 'Challenge',
  rules: 'Rules',
  books: 'Books',
  history: 'Attempt history',
  appearance: 'Appearance',
  sound: 'Sound',
  companion: 'Companion',
  backup: 'Backup & storage',
  appLock: 'App lock',
  developer: 'Developer',
}

interface SettingsScreenProps {
  gate: ChallengeGate
  /** The tab is in front. Leaving it goes back to the list, as the web's screen does when it unmounts. */
  focused: boolean
}

/**
 * Settings as a grouped list, like iPhone Settings: compact rows in sections, each opening its own page with the
 * controls. The danger zone acts at once. The web's SettingsScreen, minus "Install the app".
 */
export function SettingsScreen({ gate, focused }: SettingsScreenProps) {
  const { colors, fonts } = useTheme()
  const { challenge, today, todayDayNumber, streak } = gate
  const profile = useProfile()
  const preference = useThemePreference()
  const soundEnabled = useSoundEnabled()
  const bedtime = useBedtime()
  const lockValue = useLockValue()
  const bookCount = useLiveQuery(async () => (await bookRepo.getAll()).length, [])
  const [page, setPage] = useState<PageId | null>(null)
  const [showGiveUp, setShowGiveUp] = useState(false)
  const [showErase, setShowErase] = useState(false)
  const [erasing, setErasing] = useState(false)
  const allowedToGiveUp = canGiveUp(gate)
  // A covering screen (the ending, the peak) brings Today forward: whatever is open here closes.
  const covered = useTabBarHidden()
  if (!focused && page !== null) setPage(null)
  if (covered && (showErase || showGiveUp)) {
    setShowErase(false)
    setShowGiveUp(false)
  }
  // Given up, failed at midnight or finished meanwhile: the next attempt must not open on this flow.
  if (showGiveUp && !allowedToGiveUp) setShowGiveUp(false)

  const erase = async () => {
    setErasing(true)
    try {
      await eraseEverything(expoStore)
    } finally {
      setErasing(false)
      setShowErase(false)
    }
  }

  const back = () => setPage(null)

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <ScrollView key={page ?? 'list'} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {page !== null ? (
          <SettingsPage title={PAGE_TITLES[page]} onBack={back}>
            {page === 'profile' && profile && <ProfilePage profile={profile} />}
            {page === 'badges' && <BadgesPage challengeId={challenge.id} />}
            {page === 'challenge' && challenge.status === 'active' && (
              <ChallengePage key={`${challenge.id}:${challenge.startDate}`} challenge={challenge} today={today} todayDayNumber={todayDayNumber} />
            )}
            {page === 'rules' && <RulesPage challenge={challenge} />}
            {page === 'books' && <BooksPage />}
            {page === 'history' && <HistoryPage today={today} />}
            {page === 'appearance' && <AppearancePage />}
            {page === 'sound' && <SoundPage />}
            {page === 'companion' && <CompanionPage />}
            {page === 'backup' && <BackupPage />}
            {page === 'appLock' && <AppLockPage />}
            {__DEV__ && page === 'developer' && <DeveloperPage />}
          </SettingsPage>
        ) : (
          <>
            <View accessible accessibilityRole="header" accessibilityLabel="Settings" style={styles.header}>
              <Icon name="settings" color={colors.worldInk} />
              <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.display.semibold }]}>Settings</Text>
            </View>
            <View style={styles.groups}>
              <SettingsGroup title="You">
                <SettingsRow icon="profile" label="Profile" value={profile?.name} onPress={() => setPage('profile')} />
                <SettingsRow icon="badge" label="Badges" onPress={() => setPage('badges')} />
              </SettingsGroup>

              <SettingsGroup title="Challenge">
                {challenge.status === 'active' && (
                  <SettingsRow icon="journey" label="Challenge" value={VARIANT_NAMES[rulesFor(challenge).variant]} onPress={() => setPage('challenge')} />
                )}
                <SettingsRow icon="notes" label="Rules" onPress={() => setPage('rules')} />
                <SettingsRow icon="reading" label="Books" value={bookCount ? `${bookCount}` : undefined} onPress={() => setPage('books')} />
                <SettingsRow icon="history" label="Attempt history" onPress={() => setPage('history')} />
              </SettingsGroup>

              <SettingsGroup title="App">
                <SettingsRow icon="appearance" label="Appearance" value={preference ? THEME_NAMES[preference] : undefined} onPress={() => setPage('appearance')} />
                <SettingsRow icon="sound" label="Sound" value={soundEnabled === undefined ? undefined : soundEnabled ? 'On' : 'Off'} onPress={() => setPage('sound')} />
                <SettingsRow icon="companion" label="Companion" value={bedtime ? `Bedtime ${bedtime}` : undefined} onPress={() => setPage('companion')} />
              </SettingsGroup>

              <SettingsGroup title="Privacy & data">
                <SettingsRow icon="lock" label="App lock" value={lockValue} onPress={() => setPage('appLock')} />
                <SettingsRow icon="backup" label="Backup & storage" onPress={() => setPage('backup')} />
              </SettingsGroup>

              {__DEV__ && (
                <SettingsGroup title="Developer" footer="Only in the development app, never in the real one.">
                  <SettingsRow icon="journey" label="Seeds and checks" onPress={() => setPage('developer')} />
                </SettingsGroup>
              )}

              <SettingsGroup
                title="Danger zone"
                footer={
                  allowedToGiveUp
                    ? 'Giving up stops this attempt for good; it stays in your history. Resetting erases every attempt, photo and badge.'
                    : 'Resetting erases every attempt, photo and badge.'
                }
              >
                {allowedToGiveUp && <SettingsRow icon="close" label="Give up this challenge" danger onPress={() => setShowGiveUp(true)} />}
                <SettingsRow icon="warning" label="Reset everything" danger onPress={() => setShowErase(true)} />
              </SettingsGroup>
            </View>
          </>
        )}
      </ScrollView>

      {/* Stays mounted once the row has gone, so the sheet slides away over "You gave up". */}
      <GiveUpFlow open={showGiveUp && allowedToGiveUp} onClose={() => setShowGiveUp(false)} challenge={challenge} today={today} todayDayNumber={todayDayNumber} streak={streak} />

      <Sheet open={showErase} onClose={() => setShowErase(false)} label="Erase everything?">
        <Confirm
          title="Erase everything?"
          body="This deletes every attempt, photo, book, and badge on this phone. This can't be undone."
        >
          <Button variant="danger" label={erasing ? 'Erasing…' : 'Erase everything'} disabled={erasing} style={settingsStyles.flex} onPress={() => void erase()} />
          <Button variant="secondary" label="Cancel" disabled={erasing} style={settingsStyles.flex} onPress={() => setShowErase(false)} />
        </Confirm>
      </Sheet>
    </SafeAreaView>
  )
}

/** The developer's seeds and the keychain check, as the placeholder tab held them. */
function DeveloperPage() {
  return (
    <View style={styles.developer}>
      {SEEDS.map((seed) => (
        <Button
          key={seed.label}
          label={seed.label}
          onPress={() =>
            Alert.alert('Erase everything?', 'This replaces all data on this phone with a test attempt.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Erase', style: 'destructive', onPress: () => void seed.run() },
            ])
          }
        />
      ))}
      <KeychainCheck />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 24, paddingBottom: 16 },
  title: { fontSize: 30 },
  groups: { gap: 20 },
  developer: { gap: 12 },
})
