// Renders the app's sounds to WAV files, from the same recipes the web app plays live with
// WebAudio (src/lib/sound.ts): the phone has no synthesiser, so it plays files.
//
//   node scripts/render-sounds.mjs        (from mobile/)
//
// The noise comes from a fixed seed, so a rerun writes the same bytes.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RATE = 44_100
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds')

/** WebAudio's exponentialRampToValueAtTime: from v0 at t0 to v1 at t1. */
const ramp = (t, t0, v0, t1, v1) => v0 * (v1 / v0) ** ((t - t0) / (t1 - t0))

/** A small seeded generator (mulberry32), in [-1, 1). */
function noise(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return (((t ^ (t >>> 14)) >>> 0) / 2 ** 32) * 2 - 1
  }
}

/**
 * The blade "shing": band-passed noise sweeping up from 2 to 8 kHz over a quarter
 * second (the blade sliding), then a metallic ring of three inharmonic partials.
 */
function knifeShing() {
  const samples = new Float64Array(Math.ceil(RATE * 0.68))
  const next = noise(75)
  // A band-pass biquad (Q 6) whose centre moves every sample, as WebAudio's does.
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  for (let i = 0; i < RATE * 0.25; i++) {
    const t = i / RATE
    const w0 = (2 * Math.PI * ramp(t, 0, 2000, 0.25, 8000)) / RATE
    const alpha = Math.sin(w0) / (2 * 6)
    const x0 = next()
    const y0 = (alpha * x0 - alpha * x2 + 2 * Math.cos(w0) * y1 - (1 - alpha) * y2) / (1 + alpha)
    x2 = x1
    x1 = x0
    y2 = y1
    y1 = y0
    const gain = t < 0.03 ? ramp(t, 0, 0.0001, 0.03, 0.25) : ramp(t, 0.03, 0.25, 0.25, 0.001)
    samples[i] += y0 * gain
  }
  ;[3100, 4700, 6200].forEach((frequency, partial) => {
    const start = 0.18
    const peak = 0.08 / (partial + 1)
    for (let i = Math.round(start * RATE); i < samples.length; i++) {
      const t = i / RATE - start
      const gain = t < 0.01 ? ramp(t, 0, 0.0001, 0.01, peak) : ramp(t, 0.01, peak, 0.5, 0.0001)
      samples[i] += Math.sin(2 * Math.PI * frequency * t) * gain
    }
  })
  return samples
}

/** 16-bit mono WAV. The loudest sample is brought to `peak`: a phone plays files quieter than a browser plays its own synthesis. */
function wav(samples, peak = 0.6) {
  const loudest = samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0)
  const scale = (peak / loudest) * 32_767
  const data = Buffer.alloc(samples.length * 2)
  samples.forEach((sample, i) => data.writeInt16LE(Math.round(sample * scale), i * 2))
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(RATE, 24)
  header.writeUInt32LE(RATE * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'knife-shing.wav'), wav(knifeShing()))
console.log(`Wrote ${join(out, 'knife-shing.wav')}`)
