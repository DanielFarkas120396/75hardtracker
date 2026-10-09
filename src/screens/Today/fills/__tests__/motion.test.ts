import { describe, expect, it } from 'vitest'
import { cubicOut, inOut, outQuart, spring } from '../motion'
import { frameDecision } from '../schedule'

describe('easings', () => {
  it('run from 0 to 1 and clamp outside', () => {
    for (const ease of [cubicOut, outQuart, inOut]) {
      expect(ease(0)).toBe(0)
      expect(ease(1)).toBe(1)
      expect(ease(2)).toBe(1)
      expect(ease(-1)).toBe(0)
    }
  })
})

describe('spring', () => {
  it('swings past its target after a kick, then comes to rest on it', () => {
    const s = spring(25, 0.12)
    s.kick(-40)
    let lowest = 0
    let moving = true
    for (let i = 0; i < 60 * 15 && moving; i++) {
      moving = s.step(1 / 60)
      lowest = Math.min(lowest, s.y)
    }
    expect(lowest).toBeLessThan(-1)
    expect(moving).toBe(false)
    expect(s.y).toBe(0)
  })

  it('jumps to a target set at once', () => {
    const s = spring(60, 0.5)
    s.set(12, true)
    expect(s.y).toBe(12)
    expect(s.step(1 / 60)).toBe(false)
  })
})

describe('frameDecision', () => {
  const still = { moving: false, fading: false, dirty: false, drifting: false }
  it('draws what moves every frame, and drifting fills only when the 30 fps slot is due', () => {
    expect(frameDecision({ ...still, moving: true }, false)).toEqual({ draw: true, again: true })
    expect(frameDecision({ ...still, drifting: true }, false)).toEqual({ draw: false, again: true })
    expect(frameDecision({ ...still, drifting: true }, true)).toEqual({ draw: true, again: true })
    expect(frameDecision({ ...still, dirty: true }, false)).toEqual({ draw: true, again: false })
    expect(frameDecision(still, true)).toEqual({ draw: false, again: false })
  })
})
