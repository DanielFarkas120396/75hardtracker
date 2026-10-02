import { afterEach, describe, expect, it, vi } from 'vitest'
import { CAPTURE_ASPECT, coverCrop, loadFacing, saveFacing, startCamera, stopCamera } from '../camera'

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('coverCrop', () => {
  it('trims the sides of a landscape frame to a centred 3:4 portrait', () => {
    expect(coverCrop(1920, 1080, CAPTURE_ASPECT)).toEqual({ sx: 555, sy: 0, sw: 810, sh: 1080 })
  })

  it('trims the top and bottom of a tall 9:16 frame', () => {
    expect(coverCrop(1080, 1920, CAPTURE_ASPECT)).toEqual({ sx: 0, sy: 240, sw: 1080, sh: 1440 })
  })

  it('leaves a frame that is already 3:4 untouched', () => {
    expect(coverCrop(1200, 1600, CAPTURE_ASPECT)).toEqual({ sx: 0, sy: 0, sw: 1200, sh: 1600 })
  })
})

describe('startCamera / stopCamera', () => {
  it('asks for video only, preferring the requested camera', async () => {
    const getUserMedia = vi.fn().mockResolvedValue('stream')
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })

    await startCamera('user')

    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({ audio: false, video: expect.objectContaining({ facingMode: { ideal: 'user' } }) }),
    )
  })

  it('stops every track, and tolerates a missing stream', () => {
    const stop = vi.fn()
    stopCamera({ getTracks: () => [{ stop }, { stop }] } as unknown as MediaStream)
    expect(stop).toHaveBeenCalledTimes(2)
    expect(() => stopCamera(null)).not.toThrow()
  })
})

describe('camera facing preference', () => {
  it('defaults to the back camera and remembers a switch', () => {
    expect(loadFacing()).toBe('environment')
    saveFacing('user')
    expect(loadFacing()).toBe('user')
  })
})
