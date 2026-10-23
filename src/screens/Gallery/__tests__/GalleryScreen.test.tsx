import { fireEvent, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { addChallenge, addPerfectDay, freshDatabase } from '../../../db/__tests__/fixtures'
import { GalleryScreen } from '../GalleryScreen'

/** The first render waits on a live query: under a loaded test run, it can take more than a second. */
const LOADED = { timeout: 5000 }

describe('GalleryScreen', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
    // jsdom has no object URLs; BlobImage only needs a string back.
    URL.createObjectURL = vi.fn(() => 'blob:photo')
    URL.revokeObjectURL = vi.fn()
  })

  beforeEach(freshDatabase)

  it('with no photos, shows the duck and sends you to take one', async () => {
    const onTakePhoto = vi.fn()
    render(<GalleryScreen attemptNumber={1} onTakePhoto={onTakePhoto} />)

    expect(await screen.findByRole('heading', { name: 'No photos yet' }, LOADED)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: "Take today's photo" }))
    expect(onTakePhoto).toHaveBeenCalledOnce()
  })

  describe('Compare', () => {
    it('opens the compare view once this attempt has two photos', async () => {
      const id = await addChallenge({ startDate: '2026-10-01', attemptNumber: 1, status: 'active' })
      await addPerfectDay(id, '2026-10-01', 1)
      await addPerfectDay(id, '2026-10-01', 2)
      render(<GalleryScreen attemptNumber={1} onTakePhoto={() => {}} />)

      fireEvent.click(await screen.findByRole('button', { name: 'Compare' }, LOADED))
      expect(screen.getByRole('dialog', { name: 'Compare photos' })).toBeInTheDocument()
    })

    it('is hidden with one photo in this attempt, whatever older attempts hold', async () => {
      const old = await addChallenge({ startDate: '2026-09-01', attemptNumber: 1, status: 'failed' })
      await addPerfectDay(old, '2026-09-01', 1)
      await addPerfectDay(old, '2026-09-01', 2)
      const current = await addChallenge({ startDate: '2026-10-01', attemptNumber: 2, status: 'active' })
      await addPerfectDay(current, '2026-10-01', 1)
      render(<GalleryScreen attemptNumber={2} onTakePhoto={() => {}} />)

      expect(await screen.findAllByRole('button', { name: /^Day \d+ progress/ }, LOADED)).toHaveLength(3)
      expect(screen.queryByRole('button', { name: 'Compare' })).not.toBeInTheDocument()
    })
  })
})
