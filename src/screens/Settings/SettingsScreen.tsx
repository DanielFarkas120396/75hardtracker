import { useLiveQuery } from 'dexie-react-hooks'
import { useState, useSyncExternalStore } from 'react'
import { Icon } from '../../components/icons/Icon'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Toggle } from '../../components/ui/Toggle'
import { VARIANT_NAMES } from '../../content/variants'
import { appLockRepo } from '../../db/repositories/appLockRepo'
import { bookRepo } from '../../db/repositories/bookRepo'
import type { Challenge } from '../../db/types'
import { resetAll } from '../../db/exportImport'
import { useProfile } from '../../hooks/useProfile'
import { useSettings } from '../../hooks/useSettings'
import { useThemeSetting } from '../../hooks/useThemePreference'
import { isTimeTravelling } from '../../dev/timeTravel'
import { TimeTravelPanel } from '../../dev/TimeTravelPanel'
import { getInstallState, subscribeToInstallState } from '../../lib/installPrompt'
import { rulesFor } from '../../logic/rulesets'
import { AppearanceSection } from './AppearanceSection'
import { AppLockSection } from './AppLockSection'
import { AttemptHistorySection } from './AttemptHistorySection'
import { BadgesSection } from './BadgesSection'
import { BooksSection } from './BooksSection'
import { CompanionSection } from './CompanionSection'
import { ExportImportSection } from './ExportImportSection'
import { GiveUpFlow } from './GiveUpFlow'
import { InstallSection } from './InstallSection'
import { ProfileSection } from './ProfileSection'
import { SettingsGroup, SettingsPage, SettingsRow } from './SettingsRows'
import { StartDateSection } from './StartDateSection'

interface SettingsScreenProps {
  challenge: Challenge
  today: string
  todayDayNumber: number
  /** The running attempt's streak, shown by the give-up flow. */
  streak: number
  /** True while the attempt can be given up: the gate is active and today is Day 1–75. */
  canGiveUp: boolean
}

type PageId = 'profile' | 'badges' | 'challenge' | 'books' | 'history' | 'appearance' | 'sound' | 'companion' | 'install' | 'backup' | 'appLock' | 'timeTravel'

const PAGE_TITLES: Record<PageId, string> = {
  profile: 'Profile',
  badges: 'Badges',
  challenge: 'Challenge',
  books: 'Books',
  history: 'Attempt history',
  appearance: 'Appearance',
  sound: 'Sound & haptics',
  companion: 'Companion',
  install: 'Install the app',
  backup: 'Backup & storage',
  appLock: 'App lock',
  timeTravel: 'Time travel',
}

const THEME_LABELS = { system: 'System', light: 'Light', dark: 'Dark' } as const

/**
 * Settings as a grouped list, like iPhone Settings: compact rows in sections,
 * each opening its own page with the controls. The danger zone acts at once.
 */
