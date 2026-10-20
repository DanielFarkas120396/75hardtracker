import { act, fireEvent, render, screen } from '@testing-library/react'
import { MotionConfig, MotionGlobalConfig } from 'framer-motion'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { GalleryEntry } from '../../../hooks/useGalleryPhotos'
import { PhotoCompare } from '../PhotoCompare'

const entries: GalleryEntry[] = [1, 3, 5, 7].map((dayNumber) => ({
  photo: { id: dayNumber * 10, date: `2026-10-0${dayNumber}`, blob: new Blob([`day ${dayNumber}`], { type: 'image/jpeg' }) },
  dayNumber,
  attemptNumber: 1,
  date: `2026-10-0${dayNumber}`,
}))

function renderCompare({ reduceMotion = false } = {}) {
  const onClose = vi.fn()
  render(
    <MotionConfig reducedMotion={reduceMotion ? 'always' : 'never'}>
      <PhotoCompare entries={entries} open onClose={onClose} />
    </MotionConfig>,
  )
  return { onClose }
}

/** Lets the time-lapse run for `ms`, one act per 100 ms, so each frame renders and sets the next one's timer. */
async function play(ms: number) {
  for (let t = 0; t < ms; t += 100) await act(() => vi.advanceTimersByTimeAsync(100))
}

describe('PhotoCompare', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
    // jsdom has no object URLs and doesn't decode images.
    URL.createObjectURL = vi.fn(() => 'blob:photo')
    URL.revokeObjectURL = vi.fn()
    HTMLImageElement.prototype.decode = () => Promise.resolve()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('slider', () => {
    it('opens on the first and the latest photo', () => {
      renderCompare()
      expect(screen.getByRole('img', { name: 'Day 1 progress' })).toBeInTheDocument()
      expect(screen.getByRole('img', { name: 'Day 7 progress' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Change the earlier day, Day 1' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Change the later day, Day 7' })).toBeInTheDocument()
      expect(screen.getByText('Day 1 → Day 7 · 6 days')).toBeInTheDocument()
    })

    it('moves the line with the slider', () => {
      renderCompare()
      fireEvent.change(screen.getByRole('slider', { name: 'Compare Day 1 and Day 7' }), { target: { value: '30' } })
      expect(screen.getByRole('img', { name: 'Day 7 progress' }).parentElement).toHaveStyle({ clipPath: 'inset(0 0 0 30%)' })
    })

    it('picks another day for one side', () => {
      renderCompare()
      fireEvent.click(screen.getByRole('button', { name: 'Change the later day, Day 7' }))
      expect(screen.getByRole('button', { name: 'Day 1' })).toBeDisabled()
      fireEvent.click(screen.getByRole('button', { name: 'Day 3' }))
      expect(screen.getByText('Day 1 → Day 3 · 2 days')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Day 5' })).not.toBeInTheDocument()
    })

    it('swaps the sides when a pick puts the days the wrong way round', () => {
      renderCompare()
      fireEvent.click(screen.getByRole('button', { name: 'Change the later day, Day 7' }))
      fireEvent.click(screen.getByRole('button', { name: 'Day 3' }))
      fireEvent.click(screen.getByRole('button', { name: 'Change the earlier day, Day 1' }))
      fireEvent.click(screen.getByRole('button', { name: 'Day 5' }))
      expect(screen.getByRole('button', { name: 'Change the earlier day, Day 3' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Change the later day, Day 5' })).toBeInTheDocument()
    })
  })

  describe('time-lapse', () => {
    it('plays every photo and stops on the latest, then offers Replay', async () => {
      vi.useFakeTimers()
      renderCompare()
      fireEvent.click(screen.getByRole('button', { name: 'Time-lapse' }))
      await play(100)
      expect(screen.getByRole('img', { name: 'Day 1 progress' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Replay' })).not.toBeInTheDocument()

      await play(400)
      expect(screen.getByRole('img', { name: 'Day 3 progress' })).toBeInTheDocument()

      await play(5000)
      expect(screen.getByRole('img', { name: 'Day 7 progress' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Replay' }))
      expect(screen.getByRole('img', { name: 'Day 1 progress' })).toBeInTheDocument()
    })

    it('shows the day the scrubber is on, and stops playing', async () => {
      vi.useFakeTimers()
      renderCompare()
      fireEvent.click(screen.getByRole('button', { name: 'Time-lapse' }))
      await play(100)
      fireEvent.change(screen.getByRole('slider', { name: 'Day' }), { target: { value: '2' } })
      expect(screen.getByRole('img', { name: 'Day 5 progress' })).toBeInTheDocument()

      await play(5000)
      expect(screen.getByRole('img', { name: 'Day 5 progress' })).toBeInTheDocument()
    })

    it('plays anyway when decoding the photos never finishes', async () => {
      vi.useFakeTimers()
      vi.spyOn(HTMLImageElement.prototype, 'decode').mockReturnValue(new Promise(() => {}))
      renderCompare()
      fireEvent.click(screen.getByRole('button', { name: 'Time-lapse' }))
      await play(2900)
      expect(screen.getByText('Loading…')).toBeInTheDocument()

      await play(200)
      expect(screen.getByRole('img', { name: 'Day 1 progress' })).toBeInTheDocument()
    })

    it('with reduce motion, opens on the latest photo and never plays', async () => {
      vi.useFakeTimers()
      renderCompare({ reduceMotion: true })
      fireEvent.click(screen.getByRole('button', { name: 'Time-lapse' }))
      await play(5000)
      expect(screen.getByRole('img', { name: 'Day 7 progress' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Replay' })).not.toBeInTheDocument()

      fireEvent.change(screen.getByRole('slider', { name: 'Day' }), { target: { value: '0' } })
      expect(screen.getByRole('img', { name: 'Day 1 progress' })).toBeInTheDocument()
    })
  })

  it('closes on Escape and on ✕', () => {
    const { onClose } = renderCompare()
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
