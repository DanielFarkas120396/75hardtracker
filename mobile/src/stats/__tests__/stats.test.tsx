// The Stats tab as the phone shows it: the cases of the plan's Review Focus
// (docs/superpowers/plans/2026-11-19-v4-part-7-stats.md), from the web's StatsScreen and WorkoutsSection tests.
import { addDaysISO, formatDisplayDate, todayISO } from '@logic/dates'
import type { WorkoutType } from '@logic/types'
import type { Mood } from '@logic/moods'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native'
import { format, parseISO } from 'date-fns'
import * as Font from 'expo-font'
import StatsRoute from '../../app/(tabs)/stats'
import { addChallenge, freshDatabase } from '../../db/__tests__/fixtures'
import { transaction } from '../../db/open'
import { measurementRepo } from '../../db/repositories/measurementRepo'
import { profileRepo } from '../../db/repositories/profileRepo'
import { insertRow } from '../../db/table'
import { useHideTabBar } from '../../hooks/useTabBar'
import { Providers } from '../../today/__tests__/support'

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }))
// The phone's own picker is a native view: a plain view stands in.
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { View } = jest.requireActual<typeof import('react-native')>('react-native')
    return <View {...props} />
  },
}))

const TODAY = todayISO()

beforeEach(async () => {
  jest.mocked(Font.useFonts).mockReturnValue([true, null])
  await freshDatabase()
})
afterEach(() => jest.restoreAllMocks())

interface DaySeed {
  water_ml?: number
  pages_read?: number
  workouts?: [WorkoutType, number, boolean, Mood?][]
}

/** An attempt on Day `day`, with weigh-ins ([days from Day 1, kg]; 0 is the evening before) and logged days. */
async function attempt(day: number, { weighIns = [], days = {} }: { weighIns?: [number, number][]; days?: Record<number, DaySeed> } = {}) {
  const start = addDaysISO(TODAY, -(day - 1))
  for (const [d, weight_kg] of weighIns) await measurementRepo.save({ date: addDaysISO(start, d - 1), weight_kg })
  const id = await addChallenge({ startDate: start, attemptNumber: 1, status: 'active', variant: 'hard' })
  await profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' })
  await transaction(async (db) => {
    for (const [n, seed] of Object.entries(days)) {
      const dayNumber = Number(n)
      const dayEntryId = await insertRow(db, 'dayEntries', {
        challengeId: id,
        date: addDaysISO(start, dayNumber - 1),
        dayNumber,
        water_ml: seed.water_ml ?? 0,
        pages_read: seed.pages_read ?? 0,
        dietFollowed: false,
        noAlcohol: false,
        completed: false,
      })
      for (const [type, durationMin, isOutdoor, feel] of seed.workouts ?? []) await insertRow(db, 'workouts', { dayEntryId, type, durationMin, isOutdoor, feel })
    }
  })
  return { start }
}

const show = async () => {
  await render(<StatsRoute />, { wrapper: Providers })
  await screen.findByText('Stats')
}
const editRow = (start: string, d: number) => ({ name: `Edit weigh-in of ${formatDisplayDate(addDaysISO(start, d - 1))}` })

