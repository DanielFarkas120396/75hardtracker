import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import { photoRepo } from '../../db/repositories/photoRepo'
import type { DayEntry } from '../../db/types'
import { useObjectUrl } from '../../hooks/useObjectUrl'
import { compressImage } from '../../lib/imageCompression'

interface PhotoCardProps {
  entry: DayEntry
  complete: boolean
}

export function PhotoCard({ entry, complete }: PhotoCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const photo = useLiveQuery(async () => {
    if (entry.photoId == null) return undefined
    return photoRepo.getById(entry.photoId)
  }, [entry.photoId])

  const previewUrl = useObjectUrl(photo?.blob)

  const handleFile = async (file: File) => {
    setBusy(true)
    try {
      const compressed = await compressImage(file)
      const photoId = await photoRepo.save({ date: entry.date, blob: compressed })
      await dayEntryRepo.update(entry.id, { photoId })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card complete={complete}>
      <h2 className="font-rounded text-lg font-extrabold text-ink">📸 Photo</h2>
      <p className="mt-1 text-sm text-ink-muted">One progress photo a day.</p>

      <div className="mt-4">
        {previewUrl ? (
          <img src={previewUrl} alt="Today's progress" className="w-full rounded-2xl object-cover" />
        ) : (
          <div className="flex h-40 items-center justify-center rounded-2xl bg-canvas text-ink-muted">
            No photo yet
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
            e.target.value = ''
          }}
        />

        <Button
          variant="secondary"
          className="mt-3 w-full"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? 'Saving…' : previewUrl ? 'Retake photo' : 'Take / upload photo'}
        </Button>
      </div>
    </Card>
  )
}
