import { createContext, useContext } from 'react'
import type { Photo } from '../../db/types'

export interface PhotoCaptureApi {
  photo: Photo | undefined
  busy: boolean
  error: string | null
  /** The in-app camera couldn't start: "Take photo" opens the phone's camera app instead. */
  cameraFailed: boolean
  /** Only a photo from the library (finishing yesterday: the camera would take today's). */
  libraryOnly: boolean
  takePhoto: () => void
  chooseFromLibrary: () => void
}

export const PhotoCaptureContext = createContext<PhotoCaptureApi | null>(null)

/** The day's photo and the ways to take one, from the PhotoCapture above. */
export function usePhotoCapture(): PhotoCaptureApi {
  const api = useContext(PhotoCaptureContext)
  if (!api) throw new Error('usePhotoCapture needs a PhotoCapture above it')
  return api
}
