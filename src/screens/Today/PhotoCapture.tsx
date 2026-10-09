import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence } from 'framer-motion'
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { photoRepo } from '../../db/repositories/photoRepo'
import type { DayEntry } from '../../db/types'
import { useEntryPhoto } from '../../hooks/useEntryPhoto'
import { isCameraSupported } from '../../lib/camera'
import { compressImage } from '../../lib/imageCompression'
import { CameraSheet } from './CameraSheet'
import { PhotoCaptureContext } from './photoCaptureContext'

interface PhotoCaptureProps {
  entry: DayEntry
  libraryOnly?: boolean
  /** Open the camera on arrival (from the Gallery), then call onCameraOpened. */
  openCameraNow?: boolean
  onCameraOpened?: () => void
  /** The camera (or the phone's camera app) is opening: the host can close whatever sits over Today. */
  onCameraOpen?: () => void
  children: ReactNode
}

/**
 * Owns a day's photo: the camera sheet, the file inputs and the saving. It
 * sits around the whole Today screen, so the camera outlives the photo
 * sheet that opens it; PhotoTask reads it through usePhotoCapture
 * (photoCaptureContext.ts).
 */
export function PhotoCapture({
  entry,
  libraryOnly = false,
  openCameraNow = false,
  onCameraOpened,
  onCameraOpen,
  children,
}: PhotoCaptureProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const libraryInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Arriving from the Gallery's "take a photo", the in-app camera opens straight away.
  const [cameraOpen, setCameraOpen] = useState(() => openCameraNow && !libraryOnly && isCameraSupported())
  const [cameraFailed, setCameraFailed] = useState(false)

  const photo = useEntryPhoto(entry.photoId)
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

  const takePhoto = () => {
    setError(null)
    onCameraOpen?.()
    // Without in-app camera support, the file input's `capture` opens the phone's camera app instead.
    if (cameraFailed || !isCameraSupported()) return cameraInputRef.current?.click()
    setCameraOpen(true)
  }

  const chooseFromLibrary = () => {
    setError(null)
    libraryInputRef.current?.click()
  }

  const onArrival = useEffectEvent(() => onCameraOpened?.())
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
    <PhotoCaptureContext.Provider value={{ photo, busy, error, cameraFailed, cameraOpen, libraryOnly, takePhoto, chooseFromLibrary }}>
      {children}

      {/* `capture` opens the camera directly on phones, but also hides the library — so there are two inputs. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onFileChosen(e.target)}
      />
      <input ref={libraryInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFileChosen(e.target)} />

      {/* Portalled: a stacking context in the page would otherwise trap the sheet under the bottom nav. */}
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
    </PhotoCaptureContext.Provider>
  )
}
