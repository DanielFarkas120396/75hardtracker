import { fireEvent, render, screen, within } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { freshDatabase } from '../../../db/__tests__/fixtures'
import type { Challenge, DayEntry } from '../../../db/types'
import { JourneyScreen } from '../JourneyScreen'

const challenge: Challenge = { id: 1, startDate: '2026-10-01', attemptNumber: 2, status: 'active' }

const entry = (dayNumber: number, extra: Partial<DayEntry> = {}): DayEntry => ({
  id: dayNumber,
  challengeId: 1,
  date: `2026-10-${String(dayNumber).padStart(2, '0')}`,
  dayNumber,
  water_ml: 3800,
  pages_read: 10,
  dietFollowed: true,
  noAlcohol: true,
  completed: true,
  ...extra,
})

function renderJourney(todayDayNumber: number, dayEntries: DayEntry[], missedDays: number[] = []) {
  return render(
    <JourneyScreen challenge={challenge} dayEntries={dayEntries} todayDayNumber={todayDayNumber} streak={3} completed={false} missedDays={missedDays} />,
  )
}

describe('JourneyScreen', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })
  })

  beforeEach(freshDatabase)

  it('lists the days newest first, in chapters by world, with the next world locked on top', () => {
    // Day 4 has no entry: a joker forgave it.
    const entries = Array.from({ length: 11 }, (_, i) => entry(i + 1, i === 10 ? { notes: 'Rain walk.\nThen more.' } : {})).filter((e) => e.dayNumber !== 4)
    renderJourney(12, [...entries, entry(12, { completed: false })], [4])

    const covers = screen.getAllByRole('region').filter((r) => r.id.startsWith('journey-world-'))
    expect(covers.map((c) => c.getAttribute('aria-label'))).toEqual(['The Dark Forest, In 11 days', 'The Wasteland, 1/12', 'Hell, Cleared'])

    const wasteland = screen.getByRole('region', { name: 'The Wasteland' })
    const days = within(wasteland).getAllByRole('button').map((b) => b.textContent)
    expect(days[0]).toMatch(/Today · Day 12.*In progress/)
    expect(days[1]).toMatch(/Day 11.*Rain walk\./)
    expect(days[1]).not.toMatch(/Then more/)

    expect(screen.getByText('Days 1–10 · 9/10 · 1 joker · done Sat 10 Oct')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Day 4 · forgiven with a joker/ })).toBeInTheDocument()
  })

  it("counts today as to go until it's done", () => {
    renderJourney(1, [entry(1, { completed: false })])
    expect(screen.getByText('Days 1–10 · 10 to go')).toBeInTheDocument()
  })

  it('counts nine to go once Day 1 is done', () => {
    renderJourney(1, [entry(1)])
    expect(screen.getByText('Days 1–10 · 9 to go')).toBeInTheDocument()
  })

  it('opens the day card from a past day', () => {
    renderJourney(3, [entry(1, { notes: 'First day done.' }), entry(2)])

    fireEvent.click(screen.getByRole('button', { name: /^Day 1/ }))

    expect(screen.getByRole('heading', { name: /Day 1 · Thu 1 Oct/ })).toBeInTheDocument()
  })

  it('shows only Hell waiting before Day 1', () => {
    renderJourney(0, [])

    expect(screen.getByRole('region', { name: 'Hell, Tomorrow' })).toBeInTheDocument()
    expect(screen.getByText('Not started yet')).toBeInTheDocument()
  })
})
