import { render, waitFor } from '@testing-library/react'
import { MotionConfig } from 'framer-motion'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JourneyEffects } from '../effects/JourneyEffects'

const effects = vi.hoisted(() => ({ stop: vi.fn(), start: vi.fn() }))

vi.mock('../effects/renderer', () => ({
  startEffects: effects.start.mockImplementation(() => effects.stop),
}))

/** Pretends the browser can (or can't) run WebGL. */
function fakeWebGL(available: boolean) {
  if (available) vi.stubGlobal('WebGLRenderingContext', class {})
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => (available ? { getExtension: () => ({ loseContext() {} }) } : null) as unknown as RenderingContext,
  )
}

function renderEffects(reducedMotion: 'never' | 'always' = 'never') {
  const scrollRef = createRef<HTMLElement>()
  const scroller = document.createElement('main')
  ;(scrollRef as { current: HTMLElement }).current = scroller
  return render(
    <MotionConfig reducedMotion={reducedMotion}>
      <JourneyEffects scrollRef={scrollRef} />
    </MotionConfig>,
  )
}

describe('JourneyEffects', () => {
  beforeEach(() => {
    // jsdom has no ResizeObserver; the canvas size doesn't matter here.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    effects.start.mockClear()
    effects.stop.mockClear()
  })

  it('starts the three.js effects on its canvas, and stops them when the map closes', async () => {
    fakeWebGL(true)
    const { container, unmount } = renderEffects()

    expect(container.querySelector('canvas')).toBeInTheDocument()
    await waitFor(() => expect(effects.start).toHaveBeenCalledTimes(1))

    unmount()
    expect(effects.stop).toHaveBeenCalledTimes(1)
  })

  it('draws nothing under reduce motion', async () => {
    fakeWebGL(true)
    const { container } = renderEffects('always')

    expect(container.querySelector('canvas')).not.toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 20))
    expect(effects.start).not.toHaveBeenCalled()
  })

  it('draws nothing when the browser has no WebGL', async () => {
    fakeWebGL(false)
    const { container } = renderEffects()

    expect(container.querySelector('canvas')).not.toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 20))
    expect(effects.start).not.toHaveBeenCalled()
  })
})
