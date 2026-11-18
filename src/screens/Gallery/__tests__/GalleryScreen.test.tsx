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
    render(<GalleryScreen challengeId={1} attemptNumber={1} streak={3} onTakePhoto={onTakePhoto} />)

    expect(await screen.findByRole('heading', { name: 'No photos yet' }, LOADED)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: "Take today's photo" }))
    expect(onTakePhoto).toHaveBeenCalledOnce()
  })

  it("shows this attempt's photos only, in one grid", async () => {
    const old = await addChallenge({ startDate: '2026-09-01', attemptNumber: 1, status: 'failed' })
    await addPerfectDay(old, '2026-09-01', 1)
    const current = await addChallenge({ startDate: '2026-10-01', attemptNumber: 2, status: 'active' })
    await addPerfectDay(current, '2026-10-01', 1)
    await addPerfectDay(current, '2026-10-01', 40)
    render(<GalleryScreen challengeId={current} attemptNumber={1} streak={3} onTakePhoto={() => {}} />)

    expect(await screen.findAllByRole('button', { name: /^Day \d+ progress/ }, LOADED)).toHaveLength(2)
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
  })

  describe('Compare', () => {
    it('shows the first and latest days and opens the compare view', async () => {
      const id = await addChallenge({ startDate: '2026-10-01', attemptNumber: 1, status: 'active' })
      await addPerfectDay(id, '2026-10-01', 1)
      await addPerfectDay(id, '2026-10-01', 32)
      render(<GalleryScreen challengeId={id} attemptNumber={1} streak={3} onTakePhoto={() => {}} />)

      fireEvent.click(await screen.findByRole('button', { name: /^Compare ?Day 1 → Day 32$/ }, LOADED))
      expect(screen.getByRole('dialog', { name: 'Compare photos' })).toBeInTheDocument()
    })

    it('is hidden with one photo in this attempt, whatever older attempts hold', async () => {
      const old = await addChallenge({ startDate: '2026-09-01', attemptNumber: 1, status: 'failed' })
      await addPerfectDay(old, '2026-09-01', 1)
      await addPerfectDay(old, '2026-09-01', 2)
      const current = await addChallenge({ startDate: '2026-10-01', attemptNumber: 2, status: 'active' })
      await addPerfectDay(current, '2026-10-01', 1)
      render(<GalleryScreen challengeId={current} attemptNumber={1} streak={3} onTakePhoto={() => {}} />)

      expect(await screen.findAllByRole('button', { name: /^Day \d+ progress/ }, LOADED)).toHaveLength(1)
      expect(screen.queryByRole('button', { name: /^Compare/ })).not.toBeInTheDocument()
    })
  })
})
