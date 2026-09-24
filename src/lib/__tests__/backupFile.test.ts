import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveBackupFile } from '../backupFile'

const file = new File(['{}'], '75hard-backup-2026-09-24.json', { type: 'application/json' })

function setDevice(options: { coarsePointer: boolean; canShare?: boolean; share?: () => Promise<void> }) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: options.coarsePointer && query.includes('coarse') }))
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => options.canShare ?? false })
  Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn(options.share ?? (() => Promise.resolve())) })
}

const domException = (name: string) => new DOMException('nope', name)

describe('saveBackupFile', () => {
  let clicks: HTMLAnchorElement[]

  beforeEach(() => {
    clicks = []
    vi.useFakeTimers()
    URL.createObjectURL = vi.fn(() => 'blob:backup')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this)
      expect(document.body.contains(this)).toBe(true) // attached while clicked
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('downloads on desktop, and revokes the URL only after a delay', async () => {
    setDevice({ coarsePointer: false, canShare: true })

    expect(await saveBackupFile(file)).toBe('downloaded')
    expect(clicks).toHaveLength(1)
    expect(clicks[0].download).toBe(file.name)
    expect(document.body.contains(clicks[0])).toBe(false) // removed again
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()

    vi.advanceTimersByTime(60_000)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:backup')
  })

  it('opens the share sheet on a phone that can share the file', async () => {
    setDevice({ coarsePointer: true, canShare: true })
    expect(await saveBackupFile(file)).toBe('shared')
    expect(navigator.share).toHaveBeenCalledWith({ files: [file], title: file.name })
    expect(clicks).toHaveLength(0)
  })

  it('treats closing the share sheet as a cancel, not an error or a download', async () => {
    setDevice({ coarsePointer: true, canShare: true, share: () => Promise.reject(domException('AbortError')) })
    expect(await saveBackupFile(file)).toBe('cancelled')
    expect(clicks).toHaveLength(0)
  })

  it('asks for a fresh tap when preparing the file outlived the original one', async () => {
    setDevice({ coarsePointer: true, canShare: true, share: () => Promise.reject(domException('NotAllowedError')) })
    expect(await saveBackupFile(file)).toBe('needsGesture')
    expect(await saveBackupFile(file, { fromFreshTap: true })).toBe('downloaded')
  })

  it('downloads on a phone that cannot share this file type (Android Chrome and .json)', async () => {
    setDevice({ coarsePointer: true, canShare: false })
    expect(await saveBackupFile(file)).toBe('downloaded')
    expect(navigator.share).not.toHaveBeenCalled()
  })
})
