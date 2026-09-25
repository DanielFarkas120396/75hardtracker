import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Stands in for the browser's AudioContext: resume() only works once `allowResume` is set (a real gesture). */
class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  static allowResume = false
  state: AudioContextState = 'suspended'
  resume = vi.fn(async () => {
    if (FakeAudioContext.allowResume) this.state = 'running'
  })

  constructor() {
    FakeAudioContext.instances.push(this)
  }
}

describe('unlockAudioOnUserGesture', () => {
  beforeEach(() => {
    vi.resetModules() // sound.ts keeps its context in module state
    FakeAudioContext.instances = []
    FakeAudioContext.allowResume = false
    Object.defineProperty(window, 'AudioContext', { value: FakeAudioContext, configurable: true, writable: true })
  })

  afterEach(() => {
    Reflect.deleteProperty(window, 'AudioContext')
  })

  it('keeps trying on each gesture until the context runs, then stops listening', async () => {
    const { unlockAudioOnUserGesture } = await import('../sound')
    unlockAudioOnUserGesture()

    // A touch's pointerdown isn't a user gesture yet, so the browser keeps the context suspended.
    window.dispatchEvent(new Event('pointerdown'))
    const [ctx] = FakeAudioContext.instances
    await vi.waitFor(() => expect(ctx.resume).toHaveBeenCalledOnce())
    expect(ctx.state).toBe('suspended')

    FakeAudioContext.allowResume = true
    window.dispatchEvent(new Event('pointerup'))
    await vi.waitFor(() => expect(ctx.state).toBe('running'))

    window.dispatchEvent(new Event('keydown'))
    await Promise.resolve()
    expect(ctx.resume).toHaveBeenCalledTimes(2)
    expect(FakeAudioContext.instances).toHaveLength(1)
  })
})