export function SettingsScreen({ challenge, today, todayDayNumber, streak, canGiveUp }: SettingsScreenProps) {
  const settings = useSettings()
  const profile = useProfile()
  const { preference } = useThemeSetting()
  const bookCount = useLiveQuery(() => bookRepo.getAll().then((books) => books.length), [])
  const lockValue = useLiveQuery(
    () =>
      appLockRepo.get().then((config) => (!config ? 'Off' : config.credentialId ? (config.pin ? 'PIN + Face ID' : 'Face ID') : 'PIN')),
    [],
  )
  const installState = useSyncExternalStore(subscribeToInstallState, getInstallState)
  const [page, setPage] = useState<PageId | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showGiveUp, setShowGiveUp] = useState(false)
  const [resetting, setResetting] = useState(false)

  const open = (id: PageId) => {
    setPage(id)
    window.scrollTo(0, 0)
  }

  const confirmReset = async () => {
    setResetting(true)
    await resetAll()
    window.location.reload()
  }

  const soundValue =
    settings.soundEnabled && settings.hapticsEnabled
      ? 'On'
      : settings.soundEnabled
        ? 'Sound only'
        : settings.hapticsEnabled
          ? 'Haptics only'
          : 'Off'

  return (
    <div className="min-h-dvh bg-canvas pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      {page ? (
        <SettingsPage title={PAGE_TITLES[page]} onBack={() => setPage(null)}>
          {page === 'profile' && <ProfileSection />}
          {page === 'badges' && <BadgesSection challengeId={challenge.id} />}
          {page === 'challenge' && challenge.status === 'active' && (
            // Keyed by the saved date so the draft resets whenever it changes.
            <StartDateSection
              key={`${challenge.id}:${challenge.startDate}`}
              challenge={challenge}
              today={today}
              todayDayNumber={todayDayNumber}
            />
          )}
          {page === 'books' && <BooksSection />}
          {page === 'history' && <AttemptHistorySection today={today} />}
          {page === 'appearance' && <AppearanceSection />}
          {page === 'sound' && (
            <section className="flex flex-col gap-2 rounded-card bg-surface p-4 shadow-sm ring-1 ring-ink/10 dark:ring-0">
              <Toggle checked={settings.soundEnabled} onChange={settings.setSoundEnabled} label="Sound effects" />
              <Toggle checked={settings.hapticsEnabled} onChange={settings.setHapticsEnabled} label="Haptic feedback" />
            </section>
          )}
          {page === 'companion' && <CompanionSection bedtime={settings.bedtime} onBedtimeChange={settings.setBedtime} />}
          {page === 'install' && <InstallSection />}
          {page === 'backup' && <ExportImportSection today={today} />}
          {page === 'appLock' && <AppLockSection />}
          {import.meta.env.DEV && page === 'timeTravel' && <TimeTravelPanel />}
        </SettingsPage>
      ) : (
        <>
          <header className="px-4 pt-6 pb-4">
            <h1 className="flex items-center gap-2 font-display text-2xl tracking-wide text-ink">
              <Icon name="settings" className="text-world-ink" />
              Settings
            </h1>
          </header>

          <main className="flex flex-col gap-5 px-4">
            <SettingsGroup title="You">
              <SettingsRow icon="profile" label="Profile" value={profile?.name} onClick={() => open('profile')} />
              <SettingsRow icon="badge" label="Badges" onClick={() => open('badges')} />
            </SettingsGroup>

            <SettingsGroup title="Challenge">
              {challenge.status === 'active' && (
                <SettingsRow
                  icon="journey"
                  label="Challenge"
                  value={VARIANT_NAMES[rulesFor(challenge).variant]}
                  onClick={() => open('challenge')}
                />
              )}
              <SettingsRow
                icon="reading"
                label="Books"
                value={bookCount ? `${bookCount}` : undefined}
                onClick={() => open('books')}
              />
              <SettingsRow icon="history" label="Attempt history" onClick={() => open('history')} />
            </SettingsGroup>

            <SettingsGroup title="App">
              <SettingsRow
                icon="appearance"
                label="Appearance"
                value={preference ? THEME_LABELS[preference] : undefined}
                onClick={() => open('appearance')}
              />
              <SettingsRow icon="sound" label="Sound & haptics" value={soundValue} onClick={() => open('sound')} />
              <SettingsRow icon="companion" label="Companion" value={`Bedtime ${settings.bedtime}`} onClick={() => open('companion')} />
              <SettingsRow
                icon="install"
                label="Install the app"
                value={installState === 'installed' ? 'Installed' : undefined}
                onClick={() => open('install')}
              />
            </SettingsGroup>

            <SettingsGroup title="Privacy & data">
              <SettingsRow icon="lock" label="App lock" value={lockValue} onClick={() => open('appLock')} />
              <SettingsRow icon="backup" label="Backup & storage" onClick={() => open('backup')} />
            </SettingsGroup>

            {import.meta.env.DEV && (
              <SettingsGroup title="Developer" footer="Only in the dev server, never in the real app.">
                <SettingsRow
                  icon="journey"
                  label="Time travel"
                  value={isTimeTravelling() ? 'On' : undefined}
                  onClick={() => open('timeTravel')}
                />
              </SettingsGroup>
            )}

            <SettingsGroup
              title="Danger zone"
              footer={
                canGiveUp
                  ? 'Giving up stops this attempt for good; it stays in your history. Resetting erases every attempt, photo and badge.'
                  : 'Resetting erases every attempt, photo and badge.'
              }
            >
              {canGiveUp && (
                <SettingsRow icon="close" label="Give up this challenge" danger onClick={() => setShowGiveUp(true)} />
              )}
              <SettingsRow icon="warning" label="Reset everything" danger onClick={() => setShowResetConfirm(true)} />
            </SettingsGroup>
          </main>
        </>
      )}

      <GiveUpFlow
        open={showGiveUp && canGiveUp}
        onClose={() => setShowGiveUp(false)}
        challenge={challenge}
        today={today}
        todayDayNumber={todayDayNumber}
        streak={streak}
      />

      <Modal open={showResetConfirm} onClose={() => setShowResetConfirm(false)}>
        <h3 className="font-rounded text-lg font-extrabold text-ink">Erase everything?</h3>
        <p className="mt-2 text-sm text-ink-muted">
          This deletes every attempt, photo, book, and badge on this device. Consider exporting a backup first.
          This can't be undone.
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="danger" className="flex-1" onClick={() => void confirmReset()} disabled={resetting}>
            {resetting ? 'Erasing…' : 'Erase everything'}
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setShowResetConfirm(false)}
            disabled={resetting}
          >
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  )
}
