import { afterEach, describe, expect, it, vi } from 'vitest'
import { celebrate } from '../confetti'

const fire = vi.hoisted(() => vi.fn())
vi.mock('canvas-confetti', () => ({ default: fire }))

function stubReduceMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query.includes('reduce') }))
}

describe('celebrate', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    document.documentElement.removeAttribute('style')
    fire.mockClear()
  })

  it("bursts in the world's shades, read from its tokens", () => {
    stubReduceMotion(false)
    const root = document.documentElement.style
    root.setProperty('--color-world-ink', '#c9bba8')
    root.setProperty('--color-world-edge', '#8c8070')
    root.setProperty('--color-world-soft', '#2a2520')
    root.setProperty('--color-on-world', '#1f1813')
    root.setProperty('--color-ink', '#f6ecdc')
    celebrate()
    expect(fire).toHaveBeenCalledWith(expect.objectContaining({ colors: ['#c9bba8', '#8c8070', '#2a2520', '#1f1813', '#f6ecdc'] }))
  })

  it('stays still under reduce motion', () => {
    stubReduceMotion(true)
    celebrate()
    expect(fire).not.toHaveBeenCalled()
  })
})
