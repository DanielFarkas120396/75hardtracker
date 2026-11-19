// The Journey tab as the phone shows it: the cases of the plan's Review Focus
// (docs/superpowers/plans/2026-11-18-v4-part-5-journey.md), from the web's JourneyScreen and DayCard tests.
import { addDaysISO, dateForDayNumber, formatShortDay, todayISO } from '@logic/dates'
import type { ChallengeVariant } from '@logic/rulesets'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native'
import * as Font from 'expo-font'
import { ScrollView, StyleSheet } from 'react-native'
import JourneyRoute from '../../app/(tabs)/journey'
import { addChallenge, freshDatabase } from '../../db/__tests__/fixtures'
import { transaction } from '../../db/open'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import { profileRepo } from '../../db/repositories/profileRepo'
import { insertRow } from '../../db/table'
import type { WorkoutType } from '../../db/types'
import { useClock } from '../../hooks/useClock'
import { useHideTabBar } from '../../hooks/useTabBar'
import { Providers } from '../../today/__tests__/support'

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }))
jest.mock('../../files/store', () => {
  const fs = jest.requireActual<typeof import('node:fs')>('node:fs')
  const os = jest.requireActual<typeof import('node:os')>('node:os')
  const path = jest.requireActual<typeof import('node:path')>('node:path')
  const { nodeStore } = jest.requireActual<typeof import('../../files/__tests__/nodeStore')>('../../files/__tests__/nodeStore')
  return { expoStore: nodeStore(fs.mkdtempSync(path.join(os.tmpdir(), 'journey-'))) }
})

// The real clock, except where a test sets the time of day.
jest.mock('../../hooks/useClock', () => ({ useClock: jest.fn(jest.requireActual('../../hooks/useClock').useClock) }))

function Covering() {
  useHideTabBar()
  return null
}

const TODAY = todayISO()
const startFor = (day: number) => addDaysISO(TODAY, -(day - 1))

beforeEach(async () => {
  jest.mocked(Font.useFonts).mockReturnValue([true, null])
  jest.mocked(useClock).mockReset().mockImplementation(jest.requireActual('../../hooks/useClock').useClock)
  await freshDatabase()
})
afterEach(() => jest.restoreAllMocks())

interface DaySeed {
  completed?: boolean
  notes?: string
  photo?: boolean
  workouts?: [WorkoutType, number][]
}

/** An attempt whose Day `day` is today, with the days given (each one's entry written straight to the database). */
async function attempt(day: number, days: Record<number, DaySeed>, variant: ChallengeVariant = 'medium', restoredDays?: number[]) {
  const start = startFor(day)
  const id = await addChallenge({ startDate: start, attemptNumber: 2, status: 'active', variant, restoredDays })
  await profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' })
  await transaction(async (db) => {
    for (const [n, seed] of Object.entries(days)) {
      const dayNumber = Number(n)
      const date = dateForDayNumber(start, dayNumber)
      const photoId = seed.photo ? await insertRow(db, 'photos', { date, file: `${dayNumber}.jpg`, mimeType: 'image/jpeg' }) : undefined
      const entryId = await insertRow(db, 'dayEntries', {
        challengeId: id,
        date,
        dayNumber,
        water_ml: 3800,
        pages_read: 10,
        dietFollowed: true,
        noAlcohol: true,
        notes: seed.notes,
        photoId,
        completed: seed.completed ?? true,
      })
      for (const [type, durationMin] of seed.workouts ?? []) await insertRow(db, 'workouts', { dayEntryId: entryId, type, durationMin, isOutdoor: false })
    }
  })
  return { id, start }
}

const done = (from: number, to: number, skip: number[] = []): Record<number, DaySeed> =>
  Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => from + i).filter((d) => !skip.includes(d)).map((d) => [d, {}]))

const show = async () => {
  await render(<JourneyRoute />, { wrapper: Providers })
  await screen.findByText('Journey')
}
const covers = () =>
  screen
    .getAllByRole('header')
    .map((h) => h.props.accessibilityLabel as string | undefined)
    .filter((label) => label !== undefined && label !== 'Journey' && label.includes(', '))

