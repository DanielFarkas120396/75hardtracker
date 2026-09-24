export type SaveOutcome = 'shared' | 'downloaded' | 'cancelled' | 'needsGesture'

/** Phones and tablets: offer the share sheet ("Save to Files", Drive, …) instead of a download. */
function prefersShareSheet(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
}

function canShareFile(file: File): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
}

/** Downloads a file via a temporary link. The link is attached to the page, and the URL outlives the click. */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Some browsers (older Safari) still read the URL after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Saves a backup file: through the share sheet on touch devices that can
 * share it, otherwise as a download. (Android Chrome can't share .json
 * files, so it downloads.) Returns 'needsGesture' when the share sheet
 * refused because preparing the file outlived the tap — call again with
 * `fromFreshTap` from a new tap (which then falls back to a download).
 */
export async function saveBackupFile(file: File, options: { fromFreshTap?: boolean } = {}): Promise<SaveOutcome> {
  if (prefersShareSheet() && canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title: file.name })
      return 'shared'
    } catch (error) {
      const name = error instanceof DOMException ? error.name : ''
      if (name === 'AbortError') return 'cancelled'
      if (name === 'NotAllowedError' && !options.fromFreshTap) return 'needsGesture'
      // Any other failure: fall through to a plain download.
    }
  }
  downloadFile(file)
  return 'downloaded'
}
