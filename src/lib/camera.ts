/**
 * Thin wrappers around getUserMedia for the in-app progress-photo camera.
 * The viewfinder is a 3:4 portrait box with `object-fit: cover`, so a capture
 * crops the frame the same way: the saved photo is exactly what was on screen.
 */

export type CameraFacing = 'environment' | 'user'

/** Portrait 3:4, matching the viewfinder. */
export const CAPTURE_ASPECT = 3 / 4

const FACING_STORAGE_KEY = '75hard.cameraFacing'

export function isCameraSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'
}

export function startCamera(facing: CameraFacing): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1920 } },
  })
}

export function stopCamera(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop())
}

/** The centred source rectangle that fills an `aspect` (width / height) box, like `object-fit: cover`. */
export function coverCrop(srcWidth: number, srcHeight: number, aspect: number) {
  if (srcWidth / srcHeight > aspect) {
    const sw = Math.round(srcHeight * aspect)
    return { sx: Math.round((srcWidth - sw) / 2), sy: 0, sw, sh: srcHeight }
  }
  const sh = Math.round(srcWidth / aspect)
  return { sx: 0, sy: Math.round((srcHeight - sh) / 2), sw: srcWidth, sh }
}

/** Grabs the current frame, cropped to the viewfinder and mirrored when the preview is. */
export function captureFrame(video: HTMLVideoElement, mirror: boolean): Promise<Blob> {
  const { videoWidth, videoHeight } = video
  if (!videoWidth || !videoHeight) return Promise.reject(new Error('Camera not ready'))

  const { sx, sy, sw, sh } = coverCrop(videoWidth, videoHeight, CAPTURE_ASPECT)
  const canvas = document.createElement('canvas')
  canvas.width = sw
  canvas.height = sh
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Canvas 2D context unavailable'))

  if (mirror) {
    ctx.translate(sw, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Capture failed'))), 'image/jpeg', 0.92)
  })
}

/** The last camera used, per device. Storage can be unavailable (private mode), so it falls back to the back camera. */
export function loadFacing(): CameraFacing {
  try {
    return localStorage.getItem(FACING_STORAGE_KEY) === 'user' ? 'user' : 'environment'
  } catch {
    return 'environment'
  }
}

export function saveFacing(facing: CameraFacing): void {
  try {
    localStorage.setItem(FACING_STORAGE_KEY, facing)
  } catch {
    // A per-device convenience; losing it is harmless.
  }
}
