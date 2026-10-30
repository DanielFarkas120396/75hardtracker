const LAST_RELOAD_KEY = 'stale-chunk-reload'
/** A chunk still missing this soon after a reload isn't a stale page: reloading again would only loop. */
const RETRY_AFTER_MS = 30_000

function mayReload(now: number): boolean {
  try {
    const last = Number(sessionStorage.getItem(LAST_RELOAD_KEY))
    if (now - last < RETRY_AFTER_MS) return false
    sessionStorage.setItem(LAST_RELOAD_KEY, String(now))
    return true
  } catch {
    return false
  }
}

/**
 * After a deploy, the first launch still runs the old page while the new service worker removes
 * the old chunks, so the next screen to load fails. A reload picks up the new version.
 */
export function listenForStaleChunks(reload = () => window.location.reload(), clock = Date.now): () => void {
  const onFailedChunk = () => {
    if (mayReload(clock())) reload()
  }
  window.addEventListener('vite:preloadError', onFailedChunk)
  return () => window.removeEventListener('vite:preloadError', onFailedChunk)
}
