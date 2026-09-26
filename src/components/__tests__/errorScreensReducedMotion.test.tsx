// Framer's useReducedMotion() lazily reads window.matchMedia("(prefers-reduced-motion)")
// once and caches the result in module state (motion-dom), so the stub below
// must be in place before anything in the whole test run has touched it.
// Vitest isolates modules per file, so this lives in its own file.
import { render } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary } from '../AppErrorBoundary'
import { createRig } from '../mascot/rig'
import { StorageErrorScreen } from '../StorageErrorScreen'

// vi.mock calls are hoisted above the imports above, so `createRig` here is
// already the vi.fn() wrapper below by the time each test file runs.
vi.mock('../mascot/rig', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../mascot/rig')>()
  return { ...actual, createRig: vi.fn(actual.createRig) }
})

function Boom(): never {
  throw new Error('kaboom')
}

describe('error screens under Reduce Motion', () => {
  beforeAll(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  })

  it('holds the StorageErrorScreen duck still: the rig is told reduced motion is on', () => {
    render(<StorageErrorScreen problem="blocked" />)
    expect(createRig).toHaveBeenCalledWith(expect.objectContaining({ reducedMotion: true }))
  })

  it("holds the app error boundary's duck still: the rig is told reduced motion is on", () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    )
    expect(createRig).toHaveBeenCalledWith(expect.objectContaining({ reducedMotion: true }))
    vi.restoreAllMocks()
  })
})