describe('the log', () => {
  it('lists the days newest first, in chapters by world, with the next world locked on top', async () => {
    const { start } = await attempt(12, { ...done(1, 11, [4]), 11: { notes: 'Rain walk.\nThen more.' }, 12: { completed: false } })
    await show()

    await waitFor(() => expect(covers()).toEqual(['The Dark Forest, In 11 days', 'The Wasteland, 1/12', 'Hell, Cleared']))
    const rows = screen.getAllByRole('button').filter((b) => !b.props.accessibilityLabel?.startsWith('Go to'))
    expect(within(rows[0]).getByText('Today · Day 12')).toBeOnTheScreen()
    expect(within(rows[0]).getByText(`${formatShortDay(TODAY)} · In progress`)).toBeOnTheScreen()
    expect(within(rows[1]).getByText('Day 11')).toBeOnTheScreen()
    expect(within(rows[1]).getByText('Rain walk.')).toBeOnTheScreen()
    expect(screen.queryByText(/Then more/)).toBeNull()
    expect(screen.getByText(`Days 1–10 · 9/10 · 1 joker · done ${formatShortDay(dateForDayNumber(start, 10))}`)).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: /Day 4 · forgiven with a joker/ })).toBeOnTheScreen()
    expect(screen.getByText('Days 11–22 · 11 to go')).toBeOnTheScreen()
  })

  it("counts today as to go until it's done, then nine to go", async () => {
    await attempt(1, { 1: { completed: false } })
    await show()
    expect(await screen.findByText('Days 1–10 · 10 to go')).toBeOnTheScreen()
    expect(screen.getByText('0/10')).toBeOnTheScreen()

    // Straight to the database: the repository would recompute `completed` from the tasks.
    await act(async () => transaction((db) => db.runAsync('UPDATE dayEntries SET completed = 1')))
    expect(await screen.findByText('Days 1–10 · 9 to go')).toBeOnTheScreen()
  })

  it('shows only Hell waiting before Day 1', async () => {
    await attempt(0, {})
    await show()
    await waitFor(() => expect(covers()).toEqual(['Hell, Tomorrow']))
    expect(screen.getByText('Not started yet')).toBeOnTheScreen()
    expect(screen.getByText('0% of the climb from Hell to Heaven')).toBeOnTheScreen()
  })

  it('clears every world after Day 75, with nothing ahead', async () => {
    await attempt(76, done(1, 75), 'hard')
    await show()
    await waitFor(() =>
      expect(covers()).toEqual(['Heaven, Cleared', 'The Mountains, Cleared', 'The Meadows, Cleared', 'The Dark Forest, Cleared', 'The Wasteland, Cleared', 'Hell, Cleared']),
    )
    expect(screen.getByText('100% of the climb from Hell to Heaven')).toBeOnTheScreen()
    expect(screen.queryByText(/^Today ·/)).toBeNull()
  })

  it('shows the climb so far on its card', async () => {
    await attempt(12, done(1, 11))
    await show()
    expect(await screen.findByText('16% of the climb from Hell to Heaven')).toBeOnTheScreen()
    expect(screen.getByLabelText('16% of the climb, through 6 worlds')).toBeOnTheScreen()
  })
})

describe('a day row', () => {
  it('shows a done day with its date, notes, workouts and photo, and one kept from a backup', async () => {
    const { start } = await attempt(
      6,
      { ...done(1, 3), 5: { notes: 'Hill run.', photo: true, workouts: [['Running', 45], ['Yoga', 50]] } },
      'soft',
      [1],
    )
    await show()

    await screen.findByText('Hill run.')
    // Its photo's label comes first in the row's name: found by its title instead.
    const day5 = screen.getAllByRole('button').find((b) => within(b).queryByText('Day 5') !== null)!
    expect(within(day5).getByText(formatShortDay(dateForDayNumber(start, 5)))).toBeOnTheScreen()
    expect(within(day5).getByText('Hill run.')).toBeOnTheScreen()
    expect(await within(day5).findByLabelText('Running')).toBeOnTheScreen()
    expect(within(day5).getByLabelText('Yoga')).toBeOnTheScreen()
    expect(within(day5).getByText('45 min')).toBeOnTheScreen()
    expect(await within(day5).findByLabelText('Progress photo, Day 5')).toBeOnTheScreen()
    expect(within(screen.getByRole('button', { name: /^Day 1/ })).getByText('Not in your backup')).toBeOnTheScreen()
  })

  it('says Not finished on yesterday while it can still be finished (until noon)', async () => {
    jest.mocked(useClock).mockReturnValue({ today: TODAY, nowMin: 9 * 60 })
    await attempt(3, { 1: {}, 2: { completed: false } })
    await show()
    const day2 = await waitFor(() => screen.getAllByRole('button').find((b) => within(b).queryByText('Day 2') !== null)!)
    expect(within(day2).getByText('Not finished')).toBeOnTheScreen()
  })

  it('says Done on today once it is', async () => {
    await attempt(2, { 1: {}, 2: {} })
    await show()
    expect(await screen.findByText(`${formatShortDay(TODAY)} · Done`)).toBeOnTheScreen()
  })
})