describe('weight', () => {
  it('opens on the chart and unfolds the weigh-ins from the arrow', async () => {
    const { start } = await attempt(3, { weighIns: [[1, 88], [3, 87.4]] })
    await show()
    expect(await screen.findByLabelText('Weight by challenge day chart')).toBeOnTheScreen()
    expect(screen.queryByRole('button', editRow(start, 3))).toBeNull()

    const arrow = screen.getByRole('button', { name: 'Weigh-ins' })
    expect(arrow.props.accessibilityState).toMatchObject({ expanded: false })
    await fireEvent.press(arrow)
    expect(screen.getByRole('button', { name: 'Weigh-ins' }).props.accessibilityState).toMatchObject({ expanded: true })
    const row = screen.getByRole('button', editRow(start, 3))
    expect(within(row).getByText(/^Day 3 · /)).toBeOnTheScreen()
    expect(within(row).getByText('87.4')).toBeOnTheScreen()
    expect(within(row).getByText('▼ 0.6')).toBeOnTheScreen()
  })

  it('asks before deleting a weigh-in, in the same sheet, then deletes it', async () => {
    const { start } = await attempt(3, { weighIns: [[1, 88], [3, 87.4]] })
    await show()
    await fireEvent.press(await screen.findByRole('button', { name: 'Weigh-ins' }))
    await fireEvent.press(screen.getByRole('button', editRow(start, 3)))
    expect(await screen.findByRole('header', { name: 'Edit weigh-in' })).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Delete this weigh-in' }))
    expect(await screen.findByRole('header', { name: 'Delete this weigh-in?' })).toBeOnTheScreen()
    expect(screen.getByText(`${formatDisplayDate(addDaysISO(start, 2))} — this can't be undone.`)).toBeOnTheScreen()
    expect(screen.queryByRole('header', { name: 'Edit weigh-in' })).toBeNull()
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByRole('button', editRow(start, 3))).toBeNull())
  })

  it('logs a weigh-in from "+ Log", and refuses to move one onto a date already taken', async () => {
    const { start } = await attempt(3, { weighIns: [[1, 88]] })
    await show()
    await fireEvent.press(await screen.findByRole('button', { name: '+ Log' }))
    expect(await screen.findByRole('header', { name: 'Log a weigh-in' })).toBeOnTheScreen()
    await fireEvent.changeText(screen.getByLabelText('Weight'), '86.9')
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('86.9 kg')).toBeOnTheScreen()

    await fireEvent.press(screen.getByRole('button', { name: 'Weigh-ins' }))
    await fireEvent.press(screen.getByRole('button', editRow(start, 3)))
    expect(await screen.findByRole('header', { name: 'Edit weigh-in' })).toBeOnTheScreen()
    const [y, m, d] = start.split('-').map(Number)
    await fireEvent(screen.getByTestId('date-field'), 'valueChange', null, new Date(y, m - 1, d, 12))
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(`There's already a weigh-in on ${formatDisplayDate(start)} — edit that one instead.`)).toBeOnTheScreen()
  })

  it('says so when there are no weigh-ins yet, with no arrow; asks for another after one', async () => {
    await attempt(1)
    await show()
    expect(await screen.findByText(/^No weigh-ins yet\./)).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Weigh-ins' })).toBeNull()
    await act(async () => void (await measurementRepo.save({ date: TODAY, weight_kg: 80 })))
    expect(await screen.findByText('Log another weigh-in to see your trend.')).toBeOnTheScreen()
  })

  it("shows this attempt's weight and its change from the start", async () => {
    const { start } = await attempt(11, { weighIns: [[-90, 95], [0, 88.4], [5, 87.1], [11, 85.8]] })
    await show()
    expect(await screen.findByText('−2.6 kg')).toBeOnTheScreen()
    expect(screen.getByText('85.8 kg')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Weigh-ins' }))
    expect(screen.getByRole('button', editRow(start, 0))).toBeOnTheScreen()
    expect(screen.queryByRole('button', editRow(start, -90))).toBeNull()
  })

  it('counts from the first weigh-in when none came by Day 1', async () => {
    await attempt(9, { weighIns: [[5, 87], [9, 86.4]] })
    await show()
    expect(await screen.findByText('−0.6 kg')).toBeOnTheScreen()
  })

  it('reads the chart from a finger anywhere on it, and keeps the reading once let go', async () => {
    // Days 1 to 10, losing 0.1 kg a day: Day 10 is 87 kg, and the trend, lagging behind, is at 87.4 kg.
    const { start } = await attempt(10, { weighIns: Array.from({ length: 10 }, (_, i): [number, number] => [i + 1, 88 - 0.1 * (i + 1)]) })
    await show()
    const chart = await screen.findByLabelText('Weight by challenge day chart')
    await fireEvent(chart, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 160 } } })
    const day = (n: number) => `Day ${n} · ${format(parseISO(addDaysISO(start, n - 1)), 'EEE d MMM')}`
    const touch = (x: number) => ({ nativeEvent: { locationX: x, touches: [], changedTouches: [] }, touchHistory: { touchBank: [] } })

    await fireEvent(chart, 'responderGrant', touch(325))
    expect(await screen.findByText(`${day(10)} · trend 87.4`)).toBeOnTheScreen()
    expect(screen.getByText('87.0 kg')).toBeOnTheScreen()
    expect(screen.getByTestId('weight-reading')).toBeOnTheScreen()

    await fireEvent(screen.getByLabelText('Weight by challenge day chart'), 'responderMove', touch(16))
    expect(await screen.findByText(`${day(1)} · trend 87.9`)).toBeOnTheScreen()
    await fireEvent(screen.getByLabelText('Weight by challenge day chart'), 'responderRelease', touch(16))
    expect(screen.getByText(`${day(1)} · trend 87.9`)).toBeOnTheScreen()
  })

  it('closes its sheet when a screen that covers the app brings Today forward', async () => {
    await attempt(3)
    function Covering() {
      useHideTabBar()
      return null
    }
    const ui = (covered: boolean) => (
      <>
        <StatsRoute />
        {covered && <Covering />}
      </>
    )
    const view = await render(ui(false), { wrapper: Providers })
    await fireEvent.press(await screen.findByRole('button', { name: '+ Log' }))
    expect(await screen.findByRole('header', { name: 'Log a weigh-in' })).toBeOnTheScreen()
    await view.rerender(ui(true))
    await waitFor(() => expect(screen.queryByRole('header', { name: 'Log a weigh-in' })).toBeNull())
  })
})

