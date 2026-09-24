import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Toggle } from '../../components/ui/Toggle'
import { challengeRepo } from '../../db/repositories/challengeRepo'
import type { Challenge } from '../../db/types'
import { resetAll } from '../../db/exportImport'
import { useSettings } from '../../hooks/useSettings'
import { AttemptHistorySection } from './AttemptHistorySection'
import { BadgesSection } from './BadgesSection'
import { BooksSection } from './BooksSection'
import { ExportImportSection } from './ExportImportSection'

interface SettingsScreenProps {
  challenge: Challenge
}

export function SettingsScreen({ challenge }: SettingsScreenProps) {
  const { soundEnabled, hapticsEnabled, setSoundEnabled, setHapticsEnabled } = useSettings()
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)

  const confirmReset = async () => {
    setResetting(true)
    await resetAll()
    window.location.reload()
  }

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <header className="px-4 pt-6 pb-4">
        <h1 className="font-rounded text-2xl font-extrabold text-ink">⚙️ Settings</h1>
      </header>

      <main className="flex flex-col gap-4 px-4">
        <section className="rounded-card bg-surface p-4 shadow-sm">
          <h2 className="font-rounded text-lg font-extrabold text-ink">Challenge start date</h2>
          <p className="mt-1 text-sm text-ink-muted">Changing this shifts which day number "today" is.</p>
          <input
            type="date"
            value={challenge.startDate}
            onChange={(e) => void challengeRepo.update(challenge.id, { startDate: e.target.value })}
            className="mt-3 min-h-touch w-full rounded-xl bg-canvas px-3 font-rounded font-bold text-ink"
          />
        </section>

        <BooksSection />

        <BadgesSection challengeId={challenge.id} />

        <section className="rounded-card bg-surface p-4 shadow-sm">
          <h2 className="font-rounded text-lg font-extrabold text-ink">Sound & haptics</h2>
          <div className="mt-3 flex flex-col gap-2">
            <Toggle checked={soundEnabled} onChange={setSoundEnabled} label="Sound effects" />
            <Toggle checked={hapticsEnabled} onChange={setHapticsEnabled} label="Haptic feedback" />
          </div>
        </section>

        <ExportImportSection />

        <AttemptHistorySection />

        <section className="rounded-card bg-surface p-4 shadow-sm">
          <h2 className="font-rounded text-lg font-extrabold text-ink">Danger zone</h2>
          <p className="mt-1 text-sm text-ink-muted">Permanently erase all attempts, photos, and badges.</p>
          <Button variant="danger" className="mt-3 w-full" onClick={() => setShowResetConfirm(true)}>
            Reset everything
          </Button>
        </section>
      </main>

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
