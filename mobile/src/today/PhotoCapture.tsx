import * as ImagePicker from 'expo-image-picker'
import { useEffect, useState, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { photoRepo } from '../db/repositories/photoRepo'
import { settingsRepo } from '../db/repositories/settingsRepo'
import type { DayEntry } from '../db/types'
import { useLiveQuery } from '../db/useLiveQuery'
import { pictureUri } from '../files/pictures'
import { expoStore, type FileStore } from '../files/store'
import { takeCameraRequest, useCameraRequest } from '../gallery/cameraRequest'
import { CameraSheet, type CameraFacing } from './CameraSheet'
import { useEntryPhoto } from './hooks'
import { prepareShot } from './photo'
import { PhotoCaptureContext } from './photoCaptureContext'

/** The camera used last, kept on this phone (the web keeps it in localStorage). It belongs to the phone: never put it in a backup. */
const FACING_KEY = 'cameraFacing'

interface PhotoCaptureProps {
  entry: DayEntry
  libraryOnly?: boolean
  /** Where pictures go. The phone's documents folder, except in tests. */
  store?: FileStore
  /** The camera is opening: the host closes whatever sits over Today. */
  onCameraOpen?: () => void
  /** The camera couldn't start: the host shows the photo sheet, which says why. */
  onCameraUnavailable?: () => void
  children: ReactNode
}

/**
 * Owns a day's photo: the camera sheet, the library pick and the saving. It
 * sits around the whole Today screen, so the camera outlives the photo sheet
 * that opens it; PhotoTask reads it through usePhotoCapture. The web's
 * PhotoCapture (src/screens/Today/PhotoCapture.tsx).
 */
export function PhotoCapture({ entry, libraryOnly = false, store = expoStore, onCameraOpen, onCameraUnavailable, children }: PhotoCaptureProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraRefused, setCameraRefused] = useState(false)

  const photo = useEntryPhoto(entry.photoId)
  const ghost = useLiveQuery(async () => (await photoRepo.getLatestBefore(entry.date)) ?? null, [entry.date])
  const facing = useLiveQuery(() => settingsRepo.get<CameraFacing>(FACING_KEY, 'back'), [])

  const savePhoto = (uri: string) => photoRepo.replaceForEntry(entry.id, { uri, mimeType: 'image/jpeg' }, store)

  const takePhoto = () => {
    setError(null)
    onCameraOpen?.()
    setCameraOpen(true)
  }

  // The Gallery's "Take today's photo" brings Today forward and opens the camera once.
  const cameraRequest = useCameraRequest()
  useEffect(() => {
    if (cameraRequest !== null && takeCameraRequest(entry.date) && !libraryOnly) takePhoto()
    // Only a new request opens it.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraRequest])

  const chooseFromLibrary = async () => {
    setError(null)
    // The phone's own picker needs no permission: it hands over only what is picked.
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })
    if (picked.canceled) return
    setBusy(true)
    try {
      await savePhoto(await prepareShot(picked.assets[0]))
    } catch {
      setError("Couldn't save that photo. Try again, or free up some space.")
    } finally {
      setBusy(false)
    }
  }

  const cameraUnavailable = () => {
    setCameraOpen(false)
    setCameraRefused(true)
    onCameraUnavailable?.()
  }

  return (
    <PhotoCaptureContext.Provider
      value={{
        photo,
        photoUri: photo ? pictureUri(store, 'photos', photo.file) : undefined,
        busy,
        error,
        cameraRefused,
        cameraOpen,
        libraryOnly,
        takePhoto,
        chooseFromLibrary: () => void chooseFromLibrary(),
      }}
    >
      <View style={styles.fill}>
        {children}
        {cameraOpen && facing !== undefined && (
          <CameraSheet
            ghostUri={ghost ? pictureUri(store, 'photos', ghost.file) : undefined}
            initialFacing={facing === 'front' ? 'front' : 'back'}
            onFacingChange={(next) => void settingsRepo.set(FACING_KEY, next)}
            onCapture={(uri) => {
              // The camera works after all (allowed in Settings since): the photo sheet stops saying otherwise.
              setCameraRefused(false)
              return savePhoto(uri)
            }}
            onClose={() => setCameraOpen(false)}
            onUnavailable={cameraUnavailable}
          />
        )}
      </View>
    </PhotoCaptureContext.Provider>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
})
