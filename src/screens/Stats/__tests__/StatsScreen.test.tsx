import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { cloneElement, type ReactElement } from 'react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import { measurementRepo } from '../../../db/repositories/measurementRepo'
import { addDaysISO, formatDisplayDate, todayISO } from '../../../lib/dates'
import { StatsScreen } from '../StatsScreen'

// jsdom has no layout (nor ResizeObserver): the chart gets a fixed size so its axis renders.
vi.mock('recharts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('recharts')>()),
  ResponsiveContainer: ({ children }: { children: ReactElement<{ width?: number; height?: number }> }) =>
    cloneElement(children, { width: 360, height: 192 }),
}))

/** Renders Stats on Day `dayNumber` of an active attempt, after logging `weighIns` ([days from Day 1, kg]; 0 is the evening before). */
async function renderStats({ dayNumber = 1, weighIns = [] }: { dayNumber?: number; weighIns?: [day: number, kg: number][] } = {}) {
  const today = todayISO()
  const startDate = addDaysISO(today, -(dayNumber - 1))
  for (const [day, weight_kg] of weighIns) await measurementRepo.save({ date: addDaysISO(startDate, day - 1), weight_kg })
  const challengeId = await addChallenge({ startDate, attemptNumber: 1, status: 'active' })
  const challenge = (await db.challenges.get(challengeId))!
  render(<StatsScreen challenge={challenge} streak={0} today={today} todayDayNumber={dayNumber} completed={false} />)
  return { startDate }
}

describe('StatsScreen', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it('keeps Weight folded until it is opened', async () => {
    await renderStats()

    const weight = screen.getByRole('button', { name: 'Weight' })
    expect(weight).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(/No weigh-ins yet/)).not.toBeInTheDocument()

    fireEvent.click(weight)
    expect(weight).toHaveAttribute('aria-expanded', 'true')
    expect(await screen.findByText(/No weigh-ins yet/)).toBeInTheDocument()
  })

  it('shows the workouts right under Weight', async () => {
    await renderStats()

    const weight = screen.getByRole('heading', { name: 'Weight' })
    const workouts = await screen.findByRole('heading', { name: 'Workouts' })
    expect(weight.compareDocumentPosition(workouts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(await screen.findByRole('heading', { name: 'No workouts yet' })).toBeInTheDocument()
  })

  it("folds this attempt's weight and its change from the start into the header", async () => {
    // Months before (an earlier attempt), the evening before Day 1, Day 5, today.
    const { startDate } = await renderStats({ dayNumber: 11, weighIns: [[-90, 95], [0, 88.4], [5, 87.1], [11, 85.8]] })

    const weight = screen.getByRole('button', { name: /^Weight/ })
    await waitFor(() => expect(weight).toHaveTextContent('85.8 kg · −2.6 kg'))
    fireEvent.click(weight)
    expect(screen.getByText('−2.6 kg since Day 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Edit weigh-in of ${formatDisplayDate(addDaysISO(startDate, -1))}` })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: `Edit weigh-in of ${formatDisplayDate(addDaysISO(startDate, -91))}` })).not.toBeInTheDocument()

    const axis = within(screen.getByRole('figure', { name: 'Weight by challenge day chart' }))
    for (const tick of ['Start', '10']) expect(axis.getByText(tick)).toBeInTheDocument()
    expect(axis.queryByText('Day 1')).not.toBeInTheDocument()
  })

  it('counts from the first weigh-in when none came by Day 1', async () => {
    await renderStats({ dayNumber: 9, weighIns: [[5, 87], [9, 86.4]] })

    const weight = screen.getByRole('button', { name: /^Weight/ })
    await waitFor(() => expect(weight).toHaveTextContent('86.4 kg · −0.6 kg'))
    fireEvent.click(weight)
    expect(screen.getByText('−0.6 kg since Day 5')).toBeInTheDocument()
    expect(within(screen.getByRole('figure', { name: 'Weight by challenge day chart' })).getByText('Day 1')).toBeInTheDocument()
  })

  it('keeps only the water and pages tiles', async () => {
    await renderStats()

    expect(screen.getByText('Water drunk')).toBeInTheDocument()
    expect(screen.getByText('Pages read')).toBeInTheDocument()
    for (const gone of ['Training', 'Current streak', 'Perfect days']) {
      expect(screen.queryByText(gone), gone).not.toBeInTheDocument()
    }
  })
})
