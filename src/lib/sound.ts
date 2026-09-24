let sharedContext: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  sharedContext ??= new Ctor()
  return sharedContext
}

/** Plays a short, synthesized two-note chime — no audio asset files needed. */
export function playChime(): void {
  const ctx = getContext()
  if (!ctx) return

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