describe('the day card', () => {
  const card = () => screen.queryByRole('header', { name: /^Day \d+ ·/ })

  it('opens from the row tapped with the day, its notes and its workouts, and closes from Close', async () => {
    const { start } = await attempt(3, { 1: { notes: 'First day done.', workouts: [['Weights', 50]] }, 2: {} })
    await show()

    fireEvent.press(await screen.findByRole('button', { name: /^Day 1/ }), { nativeEvent: { pageX: 60, pageY: 500 } })

    expect(await screen.findByRole('header', { name: `Day 1 · ${formatShortDay(dateForDayNumber(start, 1))}` })).toBeOnTheScreen()
    expect(screen.getAllByText('First day done.').length).toBe(2)
    expect(screen.getByText('No photo this day')).toBeOnTheScreen()
    expect(screen.getAllByLabelText('Weights').length).toBe(2)
    expect(screen.queryByText(/pages/)).toBeNull()

    fireEvent.press(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(card()).toBeNull())
  })

  it('follows what is logged while it is open, and closes from a tap beside it', async () => {
    await attempt(2, { 1: {}, 2: { completed: false } })
    await show()
    fireEvent.press(await screen.findByRole('button', { name: /Today · Day 2/ }), { nativeEvent: { pageX: 60, pageY: 300 } })
    expect(await screen.findByText('No notes')).toBeOnTheScreen()

    const today = (await dayEntryRepo.getAllForChallenge(1)).find((e) => e.dayNumber === 2)!
    await act(async () => dayEntryRepo.update(today.id, { notes: 'Written meanwhile.' }))
    expect((await screen.findAllByText('Written meanwhile.')).length).toBe(2)

    fireEvent.press(screen.getByTestId('day-card-backdrop'))
    await waitFor(() => expect(card()).toBeNull())
  })

  it('says when nothing was logged, and when a day is not in the backup', async () => {
    await attempt(4, { 2: {}, 3: {} }, 'soft', [2])
    await show()

    fireEvent.press(await screen.findByRole('button', { name: /Day 1 · forgiven with a joker/ }), { nativeEvent: { pageX: 60, pageY: 600 } })
    expect(await screen.findByText('Nothing was logged this day.')).toBeOnTheScreen()
    fireEvent.press(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(card()).toBeNull())

    fireEvent.press(screen.getByRole('button', { name: /^Day 2/ }), { nativeEvent: { pageX: 60, pageY: 500 } })
    expect(await screen.findByRole('header', { name: /^Day 2 ·/ })).toBeOnTheScreen()
    expect(screen.getAllByText('Not in your backup').length).toBe(2)
    expect(screen.queryByText('Nothing was logged this day.')).toBeNull()
  })

  it('closes when a screen that covers the app brings Today forward', async () => {
    await attempt(3, { 1: {}, 2: {} })
    const ui = (covered: boolean) => (
      <>
        <JourneyRoute />
        {covered && <Covering />}
      </>
    )
    const view = await render(ui(false), { wrapper: Providers })
    fireEvent.press(await screen.findByRole('button', { name: /^Day 1/ }), { nativeEvent: { pageX: 60, pageY: 500 } })
    expect(await screen.findByRole('header', { name: /^Day 1 ·/ })).toBeOnTheScreen()
    await view.rerender(ui(true))
    await waitFor(() => expect(card()).toBeNull())
  })

  it('is one card: another day swaps into it', async () => {
    await attempt(3, { 1: {}, 2: {} })
    await show()
    fireEvent.press(await screen.findByRole('button', { name: /^Day 1/ }), { nativeEvent: { pageX: 60, pageY: 500 } })
    expect(await screen.findByRole('header', { name: /^Day 1 ·/ })).toBeOnTheScreen()
    fireEvent.press(screen.getByRole('button', { name: /^Day 2/ }), { nativeEvent: { pageX: 60, pageY: 400 } })
    expect(await screen.findByRole('header', { name: /^Day 2 ·/ })).toBeOnTheScreen()
    expect(screen.queryByRole('header', { name: /^Day 1 ·/ })).toBeNull()
  })
})

describe('the rail', () => {
  it('has a section per world, sized by its days, filled to the day reached, each a way to its chapter', async () => {
    await attempt(12, done(1, 11))
    await show()

    const sections = ['Hell', 'The Wasteland', 'The Dark Forest', 'The Meadows', 'The Mountains', 'Heaven'].map((name) =>
      screen.getByRole('button', { name: `Go to ${name}` }),
    )
    expect(sections.map((s) => StyleSheet.flatten(s.props.style).flexGrow)).toEqual([10, 12, 15, 13, 14, 11])
  })

  it("jumps to a reached world's cover, and to the top for one ahead", async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype as unknown as { scrollTo: (o: object) => void }, 'scrollTo').mockImplementation(() => {})
    await attempt(12, done(1, 11))
    await show()
    await waitFor(() => expect(covers()).toHaveLength(3))
    fireEvent(screen.getByTestId('cover-hell'), 'layout', { nativeEvent: { layout: { x: 0, y: 1400, width: 300, height: 112 } } })

    fireEvent.press(screen.getByRole('button', { name: 'Go to Hell' }))
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 1376, animated: true })

    fireEvent.press(screen.getByRole('button', { name: 'Go to Heaven' }))
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 0, animated: true })
  })
})
