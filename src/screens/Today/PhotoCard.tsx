import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence } from 'framer-motion'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BlobImage } from '../../components/BlobImage'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { photoRepo } from '../../db/repositories/photoRepo'
import type { DayEntry } from '../../db/types'
import { isCameraSupported } from '../../lib/camera'
import { compressImage } from '../../lib/imageCompression'
import { CameraSheet } from './CameraSheet'

const PHOTO_CARD_ID = 'today-photo'

interface PhotoCardProps {
  entry: DayEntry
  complete: boolean
  cheer: string
  /** Scroll here and open the camera on arrival (from the Gallery), then call onCameraOpened. */
  openCameraNow?: boolean
  /** Only a photo from the library (finishing yesterday: the camera would take today's). */
  libraryOnly?: boolean
  onCameraOpened?: () => void
}

export function PhotoCard({
  entry,
  complete,
  cheer,
  openCameraNow = false,
  onCameraOpened,
  libraryOnly = false,
}: PhotoCardProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const libraryInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Arriving from the Gallery's "take a photo", the in-app camera opens straight away.
  const [cameraOpen, setCameraOpen] = useState(() => openCameraNow && isCameraSupported())
  const [cameraFailed, setCameraFailed] = useState(false)

  const photo = useLiveQuery(async () => {
    if (entry.photoId == null) return undefined
    return photoRepo.getById(entry.photoId)
  }, [entry.photoId])

  const ghost = useLiveQuery(() => photoRepo.getLatestBefore(entry.date), [entry.date])

  const savePhoto = async (image: Blob) => {
    const compressed = await compressImage(image)
    await photoRepo.replaceForEntry(entry.id, compressed)
  }

  const handleFile = async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      await savePhoto(file)
    } catch {
      setError("Couldn't save that photo — try another one.")
    } finally {
      setBusy(false)
    }
  }

  const openCamera = () => {
    setError(null)
    // Without in-app camera support, the file input's `capture` opens the phone's camera app instead.
    if (cameraFailed || !isCameraSupported()) return cameraInputRef.current?.click()
    setCameraOpen(true)
  }

  const onArrival = useEffectEvent(() => {
    document.getElementById(PHOTO_CARD_ID)?.scrollIntoView({ block: 'center' })
    onCameraOpened?.()
  })
  useEffect(() => {
    if (openCameraNow) onArrival()
  }, [openCameraNow])

  const onCameraUnavailable = () => {
    setCameraOpen(false)
    setCameraFailed(true)
  }

  const onFileChosen = (input: HTMLInputElement) => {
    const file = input.files?.[0]
    if (file) void handleFile(file)
    input.value = ''
  }

  return (
    <Card id={PHOTO_CARD_ID} complete={complete} cheer={cheer} title="Photo" icon="photo" summary="Taken">
      <p className="mt-1 text-sm text-ink-muted">
        {libraryOnly ? "Yesterday's photo, from your library." : 'One progress photo a day.'}
      </p>

      <div className="mt-4">
        {photo ? (
          <BlobImage blob={photo.blob} alt="Today's progress" className="w-full rounded-2xl object-cover" />
        ) : (
          <div className="flex h-40 items-center justify-center rounded-2xl bg-canvas text-ink-muted">
            No photo yet
          </div>
        )}

        {/* `capture` opens the camera directly on phones, but also hides the library — so there are two inputs. */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onFileChosen(e.target)}
        />
        <input
          ref={libraryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFileChosen(e.target)}
        />

        {cameraFailed && (
          <p className="mt-2 text-sm text-ink-muted">
            The in-app camera isn't available — 📷 will open your phone's camera instead.
          </p>
        )}

        <div className="mt-3 flex flex-col gap-2">
          {!libraryOnly && (
            <Button variant="secondary" onClick={openCamera} disabled={busy}>
              {busy ? 'Saving…' : photo ? '📷 Retake photo' : '📷 Take photo'}
            </Button>
          )}
          <Button variant="secondary" onClick={() => libraryInputRef.current?.click()} disabled={busy}>
            {busy && libraryOnly ? 'Saving…' : '🖼️ Choose from library'}
          </Button>
        </div>

        {error && (
          <p role="alert" className="mt-2 text-sm font-semibold text-danger-ink">
            {error}
          </p>
        )}
      </div>

      {/* Portalled: the card's own stacking context would otherwise trap the sheet under the bottom nav. */}
      {createPortal(
        <AnimatePresence>
          {cameraOpen && (
            <CameraSheet
              ghost={ghost?.blob}
              onCapture={savePhoto}
              onClose={() => setCameraOpen(false)}
              onUnavailable={onCameraUnavailable}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </Card>
  )
}
