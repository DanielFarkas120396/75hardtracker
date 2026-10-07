import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../db/db'
import { freshDatabase } from '../../../db/__tests__/fixtures'
import type { Book, DayEntry } from '../../../db/types'
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
  return { dayNumber: 23, date: '2026-10-06', entry, forgiven: false, from: { x: 100, y: 300 }, ...overrides }
}

describe('DayCard', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it('shows the day, its notes and mood, its workouts, and the book read', async () => {
    const bookId = await db.books.add({ title: 'Can’t Hurt Me', totalPages: 364, currentPage: 120, finished: false } as Book)
    await db.dayEntries.add({ ...entry, bookId })
    await db.workouts.bulkAdd([
      { dayEntryId: 1, type: 'Running', durationMin: 45, isOutdoor: true },
      { dayEntryId: 1, type: 'Weights', durationMin: 50, isOutdoor: false },
    ] as never)
    render(<DayCard day={day({ entry: { ...entry, bookId } })} open onClose={() => {}} />)

    expect(screen.getByRole('heading', { name: /Day 23/ })).toBeInTheDocument()
    expect(screen.getByText('Legs dead after the hill run.')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Good' })).toBeInTheDocument()
    expect(screen.getByText('No photo this day')).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: 'Running' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Weights' })).toBeInTheDocument()
    expect(await screen.findByText('Can’t Hurt Me')).toBeInTheDocument()
    expect(screen.getByText('12 pages')).toBeInTheDocument()
    expect(screen.getByLabelText('Add a cover for Can’t Hurt Me')).toBeInTheDocument()
  })

  it('lets you choose the book on a day logged before books were recorded', async () => {
    const bookId = await db.books.add({ title: 'Atomic Habits', totalPages: 320, currentPage: 0, finished: false } as Book)
    await db.dayEntries.add(entry)
    render(<DayCard day={day()} open onClose={() => {}} />)

    fireEvent.change(await screen.findByRole('combobox', { name: 'Choose the book' }), { target: { value: String(bookId) } })

    await waitFor(async () => expect((await db.dayEntries.get(1))?.bookId).toBe(bookId))
  })

  it('says when a joker forgave the day and nothing was logged', () => {
    render(<DayCard day={day({ entry: undefined, forgiven: true })} open onClose={() => {}} />)

    expect(screen.getByText('Forgiven by a joker')).toBeInTheDocument()
    expect(screen.getByText('Nothing was logged this day.')).toBeInTheDocument()
  })

  it('closes from its close button', () => {
    const onClose = vi.fn()
    render(<DayCard day={day()} open onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalled()
  })
})
