import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { format, parseISO } from 'date-fns'
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

  it('opens on the weight chart, first on the page, and unfolds the weigh-ins from the arrow', async () => {
    const { startDate } = await renderStats({ dayNumber: 3, weighIns: [[1, 88], [3, 87.4]] })

    const chart = await screen.findByRole('figure', { name: 'Weight by challenge day chart' })
    const water = screen.getByText('Water drunk')
    expect(chart.compareDocumentPosition(water) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const edit = { name: `Edit weigh-in of ${formatDisplayDate(addDaysISO(startDate, 2))}` }
    expect(screen.queryByRole('button', edit)).not.toBeInTheDocument()

    const arrow = screen.getByRole('button', { name: 'Weigh-ins' })
    expect(arrow).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(arrow)
    expect(arrow).toHaveAttribute('aria-expanded', 'true')
    // One compact row: the day, the weight and the change since the weigh-in before.
    expect(screen.getByRole('button', edit)).toHaveTextContent('Day 3')
    expect(screen.getByRole('button', edit)).toHaveTextContent('87.4')
    expect(screen.getByRole('button', edit)).toHaveTextContent('▼ 0.6')
  })

  it('deletes a weigh-in from its edit sheet', async () => {
    const { startDate } = await renderStats({ dayNumber: 3, weighIns: [[1, 88], [3, 87.4]] })

    fireEvent.click(await screen.findByRole('button', { name: 'Weigh-ins' }))
    fireEvent.click(screen.getByRole('button', { name: `Edit weigh-in of ${formatDisplayDate(addDaysISO(startDate, 2))}` }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete this weigh-in' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: `Edit weigh-in of ${formatDisplayDate(addDaysISO(startDate, 2))}` })).not.toBeInTheDocument(),
    )
  })

  it('says so when there are no weigh-ins yet, with no arrow', async () => {
    await renderStats()

    expect(await screen.findByText(/No weigh-ins yet/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Weigh-ins' })).not.toBeInTheDocument()
  })

  it('shows the workouts right under Weight', async () => {
    await renderStats()

    const weight = screen.getByRole('heading', { name: 'Weight' })
    const workouts = await screen.findByRole('heading', { name: 'Workouts' })
    expect(weight.compareDocumentPosition(workouts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(await screen.findByRole('heading', { name: 'No workouts yet' })).toBeInTheDocument()
  })

  it("shows this attempt's weight and its change from the start", async () => {
    // Months before (an earlier attempt), the evening before Day 1, Day 5, today.
    const { startDate } = await renderStats({ dayNumber: 11, weighIns: [[-90, 95], [0, 88.4], [5, 87.1], [11, 85.8]] })

    expect(await screen.findByText('−2.6 kg since Day 1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Weigh-ins' }))
    expect(screen.getByRole('button', { name: `Edit weigh-in of ${formatDisplayDate(addDaysISO(startDate, -1))}` })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: `Edit weigh-in of ${formatDisplayDate(addDaysISO(startDate, -91))}` })).not.toBeInTheDocument()

    const axis = within(screen.getByRole('figure', { name: 'Weight by challenge day chart' }))
    for (const tick of ['Start', '10']) expect(axis.getByText(tick)).toBeInTheDocument()
    expect(axis.queryByText('Day 1')).not.toBeInTheDocument()
  })

  it('counts from the first weigh-in when none came by Day 1', async () => {
    await renderStats({ dayNumber: 9, weighIns: [[5, 87], [9, 86.4]] })

    expect(await screen.findByText('−0.6 kg since Day 5')).toBeInTheDocument()
    expect(within(screen.getByRole('figure', { name: 'Weight by challenge day chart' })).getByText('Day 1')).toBeInTheDocument()
  })

  it('reads a point: its weight, its day and date, and the trend there', async () => {
    // Days 1 to 10, losing 0.1 kg a day: Day 10 is 87 kg, and the trend, lagging behind, is at 87.4 kg.
    const { startDate } = await renderStats({
      dayNumber: 10,
      weighIns: Array.from({ length: 10 }, (_, i): [number, number] => [i + 1, 88 - 0.1 * (i + 1)]),
    })
    const chart = (await screen.findByRole('figure', { name: 'Weight by challenge day chart' })).querySelector<HTMLElement>('.recharts-wrapper')!
    // jsdom lays nothing out: give the chart the size it was drawn at, so the pointer maps to a day.
    chart.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 360, height: 192 })
    Object.defineProperties(chart, { offsetWidth: { value: 360 }, offsetHeight: { value: 192 } })
    fireEvent.mouseMove(chart, { clientX: 325, clientY: 96 })

    const readout = await screen.findByText('Day 10 · ' + format(parseISO(addDaysISO(startDate, 9)), 'EEE d MMM'))
    expect(readout.parentElement).toHaveTextContent('87.0 kg')
    expect(readout.parentElement).toHaveTextContent('Trend 87.4 kg')
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
