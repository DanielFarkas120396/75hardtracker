import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listenForStaleChunks } from '../staleChunks'

describe('listenForStaleChunks', () => {
  const reload = vi.fn()
  let now = 0
  // Every test adds its own listener to the one window, so each is removed again.
  let stop = () => {}
  const failedChunk = () => window.dispatchEvent(new Event('vite:preloadError'))

  beforeEach(() => {
    stop()
    sessionStorage.clear()
    reload.mockClear()
    now = 1_000_000
    stop = listenForStaleChunks(reload, () => now)
  })

  it('reloads when a chunk from an older deploy fails to load', () => {
    failedChunk()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload again straight after, so a chunk that stays missing cannot loop', () => {
    failedChunk()
    now += 5_000
    failedChunk()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reloads for the next deploy later in the same session', () => {
    failedChunk()
    now += 60 * 60 * 1000
    failedChunk()
    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('does not reload when the session storage is blocked, because it could not stop a loop', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
      throw new Error('blocked')
    })
    failedChunk()
    expect(reload).not.toHaveBeenCalled()
  })
})
