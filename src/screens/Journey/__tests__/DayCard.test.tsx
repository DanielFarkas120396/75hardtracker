import { fireEvent, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../db/db'
import { freshDatabase } from '../../../db/__tests__/fixtures'
import type { DayEntry } from '../../../db/types'
import { DayCard, type OpenDay } from '../DayCard'

const entry: DayEntry = {
  id: 1,
  challengeId: 1,
  date: '2026-10-06',
  dayNumber: 23,
  water_ml: 3800,
  pages_read: 12,
  dietFollowed: true,
  noAlcohol: true,
  notes: 'Legs dead after the hill run.',
  mood: 4,
  completed: true,
}

function day(overrides: Partial<OpenDay> = {}): OpenDay {
  return { dayNumber: 23, date: '2026-10-06', entry, from: { x: 100, y: 300 }, ...overrides }
}

describe('DayCard', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it('shows the day, its notes and its workouts, and nothing else', async () => {
    await db.dayEntries.add(entry)
    await db.workouts.bulkAdd([
      { dayEntryId: 1, type: 'Running', durationMin: 45, isOutdoor: true },
      { dayEntryId: 1, type: 'Weights', durationMin: 50, isOutdoor: false },
    ] as never)
    render(<DayCard day={day()} open onClose={() => {}} />)

    expect(screen.getByRole('heading', { name: /Day 23/ })).toBeInTheDocument()
    expect(screen.getByText('Legs dead after the hill run.')).toBeInTheDocument()
    expect(screen.getByText('No photo this day')).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: 'Running' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Weights' })).toBeInTheDocument()
    expect(screen.queryByText(/pages/)).not.toBeInTheDocument()
  })

  it('says when nothing was logged that day', () => {
    render(<DayCard day={day({ entry: undefined })} open onClose={() => {}} />)

    expect(screen.getByText('Nothing was logged this day.')).toBeInTheDocument()
  })

  it('closes from its close button', () => {
    const onClose = vi.fn()
    render(<DayCard day={day()} open onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalled()
  })
})
