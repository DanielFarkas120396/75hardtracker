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

const param = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() })
const node = () => ({ connect: vi.fn(), start: vi.fn(), stop: vi.fn(), buffer: null as unknown })

/** Records which Web Audio nodes a sound builds. */
class RecordingAudioContext {
  static last: RecordingAudioContext | null = null
  state: AudioContextState = 'running'
  currentTime = 0
  sampleRate = 48_000
  destination = {}
  created: string[] = []
  resume = vi.fn(async () => {})

  constructor() {
    RecordingAudioContext.last = this
  }

  createBuffer(_channels: number, length: number) {
    this.created.push('buffer')
    return { getChannelData: () => new Float32Array(length) }
  }
  createBufferSource() {
    this.created.push('noise')
    return node()
  }
  createBiquadFilter() {
    this.created.push('filter')
    return { ...node(), type: '', Q: param(), frequency: param() }
  }
  createGain() {
    this.created.push('gain')
    return { ...node(), gain: param() }
  }
  createOscillator() {
    this.created.push('oscillator')
    return { ...node(), type: '', frequency: param() }
  }
}

describe('playKnifeShing', () => {
  beforeEach(() => {
    vi.resetModules()
    RecordingAudioContext.last = null
  })

  afterEach(() => {
    Reflect.deleteProperty(window, 'AudioContext')
  })

  it('plays a rising noise sweep and a three-partial metallic ring', async () => {
    Object.defineProperty(window, 'AudioContext', { value: RecordingAudioContext, configurable: true, writable: true })
    const { playKnifeShing } = await import('../sound')
    playKnifeShing()
    const created = RecordingAudioContext.last?.created ?? []
    expect(created).toContain('noise')
    expect(created).toContain('filter')
    expect(created.filter((kind) => kind === 'oscillator')).toHaveLength(3)
  })

  it('does nothing without Web Audio', async () => {
    const { playKnifeShing } = await import('../sound')
    expect(() => playKnifeShing()).not.toThrow()
  })
})
