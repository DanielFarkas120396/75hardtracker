import { act, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GaugeRing } from '../GaugeRing'

const litBars = (container: HTMLElement) => container.querySelectorAll('[data-bar][data-lit]').length
const crownStops = (container: HTMLElement) => [...container.querySelectorAll('linearGradient')[1].children] as SVGStopElement[]

describe('GaugeRing', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
  })

  afterEach(() => {
    MotionGlobalConfig.skipAnimations = false
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('without animations: lights 3/5 of the 41 bars, and keeps the crown short of full', () => {
    MotionGlobalConfig.skipAnimations = true
    const { container } = render(<GaugeRing value={3} max={5} />)

    expect(screen.getByRole('img', { name: '3 of 5 tasks done' })).toHaveTextContent('3/5')
    expect(litBars(container)).toBe(25)
    // The crown's gold ends before its right edge until the day is won.
    expect(Number(crownStops(container)[1].getAttribute('offset'))).toBeLessThan(0.5)
  })

  it('at 5/5: every bar lit and the whole crown gold', () => {
    MotionGlobalConfig.skipAnimations = true
    const { container } = render(<GaugeRing value={5} max={5} />)

    expect(litBars(container)).toBe(41)
    expect(Number(crownStops(container)[1].getAttribute('offset'))).toBeGreaterThan(0.9)
  })

  it('while held: keeps the last state, and catches up once released', () => {
    MotionGlobalConfig.skipAnimations = true
    const { container, rerender } = render(<GaugeRing value={4} max={5} />)
    rerender(<GaugeRing value={5} max={5} held />)
    expect(litBars(container)).toBe(33)

    rerender(<GaugeRing value={5} max={5} />)
    expect(litBars(container)).toBe(41)
  })

  it('with animations: the number ticks once per task, from where it was', () => {
    vi.useFakeTimers()
    const { container, rerender } = render(<GaugeRing value={1} max={5} />)
    act(() => vi.advanceTimersByTime(2000))
    expect(screen.getByRole('img')).toHaveTextContent('1/5')

    rerender(<GaugeRing value={3} max={5} />)
    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByRole('img')).toHaveTextContent('2/5')
    act(() => vi.advanceTimersByTime(2000))
    expect(screen.getByRole('img', { name: '3 of 5 tasks done' })).toHaveTextContent('3/5')
    expect(litBars(container)).toBe(25)
  })
})
