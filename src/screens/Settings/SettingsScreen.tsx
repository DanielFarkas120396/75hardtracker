import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Toggle } from '../../components/ui/Toggle'
import type { Challenge } from '../../db/types'
import { resetAll } from '../../db/exportImport'
import { useSettings } from '../../hooks/useSettings'
import { AppearanceSection } from './AppearanceSection'
import { AttemptHistorySection } from './AttemptHistorySection'
import { BadgesSection } from './BadgesSection'
import { BooksSection } from './BooksSection'
import { CompanionSection } from './CompanionSection'
import { ExportImportSection } from './ExportImportSection'
import { GiveUpFlow } from './GiveUpFlow'
import { InstallSection } from './InstallSection'
import { ProfileSection } from './ProfileSection'
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

export function SettingsScreen({ challenge, today, todayDayNumber, streak, canGiveUp }: SettingsScreenProps) {
  const { soundEnabled, hapticsEnabled, bedtime, setSoundEnabled, setHapticsEnabled, setBedtime } = useSettings()
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showGiveUp, setShowGiveUp] = useState(false)
  const [resetting, setResetting] = useState(false)

  const confirmReset = async () => {
    setResetting(true)
    await resetAll()
    window.location.reload()
  }

  return (
    <div className="min-h-dvh bg-canvas pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      <header className="px-4 pt-6 pb-4">
        <h1 className="font-display text-2xl tracking-wide text-ink">⚙️ Settings</h1>
      </header>

      <main className="flex flex-col gap-4 px-4">
        <ProfileSection />

        {challenge.status === 'active' && (
          // Keyed by the saved date so the draft resets whenever it changes.
          <StartDateSection
            key={`${challenge.id}:${challenge.startDate}`}
            challenge={challenge}
            today={today}
            todayDayNumber={todayDayNumber}
          />
        )}

        <InstallSection />

        <AppearanceSection />

        <BooksSection />

        <BadgesSection challengeId={challenge.id} />

        <section className="rounded-card bg-surface p-4 shadow-sm">
          <h2 className="font-rounded text-lg font-extrabold text-ink">Sound & haptics</h2>
          <div className="mt-3 flex flex-col gap-2">
            <Toggle checked={soundEnabled} onChange={setSoundEnabled} label="Sound effects" />
            <Toggle checked={hapticsEnabled} onChange={setHapticsEnabled} label="Haptic feedback" />
          </div>
        </section>

        <CompanionSection bedtime={bedtime} onBedtimeChange={setBedtime} />

        <ExportImportSection today={today} />

        <AttemptHistorySection today={today} />

        <section className="rounded-card bg-surface p-4 shadow-sm">
          <h2 className="font-rounded text-lg font-extrabold text-ink">Danger zone</h2>
          {canGiveUp && (
            <>
              <p className="mt-1 text-sm text-ink-muted">Stop this attempt for good. It stays in your history.</p>
              <Button variant="danger" className="mt-3 w-full" onClick={() => setShowGiveUp(true)}>
                Give up this challenge
              </Button>
            </>
          )}
          <p className={`${canGiveUp ? 'mt-4' : 'mt-1'} text-sm text-ink-muted`}>
            Permanently erase all attempts, photos, and badges.
          </p>
          <Button variant="danger" className="mt-3 w-full" onClick={() => setShowResetConfirm(true)}>
            Reset everything
          </Button>
        </section>
      </main>

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