describe('the tiles', () => {
  it('keeps only the water and pages tiles, with their totals', async () => {
    await attempt(2, { days: { 1: { water_ml: 3800, pages_read: 120 } } })
    await show()
    expect(await screen.findByText('3.8 L')).toBeOnTheScreen()
    expect(screen.getByText('Water drunk')).toBeOnTheScreen()
    expect(screen.getByText('120')).toBeOnTheScreen()
    expect(screen.getByText('Pages read')).toBeOnTheScreen()
    for (const gone of ['Training', 'Current streak', 'Perfect days']) expect(screen.queryByText(gone)).toBeNull()
  })
})

const seedWorkouts = () =>
  attempt(3, {
    days: {
      1: { workouts: [['Running', 45, true, 4], ['Weights', 50, false]] },
      2: { workouts: [['Running', 50, true, 5]] },
    },
  })

describe('workouts', () => {
  it('adds up the attempt, with every card closed', async () => {
    await seedWorkouts()
    await show()
    const running = await screen.findByRole('button', { name: 'Running, 2 sessions' })
    expect(running.props.accessibilityState).toMatchObject({ expanded: false })
    expect(screen.getByRole('button', { name: 'Weights, 1 session' }).props.accessibilityState).toMatchObject({ expanded: false })
    expect(within(running).getByText(/Your favorite/)).toBeOnTheScreen()
    expect(within(screen.getByRole('button', { name: 'Weights, 1 session' })).queryByText(/Your favorite/)).toBeNull()

    expect(screen.getByLabelText('2h25 of sweat')).toBeOnTheScreen()
    expect(screen.getByText('2h25')).toBeOnTheScreen()
    expect(screen.getByText('3 sessions')).toBeOnTheScreen()
    expect(screen.getByText('2 under the sky')).toBeOnTheScreen()
  })

  it('opens a card on its sessions, newest first, and how they felt', async () => {
    const { start } = await seedWorkouts()
    await show()
    await fireEvent.press(await screen.findByRole('button', { name: 'Running, 2 sessions' }))
    const sessions = screen.getByLabelText('Running sessions')
    const days = within(sessions).getAllByText(/^Day \d$/).map((t) => t.props.children.join(''))
    expect(days).toEqual(['Day 2', 'Day 1'])
    expect(within(sessions).getByText(format(parseISO(addDaysISO(start, 1)), 'EEE d MMM'))).toBeOnTheScreen()
    expect(within(sessions).getByText('50 min · Outdoor')).toBeOnTheScreen()
    expect(within(sessions).getByLabelText('Great')).toBeOnTheScreen()
    const feels = within(screen.getByLabelText('How it felt')).getAllByLabelText(/: \d$/).map((f) => f.props.accessibilityLabel)
    expect(feels).toEqual(['Great: 1', 'Good: 1'])
  })

  it('opens one card at a time, where it is, and closes the open one when tapped', async () => {
    await seedWorkouts()
    await show()
    await fireEvent.press(await screen.findByRole('button', { name: 'Running, 2 sessions' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Weights, 1 session' }))
    expect(screen.getByRole('button', { name: 'Weights, 1 session' }).props.accessibilityState).toMatchObject({ expanded: true })
    expect(screen.getByRole('button', { name: 'Running, 2 sessions' }).props.accessibilityState).toMatchObject({ expanded: false })
    expect(screen.getAllByRole('button', { name: /sessions?$/ }).map((b) => b.props.accessibilityLabel)).toEqual(['Running, 2 sessions', 'Weights, 1 session'])
    await fireEvent.press(screen.getByRole('button', { name: 'Weights, 1 session' }))
    await waitFor(() => expect(screen.queryByLabelText(/^\w+ sessions$/)).toBeNull())
  })

  it('lists the activities not tried yet', async () => {
    await seedWorkouts()
    await show()
    const untried = await screen.findByLabelText('Not tried yet')
    expect(within(untried).getAllByText(/./).map((t) => t.props.children)).toEqual(['Walking', 'Yoga', 'Cycling', 'Swimming', 'Other'])
  })

  it('with no workouts yet, says so, and shows no totals', async () => {
    await attempt(1)
    await show()
    expect(await screen.findByRole('header', { name: 'No workouts yet' })).toBeOnTheScreen()
    expect(screen.getByText('Log your first one from Today.')).toBeOnTheScreen()
    expect(screen.queryByText(/of sweat/)).toBeNull()
    expect(within(screen.getByLabelText('Not tried yet')).getAllByText(/./)).toHaveLength(7)
  })
})
