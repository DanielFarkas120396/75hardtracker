let sharedContext: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  sharedContext ??= new Ctor()
  return sharedContext
}

/** Resumes a context the browser suspended (or, on iOS, interrupted); a no-op once it's running. */
function resume(ctx: AudioContext): Promise<void> {
  return ctx.state === 'running' ? Promise.resolve() : ctx.resume().catch(() => undefined)
}

// Touch taps only count as a user gesture on pointerup/touchend, mouse clicks on pointerdown.
const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const

/**
 * Browsers only let audio start from a user gesture, but the chime plays
 * later — from an effect, after a save. So the shared context is created and
 * resumed inside the user's taps and key presses until it's running.
 */
export function unlockAudioOnUserGesture(): void {
  if (typeof window === 'undefined') return

  const stop = () => UNLOCK_EVENTS.forEach((type) => window.removeEventListener(type, unlock, true))
  function unlock() {
    const ctx = getContext()
    if (!ctx) return stop()
    void resume(ctx).then(() => {
      if (ctx.state === 'running') stop()
    })
  }

  UNLOCK_EVENTS.forEach((type) => window.addEventListener(type, unlock, true))
}

/** Plays a short, synthesized two-note chime — no audio asset files needed. */
export function playChime(): void {
  const ctx = getContext()
  if (!ctx) return
  void resume(ctx)

  const notes = [523.25, 783.99] // C5, G5
  const now = ctx.currentTime

  notes.forEach((freq, i) => {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = freq

    const start = now + i * 0.1
    const end = start + 0.35
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.2, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, end)

    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(start)
    oscillator.stop(end)
  })
}

const RING_PARTIALS_HZ = [3100, 4700, 6200]

/**
 * A short synthesized blade "shing" with no audio file. It's band-passed
 * noise sweeping up (the blade sliding), then a quick metallic ring of three
 * inharmonic partials.
 */
export function playKnifeShing(): void {
  const ctx = getContext()
  if (!ctx) return
  void resume(ctx)
  const now = ctx.currentTime

  const length = Math.floor(ctx.sampleRate * 0.25)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const samples = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) samples[i] = Math.random() * 2 - 1

  const noise = ctx.createBufferSource()
  noise.buffer = buffer
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.Q.value = 6
  band.frequency.setValueAtTime(2000, now)
  band.frequency.exponentialRampToValueAtTime(8000, now + 0.25)
  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(0.0001, now)
  noiseGain.gain.exponentialRampToValueAtTime(0.25, now + 0.03)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
  noise.connect(band)
  band.connect(noiseGain)
  noiseGain.connect(ctx.destination)
  noise.start(now)
  noise.stop(now + 0.25)

  RING_PARTIALS_HZ.forEach((frequency, i) => {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    const start = now + 0.18
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.08 / (i + 1), start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5)
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(start)
    oscillator.stop(start + 0.5)
  })
}
