// The Today screen, from the web's TodayScreen, TaskBoard, DayBoard and task tests, where they don't
// concern what comes with later parts (the fills, the morph, the evening plan, the celebration).
import { addDaysISO, dateForDayNumber, formatShortDay, formatWeekday } from '@logic/dates'
import { SETTING_KEYS } from '@logic/settingKeys'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { useCameraPermissions } from 'expo-camera'
import * as Font from 'expo-font'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { AccessibilityInfo } from 'react-native'
import { addChallenge, addPerfectDays, freshDatabase } from '../../db/__tests__/fixtures'
import { challengeRepo } from '../../db/repositories/challengeRepo'
import { bookRepo } from '../../db/repositories/bookRepo'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import { measurementRepo } from '../../db/repositories/measurementRepo'
import { photoRepo } from '../../db/repositories/photoRepo'
import { profileRepo } from '../../db/repositories/profileRepo'
import { settingsRepo } from '../../db/repositories/settingsRepo'
import { workoutRepo } from '../../db/repositories/workoutRepo'
import { useClock } from '../../hooks/useClock'
import { useNowMinutes } from '../../hooks/useNowMinutes'
import { useToday } from '../../hooks/useToday'
import { prepareShot } from '../photo'
import { Today } from '../TodayScreen'
import { entryOf, Providers, startAttempt, TODAY } from './support'

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }))
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(async () => {}), ImpactFeedbackStyle: { Light: 'light' } }))
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }))
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({ play: jest.fn(), seekTo: jest.fn(async () => {}) }),
  setAudioModeAsync: jest.fn(async () => {}),
}))
// The phone's own pickers are native views: a plain view stands in, and tests send it the picked value.
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { View } = jest.requireActual<typeof import('react-native')>('react-native')
    return <View {...props} />
  },
}))
// The mood lighting is drawn (it has no words): here a line of text says what it was asked for.
jest.mock('../MenaceAtmosphere', () => ({
  MenaceAtmosphere: ({ level, flashes }: { level: string; flashes: number }) => {
    const { Text: Line } = jest.requireActual<typeof import('react-native')>('react-native')
    return <Line>{`atmosphere: ${level}, ${flashes}`}</Line>
  },
}))
jest.mock('../../hooks/useClock', () => ({ useClock: jest.fn() }))
jest.mock('../../hooks/useNowMinutes', () => ({ useNowMinutes: jest.fn() }))
jest.mock('../../hooks/useToday', () => ({ useToday: jest.fn() }))
// The picture's preparation is the phone's (its own tests cover the sizes): here it hands back a file to save.
jest.mock('../photo', () => ({ prepareShot: jest.fn() }))
// The duck redraws every frame (he has his own tests): here a line of text says which mood he is in.
jest.mock('../../components/mascot/Mascot', () => ({
  Mascot: ({ mood, reaction }: { mood: string; reaction?: { kind: string } }) => {
    const { Text: Line } = jest.requireActual<typeof import('react-native')>('react-native')
    return <Line>{`duck: ${mood}${reaction ? `, ${reaction.kind}` : ''}`}</Line>
  },
}))
// Pictures go to a folder on this computer.
jest.mock('../../files/store', () => {
  const fs = jest.requireActual<typeof import('node:fs')>('node:fs')
  const os = jest.requireActual<typeof import('node:os')>('node:os')
  const path = jest.requireActual<typeof import('node:path')>('node:path')
  const { nodeStore } = jest.requireActual<typeof import('../../files/__tests__/nodeStore')>('../../files/__tests__/nodeStore')
  return { expoStore: nodeStore(fs.mkdtempSync(path.join(os.tmpdir(), 'today-'))) }
})
// The phone's camera is a native view: a plain view stands in, and the test takes its pictures.
const mockTakePicture = jest.fn()
jest.mock('expo-camera', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  const { View } = jest.requireActual<typeof import('react-native')>('react-native')
  class CameraView extends React.Component<Record<string, unknown>> {
    takePictureAsync = (options: unknown) => mockTakePicture(options)
    render() {
      return <View {...this.props} />
    }
  }
  return { CameraView, useCameraPermissions: jest.fn() }
})

const MORNING = 10 * 60
const HARD_RULE = '2 sessions of at least 45 minutes, one of them outdoors.'
const shots = mkdtempSync(join(tmpdir(), 'shots-'))
let shotCount = 0
/** A picture file, as the camera or the library hands one over. */
function newShot(): string {
  const path = join(shots, `shot-${++shotCount}.jpg`)
  writeFileSync(path, `picture ${shotCount}`)
  return pathToFileURL(path).href
}

/** Sets the date and the time of day everywhere the app reads them. */
function setClock(today: string, nowMin: number) {
  jest.mocked(useClock).mockReturnValue({ today, nowMin })
  jest.mocked(useToday).mockReturnValue(today)
  jest.mocked(useNowMinutes).mockReturnValue(nowMin)
}

const allowCamera = (granted: boolean) =>
  jest.mocked(useCameraPermissions).mockReturnValue([
    { granted, canAskAgain: false, status: granted ? 'granted' : 'denied', expires: 'never' } as never,
    jest.fn(),
    jest.fn(),
  ])

beforeEach(async () => {
  jest.mocked(Font.useFonts).mockReturnValue([true, null])
  // React Native's test setup already ships this as a mock: restoring spies doesn't empty it.
  jest.mocked(AccessibilityInfo.announceForAccessibility).mockClear()
  setClock(TODAY, MORNING)
  jest.mocked(prepareShot).mockImplementation(async () => newShot())
  jest.mocked(Haptics.impactAsync).mockClear()
  mockTakePicture.mockReset().mockResolvedValue({ uri: 'file:///camera/raw.jpg', width: 3000, height: 4000 })
  allowCamera(true)
  await freshDatabase()
})

afterEach(() => {
  jest.restoreAllMocks()
})

const show = () => render(<Today />, { wrapper: Providers })
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const press = async (name: string | RegExp) => fireEvent.press(await screen.findByRole('button', { name }))
/** The last button of that name on screen: the one in the sheet, when the page has one too (the weigh-in's Save). */
const pressLast = async (name: string) => {
  await screen.findAllByRole('button', { name })
  await fireEvent.press(screen.getAllByRole('button', { name }).at(-1)!)
}
const today = (challengeId: number, day = 1) => dayEntryRepo.getByChallengeAndDayNumber(challengeId, day)
/** Opens a task's sheet from its tile, and waits for it. */
async function openSheet(tile: RegExp, ruleLine: string | RegExp) {
  await press(tile)
  await screen.findByText(ruleLine)
}

describe('Today', () => {
  it('opens on the day with the attempt, the gauge, the duck and the reason', async () => {
    await startAttempt()
    await show()
    expect(await screen.findByLabelText('Day 1, 75 Hard #1')).toBeOnTheScreen()
    expect(screen.getByLabelText('0 of 5 tasks done')).toBeOnTheScreen()
    expect(screen.getByText("New day, Daniel. I'm watching.")).toBeOnTheScreen()
    expect(screen.getByText('duck: watching')).toBeOnTheScreen()
    expect(screen.getByText('“A fresh start”')).toBeOnTheScreen()
    // Day 1: no streak to show yet. Hard has no jokers.
    expect(screen.queryByLabelText(/^Streak/)).toBeNull()
    expect(screen.queryByText(/joker/)).toBeNull()
  })

  it('shows the streak and the jokers left where the challenge has them', async () => {
    const challengeId = await startAttempt(2, 'medium')
    await addPerfectDays(challengeId, addDaysISO(TODAY, -1), 1, 1)
    await show()
    expect(await screen.findByLabelText('Day 2, 75 Medium #1')).toBeOnTheScreen()
    expect(screen.getByLabelText('Streak: 1 day')).toBeOnTheScreen()
    expect(screen.getByText(/^\d+ jokers?$/)).toBeOnTheScreen()
  })

  it('lays the open tasks out quickest first, and the done ones as chips', async () => {
    const challengeId = await startAttempt()
    const entry = await entryOf(challengeId)
    await dayEntryRepo.adjustPages(entry.id, 10)
    await show()
    await screen.findByLabelText('Day 1, 75 Hard #1')
    const tiles = screen.getAllByRole('button', { name: /^(Diet|Photo|Workouts|Water), (?!.*done$)/ }).map((tile) => String(tile.props.accessibilityLabel).split(',')[0])
    expect(tiles).toEqual(['Diet', 'Photo', 'Workouts', 'Water'])
    expect(button('Reading, 10 pages, done')).toBeOnTheScreen()
    expect(screen.getByLabelText('1 of 5 tasks done')).toBeOnTheScreen()
    expect(screen.getByText('Started. Not finished.')).toBeOnTheScreen()
  })

  it('logs a whole day through the screen, down to "Day 1 won"', async () => {
    const challengeId = await startAttempt()
    await show()
    await screen.findByLabelText('Day 1, 75 Hard #1')

    // Diet: the two switches on the tile.
    await fireEvent.press(screen.getByRole('switch', { name: 'I followed my diet' }))
    await fireEvent.press(screen.getByRole('switch', { name: 'No alcohol' }))
    expect(await screen.findByRole('button', { name: 'Diet, Followed, done' })).toBeOnTheScreen()
    expect(screen.getByText('duck: watching, approve')).toBeOnTheScreen()

    // Reading: the shortcut.
    await press('Add 10 pages')
    expect(await screen.findByRole('button', { name: 'Reading, 10 pages, done' })).toBeOnTheScreen()

    // Water: its sheet, eight half-litres.
    await openSheet(/^Water, /, 'Goal: 3.8 L a day.')
    for (let pour = 0; pour < 8; pour++) await fireEvent.press(button('+ 500 ml'))
    expect(await screen.findByRole('button', { name: 'Water, 4 L, done' })).toBeOnTheScreen()
    // Done inside its sheet: the cheer, then the sheet closes by itself.
    expect(screen.getByText('Fully hydrated! 💧')).toBeOnTheScreen()
    await waitFor(() => expect(screen.queryByText('Goal: 3.8 L a day.')).toBeNull(), { timeout: 4000 })

    // Workouts: two sessions through the tile's shortcut.
    for (const expected of ['Workouts, 1 of 2 · 45 min', 'Workouts, 2 workouts · 90 min, done']) {
      await press('Add workout')
      await pressLast('Save')
      await screen.findByRole('button', { name: expected.replace(' · ', ', ') })
    }

    // Photo: the camera sheet.
    await press('Take photo')
    await fireEvent(await screen.findByTestId('camera-preview'), 'cameraReady')
    await fireEvent.press(screen.getAllByRole('button', { name: 'Take photo' }).at(-1)!)
    await press('Use photo')
    expect(await screen.findByText('Saved!')).toBeOnTheScreen()

    expect(await screen.findByText('Day 1 won')).toBeOnTheScreen()
    expect(screen.getByLabelText('5 of 5 tasks done')).toBeOnTheScreen()
    expect(button('How did it go?')).toBeOnTheScreen()
    expect(screen.getByText('duck: content, approve')).toBeOnTheScreen()
    // Every task is a chip now, and the Notes button has given way to the hero's.
    expect(screen.queryByRole('button', { name: 'Notes' })).toBeNull()
    expect((await today(challengeId))!.completed).toBe(true)
    // One light tap per task done.
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(5)
    // The camera sheet leaves by itself.
    await waitFor(() => expect(screen.queryByTestId('camera-preview')).toBeNull(), { timeout: 4000 })
  }, 30_000)

  it('says "{Title} done." aloud when a task is done from the board', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    await startAttempt()
    await show()
    await press('Add 10 pages')
    await waitFor(() => expect(announce).toHaveBeenCalledWith('Reading done.'))
  })

  it('counts every quick tap, and Undo takes back exactly one pour', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    const challengeId = await startAttempt()
    await show()
    const glass = await screen.findByRole('button', { name: 'Add 250 ml' })
    for (let tap = 0; tap < 4; tap++) await fireEvent.press(glass)
    await waitFor(async () => expect((await today(challengeId))!.water_ml).toBe(1000))
    expect(await screen.findByText('Logged 250 ml')).toBeOnTheScreen()
    await waitFor(() => expect(announce).toHaveBeenCalledWith('Logged 250 ml'))
    await press('Undo')
    await waitFor(async () => expect((await today(challengeId))!.water_ml).toBe(750))
    expect(screen.queryByText('Logged 250 ml')).toBeNull()
  })

  it('moves the bookmark with the page shortcuts, and takes it back with Undo', async () => {
    const challengeId = await startAttempt()
    const bookId = await bookRepo.add({ title: 'Deep Work', totalPages: 296, currentPage: 40 })
    await settingsRepo.set(SETTING_KEYS.currentBookId, bookId)
    await show()
    await press('Add 1 page')
    expect(await screen.findByText('Logged 1 page')).toBeOnTheScreen()
    expect((await bookRepo.getById(bookId))!.currentPage).toBe(41)
    await press('Undo')
    await waitFor(async () => expect((await bookRepo.getById(bookId))!.currentPage).toBe(40))
    expect((await today(challengeId))!.pages_read).toBe(0)
  })

  it('late in the evening, puts the time left and the tasks left under the gauge', async () => {
    setClock(TODAY, 22 * 60 + 30)
    await startAttempt()
    await show()
    expect(await screen.findByText('30 min to bedtime')).toBeOnTheScreen()
    expect(screen.getByText('~5h40 of tasks left')).toBeOnTheScreen()
    expect(screen.getByText('duck: hunting')).toBeOnTheScreen()
    expect(screen.queryByText("New day, Daniel. I'm watching.")).toBeNull()
  })

  it('moves to the new day at midnight: one entry for it, and nothing of yesterday left open', async () => {
    const challengeId = await startAttempt()
    const view = await show()
    await openSheet(/^Water, /, 'Goal: 3.8 L a day.')

    setClock(addDaysISO(TODAY, 1), 0)
    await view.rerender(<Today />)
    expect(await screen.findByLabelText('Day 2, 75 Hard #1')).toBeOnTheScreen()
    expect(screen.queryByText('Goal: 3.8 L a day.')).toBeNull()
    await waitFor(async () => expect((await dayEntryRepo.getAllForChallenge(challengeId)).map((entry) => entry.dayNumber)).toEqual([1, 2]))
    expect((await today(challengeId, 2))!.date).toBe(addDaysISO(TODAY, 1))
  })
})

describe('an attempt that is not running', () => {
  it('says a day was missed, instead of a blank Today', async () => {
    await startAttempt(3)
    setClock(TODAY, 13 * 60)
    await show()
    expect(await screen.findByText('Day 1 was missed')).toBeOnTheScreen()
    expect(screen.getByText("This attempt is over. Starting again isn't built in this version yet.")).toBeOnTheScreen()
  })

  it('says so for a given-up and for a finished attempt', async () => {
    await profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' })
    await addChallenge({ startDate: addDaysISO(TODAY, -5), attemptNumber: 1, status: 'abandoned', abandonedOn: TODAY })
    const view = await show()
    expect(await screen.findByText('You gave up')).toBeOnTheScreen()
    await view.unmount()

    await freshDatabase()
    await profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' })
    await addChallenge({ startDate: addDaysISO(TODAY, -80), attemptNumber: 1, status: 'completed' })
    await show()
    expect(await screen.findByText('75 days done')).toBeOnTheScreen()
  })
})

describe('before Day 1', () => {
  it('counts down to tomorrow, with the book to pick, and creates no day', async () => {
    const challengeId = await startAttempt(0)
    await show()
    expect(await screen.findByText('Day 1 starts tomorrow')).toBeOnTheScreen()
    expect(screen.getByText('Hey Daniel')).toBeOnTheScreen()
    expect(screen.getByText('75 Hard #1')).toBeOnTheScreen()
    expect(screen.getByText('duck: waiting')).toBeOnTheScreen()
    expect(screen.getByLabelText('0 of 5 tasks done')).toBeOnTheScreen()
    expect(screen.getByText(/Use the time to pick your book, plan two workouts a day and stock up on water\./)).toBeOnTheScreen()
    expect(screen.getByText('You can still move the start date in Settings.')).toBeOnTheScreen()
    expect(screen.getByText('No books yet — add one below.')).toBeOnTheScreen()
    expect(screen.queryByText('Weigh in')).toBeNull()
    expect(await dayEntryRepo.getAllForChallenge(challengeId)).toEqual([])
  })

  it('counts the days when the start is further away', async () => {
    await startAttempt(-2)
    await show()
    expect(await screen.findByText('Day 1 starts in 3 days')).toBeOnTheScreen()
  })
})

describe('the weigh-in card', () => {
  it('asks for the starting weight on Day 1, says what is wrong, then keeps the weight without touching the day', async () => {
    const challengeId = await startAttempt()
    await show()
    expect(await screen.findByText('Your starting weight.')).toBeOnTheScreen()
    await press('Save')
    expect(await screen.findByText('Enter your weight.')).toBeOnTheScreen()
    await fireEvent.changeText(screen.getByLabelText('Weight in kg'), 'heavy')
    await press('Save')
    expect(await screen.findByText('Enter a number, like 82.5.')).toBeOnTheScreen()
    expect(await measurementRepo.getAll()).toEqual([])

    await fireEvent.changeText(screen.getByLabelText('Weight in kg'), '82,5')
    await press('Save')
    expect(await screen.findByText('82.5 kg logged.')).toBeOnTheScreen()
    expect(await measurementRepo.getByDate(TODAY)).toMatchObject({ weight_kg: 82.5 })
    // It says so for a moment, then leaves.
    await waitFor(() => expect(screen.queryByText('Weigh in')).toBeNull(), { timeout: 3000 })
    expect((await today(challengeId))!.completed).toBe(false)
    expect(screen.getByLabelText('0 of 5 tasks done')).toBeOnTheScreen()
  })

  it('gives the hour its advice after Day 1, with the last weight as a hint', async () => {
    const challengeId = await startAttempt(2)
    // Yesterday was done: past noon, an unfinished Day 1 would have ended the attempt.
    await addPerfectDays(challengeId, addDaysISO(TODAY, -1), 1, 1)
    await measurementRepo.save({ date: addDaysISO(TODAY, -1), weight_kg: 83 })
    const view = await show()
    expect(await screen.findByText('Before breakfast is best.')).toBeOnTheScreen()
    expect(screen.getByLabelText('Weight in kg').props.placeholder).toBe('83.0')
    await view.unmount()
    setClock(TODAY, 15 * 60)
    await show()
    expect(await screen.findByText('Any time today works.')).toBeOnTheScreen()
  })

  it('stays away while today has a weigh-in, and asks again if it is deleted', async () => {
    await startAttempt(2)
    const saved = await measurementRepo.save({ date: TODAY, weight_kg: 82 })
    await show()
    await screen.findByLabelText('Day 2, 75 Hard #1')
    expect(screen.queryByText('Weigh in')).toBeNull()
    if (saved.ok) await measurementRepo.remove(saved.id)
    expect(await screen.findByText('Weigh in')).toBeOnTheScreen()
  })
})

describe('the workouts sheet', () => {
  it('starts Outdoor on for an outside activity while the day needs one, and saves the session', async () => {
    const challengeId = await startAttempt()
    await show()
    await press('Add workout')
    expect(await screen.findByText("One of today's workouts must be outdoors.")).toBeOnTheScreen()
    expect(screen.getByRole('switch', { name: 'Outdoor' })).toBeChecked()
    await press('Weights')
    expect(screen.getByRole('switch', { name: 'Outdoor' })).not.toBeChecked()
    await press('Running')
    await press('Good')
    await pressLast('Save')
    const entry = (await today(challengeId))!
    await waitFor(async () =>
      expect(await workoutRepo.getForDayEntry(entry.id)).toMatchObject([{ type: 'Running', durationMin: 45, isOutdoor: true, feel: 4 }]),
    )
    // One left, and it needn't be outdoors any more.
    await press('Add workout')
    expect(await screen.findByRole('switch', { name: 'Outdoor' })).not.toBeChecked()
    expect(screen.queryByText(/must be outdoors/)).toBeNull()
  })

  it('adds a workout from the workouts sheet, which gives way to the form: one sheet at a time', async () => {
    const challengeId = await startAttempt()
    await show()
    await openSheet(/^Workouts, /, HARD_RULE)
    await press('+ Add workout')
    // At once, not after a slide: the phone can't show two sheets at the same time.
    expect(screen.queryByText(HARD_RULE)).toBeNull()
    expect(await screen.findByText("One of today's workouts must be outdoors.")).toBeOnTheScreen()
    await pressLast('Save')
    const entry = (await today(challengeId))!
    await waitFor(async () => expect(await workoutRepo.getForDayEntry(entry.id)).toHaveLength(1))
    await waitFor(() => expect(screen.queryByText("One of today's workouts must be outdoors.")).toBeNull())
  })

  it('stores one session on a double tap on Save, and none from a tap on the sheet as it leaves', async () => {
    const challengeId = await startAttempt()
    await show()
    await press('Add workout')
    const save = (await screen.findAllByRole('button', { name: 'Save' })).at(-1)!
    await fireEvent.press(save)
    await fireEvent.press(save)
    const entry = (await today(challengeId))!
    await waitFor(async () => expect(await workoutRepo.getForDayEntry(entry.id)).toHaveLength(1))
    // Saved, and sliding away: a late tap lands on nothing.
    const late = screen.queryAllByRole('button', { name: 'Save' }).at(-1)
    if (late) await fireEvent.press(late)
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(await workoutRepo.getForDayEntry(entry.id)).toHaveLength(1)
  })

  it('keeps Outdoor as set by hand, and says when the last session must be outdoors', async () => {
    const challengeId = await startAttempt()
    const entry = await entryOf(challengeId)
    await workoutRepo.add({ dayEntryId: entry.id, type: 'Weights', durationMin: 45, isOutdoor: false })
    await show()
    await press('Add workout')
    expect(await screen.findByText('This one must be outdoors.')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('switch', { name: 'Outdoor' }))
    expect(screen.getByRole('switch', { name: 'Outdoor' })).not.toBeChecked()
    await press('Walking')
    expect(screen.getByRole('switch', { name: 'Outdoor' })).not.toBeChecked()
  })

  it('cheers when the workouts are done in the sheet, stays open for the feel, and drops the cheer when undone', async () => {
    const challengeId = await startAttempt()
    const entry = await entryOf(challengeId)
    await workoutRepo.add({ dayEntryId: entry.id, type: 'Running', durationMin: 45, isOutdoor: true })
    await workoutRepo.add({ dayEntryId: entry.id, type: 'Yoga', durationMin: 40, isOutdoor: false })
    await show()
    await openSheet(/^Workouts, /, HARD_RULE)
    await fireEvent.press(screen.getAllByRole('button', { name: 'Increase' }).at(-1)!)
    expect(await screen.findByText('Both workouts done! 💪')).toBeOnTheScreen()
    await new Promise((resolve) => setTimeout(resolve, 1800))
    expect(screen.getByText(HARD_RULE)).toBeOnTheScreen()

    await fireEvent.press(screen.getAllByRole('button', { name: 'Decrease' }).at(-1)!)
    await waitFor(() => expect(screen.queryByText('Both workouts done! 💪')).toBeNull())
    expect(screen.getByText(HARD_RULE)).toBeOnTheScreen()
  })

  it('offers no recovery day on Hard, once the workouts are done, or when the week has had its own', async () => {
    const hard = await startAttempt()
    const view = await show()
    await openSheet(/^Workouts, /, HARD_RULE)
    expect(screen.queryByRole('button', { name: 'Take my recovery day' })).toBeNull()
    await view.unmount()

    await freshDatabase()
    const soft = await startAttempt(3, 'soft')
    await addPerfectDays(soft, addDaysISO(TODAY, -2), 1, 2)
    const day2 = (await today(soft, 2))!
    await dayEntryRepo.setRestDay(day2.id, true)
    const softView = await show()
    await openSheet(/^Workouts, /, /One recovery day a week\./)
    expect(screen.getByText("Day 2 was this week's recovery day.")).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Take my recovery day' })).toBeNull()
    await softView.unmount()

    await freshDatabase()
    const done = await startAttempt(1, 'soft')
    const entry = await entryOf(done)
    await workoutRepo.add({ dayEntryId: entry.id, type: 'Running', durationMin: 45, isOutdoor: true })
    await show()
    await press(/^Workouts, .* done$/)
    await screen.findByText(/One recovery day a week\./)
    expect(screen.queryByRole('button', { name: 'Take my recovery day' })).toBeNull()
    expect(hard).toEqual(expect.any(Number))
  })

  it('says a short session does not count yet, and brings a removed one back with Undo', async () => {
    const challengeId = await startAttempt()
    const entry = await entryOf(challengeId)
    const id = await workoutRepo.add({ dayEntryId: entry.id, type: 'Yoga', durationMin: 45, isOutdoor: false })
    await show()
    await openSheet(/^Workouts, /, HARD_RULE)
    await press('Decrease')
    expect(await screen.findByText("Under 45 min: saved, but it doesn't count yet.")).toBeOnTheScreen()
    expect((await workoutRepo.getForDayEntry(entry.id))[0]).toMatchObject({ id, durationMin: 40 })

    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    await press('Remove workout')
    expect(await screen.findByText('Workout removed')).toBeOnTheScreen()
    expect(announce).toHaveBeenCalledWith('Workout removed')
    await waitFor(async () => expect(await workoutRepo.getForDayEntry(entry.id)).toEqual([]))
    await press('Undo')
    await waitFor(async () => expect(await workoutRepo.getForDayEntry(entry.id)).toMatchObject([{ type: 'Yoga', durationMin: 40 }]))
  })

  it('takes and gives back the recovery day on Soft', async () => {
    const challengeId = await startAttempt(1, 'soft')
    await show()
    await openSheet(/^Workouts, /, /One recovery day a week\./)
    await press('Take my recovery day')
    expect(await screen.findByText('Recovery day ✓')).toBeOnTheScreen()
    expect((await today(challengeId))!.restDay).toBe(true)
    expect(button('Workouts, Recovery day, done')).toBeOnTheScreen()
    await press('Undo')
    await waitFor(async () => expect(await today(challengeId)).not.toHaveProperty('restDay'))
  })
})

describe('the other sheets', () => {
  it('pours any other amount of water', async () => {
    const challengeId = await startAttempt()
    await show()
    await openSheet(/^Water, /, 'Goal: 3.8 L a day.')
    await press('Increase')
    await press('Add 380 ml')
    await waitFor(async () => expect((await today(challengeId))!.water_ml).toBe(380))
    expect(await screen.findByText('0.38 L')).toBeOnTheScreen()
  })

  it('adds a book, makes it the current one, and logs the pages left onto it', async () => {
    const challengeId = await startAttempt()
    await show()
    await openSheet(/^Reading, /, /^10 pages of /)
    await press('+ Add book')
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    await pressLast('Save')
    expect(await screen.findByText('Enter a title.')).toBeOnTheScreen()
    expect(announce).toHaveBeenCalledWith('Enter a title.')
    await fireEvent.changeText(screen.getByLabelText('Book title'), 'Deep Work')
    await fireEvent.changeText(screen.getByLabelText('Total pages'), '296')
    await pressLast('Save')
    expect(await screen.findByRole('radio', { name: 'Deep Work' })).toBeChecked()

    await press('+ 10 pages')
    await waitFor(async () => expect((await today(challengeId))!.pages_read).toBe(10))
    const [book] = await bookRepo.getAll()
    expect(book).toMatchObject({ title: 'Deep Work', currentPage: 10 })
    await waitFor(async () => expect((await today(challengeId))!.bookId).toBe(book.id))
    expect(await screen.findByRole('button', { name: 'Reading, 10 pages, Deep Work, done' })).toBeOnTheScreen()
  })

  it('keeps the mood and the notes, saved once typing pauses or the sheet closes', async () => {
    const challengeId = await startAttempt()
    await show()
    await press('Notes')
    await screen.findByText("Optional — just for you. It doesn't affect completing the day.")
    await press('Great')
    await waitFor(async () => expect((await today(challengeId))!.mood).toBe(5))
    await press('Great')
    await waitFor(async () => expect(await today(challengeId)).not.toHaveProperty('mood'))

    const notes = () => screen.getByPlaceholderText('What went well? What was hard?')
    await fireEvent.changeText(notes(), 'Legs are dead.')
    expect(screen.getByText('Saving…')).toBeOnTheScreen()
    expect(await screen.findByText('Saved', {}, { timeout: 3000 })).toBeOnTheScreen()
    expect((await today(challengeId))!.notes).toBe('Legs are dead.')

    // Closed mid-sentence: what was typed is kept.
    await fireEvent.changeText(notes(), 'Legs are dead. Worth it.')
    await press('Close')
    await waitFor(async () => expect((await today(challengeId))!.notes).toBe('Legs are dead. Worth it.'), { timeout: 3000 })
  })

  it('leaves a sheet open when a change completes nothing', async () => {
    await startAttempt()
    await show()
    await openSheet(/^Diet, /, 'No cheat meals, no alcohol.')
    await fireEvent.press(screen.getAllByRole('switch', { name: 'No alcohol' }).at(-1)!)
    expect(await screen.findByRole('button', { name: 'Diet, 1 of 2' })).toBeOnTheScreen()
    await new Promise((resolve) => setTimeout(resolve, 1800))
    expect(screen.getByText('No cheat meals, no alcohol.')).toBeOnTheScreen()
  })
})

describe('the photo', () => {
  it('keeps the review open when the photo cannot be saved, and the day keeps the photo it had', async () => {
    const challengeId = await startAttempt()
    const entry = await entryOf(challengeId)
    const firstId = await photoRepo.replaceForEntry(entry.id, { uri: newShot(), mimeType: 'image/jpeg' }, jest.requireMock<typeof import('../../files/store')>('../../files/store').expoStore)
    await show()
    // Done already: its sheet opens from the chip.
    await press('Photo, Taken, done')
    await press('Retake photo')
    await fireEvent(await screen.findByTestId('camera-preview'), 'cameraReady')
    jest.spyOn(photoRepo, 'replaceForEntry').mockRejectedValueOnce(new Error('disk full'))
    await press('Take photo')
    await press('Use photo')
    expect(await screen.findByText("Couldn't save that photo — try again.")).toBeOnTheScreen()
    expect(button('Use photo')).toBeEnabled()
    expect((await today(challengeId))!.photoId).toBe(firstId)

    // A second try goes through, and replaces the photo.
    await press('Use photo')
    expect(await screen.findByText('Saved!')).toBeOnTheScreen()
    expect((await today(challengeId))!.photoId).not.toBe(firstId)
    expect(await photoRepo.getById(firstId)).toBeUndefined()
  })

  it('says so when the camera is not allowed, and a photo from the library still works', async () => {
    allowCamera(false)
    const challengeId = await startAttempt()
    await show()
    await press('Take photo')
    expect(await screen.findByText("The camera isn't allowed for this app. Allow it in Settings, or choose a photo from your library.")).toBeOnTheScreen()
    expect(button('Open Settings')).toBeOnTheScreen()
    expect(screen.queryByTestId('camera-preview')).toBeNull()

    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///library/a.heic', width: 3024, height: 4032 }] } as never)
    await press('Choose from library')
    expect(await screen.findByRole('button', { name: 'Photo, Taken, done' })).toBeOnTheScreen()
    expect(prepareShot).toHaveBeenCalledWith(expect.objectContaining({ uri: 'file:///library/a.heic', width: 3024, height: 4032 }))
    expect((await today(challengeId))!.photoId).toEqual(expect.any(Number))
  })

  it('does nothing when the library is closed without a pick, and says so when a pick cannot be saved', async () => {
    const challengeId = await startAttempt()
    await show()
    await openSheet(/^Photo, /, 'One progress photo a day.')
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({ canceled: true, assets: null })
    await press('Choose from library')
    // On the tile and in the sheet: still no photo.
    expect(screen.getAllByText('No photo yet')).toHaveLength(2)

    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///library/b.jpg', width: 100, height: 100 }] } as never)
    jest.mocked(prepareShot).mockRejectedValueOnce(new Error('no room'))
    await press('Choose from library')
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    expect(await screen.findByText("Couldn't save that photo. Try again, or free up some space.")).toBeOnTheScreen()
    await waitFor(() => expect(announce).toHaveBeenCalledWith("Couldn't save that photo. Try again, or free up some space."))
    expect(await today(challengeId)).not.toHaveProperty('photoId')
  })
})

/** A time picked in the phone's time picker (the `index`th on screen). */
async function pickTime(hours: number, minutes: number, index = 0) {
  const at = new Date(2000, 0, 1, hours, minutes)
  await fireEvent(screen.getAllByTestId('time-field')[index], 'valueChange', {}, at)
}
/** What the duck says in his bubble: for the eyes only (VoiceOver hears it instead), so the query must look past that. */
const says = (text: string) => screen.findByText(text, { includeHiddenElements: true })

describe('the evening plan', () => {
  it('saves a time for a task, with what it is estimated to take, and the duck answers', async () => {
    const challengeId = await startAttempt()
    await show()
    await press('Plan my evening')
    expect(await screen.findByText("He leaves a task alone until its time comes. Break the plan and he'll know.")).toBeOnTheScreen()
    // A row per missing task, none with a time yet.
    for (const task of ['Workouts', 'Diet', 'Water', 'Reading', 'Photo']) expect(button(`Set a time for ${task}`)).toBeOnTheScreen()
    await press('Set a time for Reading')
    await pickTime(21, 0)
    await press('Save plan')

    await waitFor(async () => expect((await today(challengeId))!.plans).toEqual({ reading: '21:00' }))
    expect((await today(challengeId))!.planEstimates).toEqual({ reading: 20 })
    expect(await says('21:00. Not a minute later.')).toBeOnTheScreen()
    expect(screen.getByText('duck: watching, relax')).toBeOnTheScreen()
    // Under the gauge, the next plan; and the button now edits it.
    expect(await screen.findByText('Reading at 21:00')).toBeOnTheScreen()
    expect(await screen.findByRole('button', { name: 'Edit my plan' })).toBeOnTheScreen()
    await waitFor(() => expect(screen.queryByText("He leaves a task alone until its time comes. Break the plan and he'll know.")).toBeNull())
  })

  it('refuses a time already past, or one that leaves no room before midnight, only on the rows just changed', async () => {
    const challengeId = await startAttempt()
    const entry = await entryOf(challengeId)
    // Planned this morning for 09:00, with its estimate frozen then; it is 10:00 now.
    await dayEntryRepo.setPlans(entry.id, { reading: '09:00' }, { reading: 5 })
    await show()
    await press('Edit my plan')
    await screen.findByText('Tell the duck your plan')
    expect(screen.queryByText('Pick a time later than now.')).toBeNull()

    await press('Set a time for Photo')
    await pickTime(9, 30, 1)
    expect(await screen.findByText('Pick a time later than now.')).toBeOnTheScreen()
    expect(button('Save plan')).toBeDisabled()
    await press('Clear Photo')
    expect(screen.queryByText('Pick a time later than now.')).toBeNull()

    await press('Set a time for Workouts')
    await pickTime(23, 30, 0)
    expect(await screen.findByText("That won't fit before midnight.")).toBeOnTheScreen()
    await pickTime(18, 0, 0)
    expect(screen.queryByText("That won't fit before midnight.")).toBeNull()
    await press('Save plan')

    // The earlier plan stays as it was, estimate and all; the new one is estimated now.
    await waitFor(async () => expect((await today(challengeId))!.plans).toEqual({ workouts: '18:00', reading: '09:00' }))
    expect((await today(challengeId))!.planEstimates).toEqual({ workouts: 90, reading: 5 })
    expect(await says('18:00. Not a minute later.')).toBeOnTheScreen()
  })

  it("estimates a freshly planned task against the day's own rules, not Hard's", async () => {
    const challengeId = await startAttempt(1, 'medium')
    await show()
    await press('Plan my evening')
    await press('Set a time for Workouts')
    await pickTime(18, 0)
    await press('Save plan')
    await waitFor(async () => expect((await today(challengeId))!.planEstimates).toEqual({ workouts: 45 }))
  })

  it('says nothing when every saved time has already passed, and clears a plan', async () => {
    const challengeId = await startAttempt()
    const entry = await entryOf(challengeId)
    await dayEntryRepo.setPlans(entry.id, { reading: '09:00', photo: '09:30' }, { reading: 20, photo: 2 })
    await show()
    await press('Edit my plan')
    await press('Clear Photo')
    await press('Save plan')
    await waitFor(async () => expect((await today(challengeId))!.plans).toEqual({ reading: '09:00' }))
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(screen.queryByText(/Not a minute later\./, { includeHiddenElements: true })).toBeNull()
  })

  it('says the plan could not be saved, and keeps the sheet', async () => {
    await startAttempt()
    await show()
    await press('Plan my evening')
    await press('Set a time for Diet')
    jest.spyOn(dayEntryRepo, 'setPlans').mockRejectedValueOnce(new Error('disk full'))
    await press('Save plan')
    expect(await screen.findByText("Couldn't save your plan — try again.")).toBeOnTheScreen()
    expect(button('Save plan')).toBeEnabled()
  })

  it('holds him to a broken plan: "You said HH:mm.", and the plan can still be edited', async () => {
    const challengeId = await startAttempt()
    const entry = await entryOf(challengeId)
    await dayEntryRepo.setPlans(entry.id, { photo: '09:00' }, { photo: 2 })
    await show()
    // 09:00 plus 2 minutes plus the 15 of grace are long past at 10:00.
    // In his bubble: under the gauge, the evening's clock has taken his line's place.
    expect(await says('You said 09:00.')).toBeOnTheScreen()
    expect(screen.getByText('13h to bedtime')).toBeOnTheScreen()
    expect(screen.getByText('duck: tapping')).toBeOnTheScreen()
    expect(screen.getByText('atmosphere: tapping, 0')).toBeOnTheScreen()
    expect(button('Edit my plan')).toBeEnabled()
  })

  it('is too late to plan once he hunts: the button stays, greyed out', async () => {
    setClock(TODAY, 22 * 60 + 30)
    await startAttempt()
    await show()
    const plan = await screen.findByRole('button', { name: 'Too late to plan' })
    expect(plan).toBeDisabled()
    await fireEvent.press(plan)
    expect(screen.queryByText('Tell the duck your plan')).toBeNull()
    expect(screen.getByText('atmosphere: hunting, 0')).toBeOnTheScreen()
  })

  it('flashes the screen once when three quick pokes make him lunge', async () => {
    await startAttempt()
    await show()
    const duck = await screen.findByRole('button', { name: 'Poke the duck' })
    await fireEvent.press(duck)
    await fireEvent.press(duck)
    expect(screen.getByText('atmosphere: watching, 0')).toBeOnTheScreen()
    await fireEvent.press(duck)
    expect(await screen.findByText('atmosphere: watching, 1')).toBeOnTheScreen()
    expect(await says("That's it.")).toBeOnTheScreen()
  })

  it('goes with the day at midnight', async () => {
    await startAttempt()
    const view = await show()
    await press('Plan my evening')
    await screen.findByText('Tell the duck your plan')
    setClock(addDaysISO(TODAY, 1), 0)
    await view.rerender(<Today />)
    expect(await screen.findByLabelText('Day 2, 75 Hard #1')).toBeOnTheScreen()
    expect(screen.queryByText('Tell the duck your plan')).toBeNull()
  })
})

describe('social nights', () => {
  const stored = async (challengeId: number) => (await challengeRepo.getById(challengeId))!
  /** A day picked in the phone's date picker. */
  async function pickDay(iso: string) {
    const [year, month, day] = iso.split('-').map(Number)
    await fireEvent(screen.getByTestId('date-field'), 'valueChange', {}, new Date(year, month - 1, day, 12))
  }

  it('declares a night from the row under the board, and the duck counts', async () => {
    const challengeId = await startAttempt(3, 'strong')
    await addPerfectDays(challengeId, addDaysISO(TODAY, -2), 1, 2)
    await show()
    await press('Plan a social night')
    expect(await screen.findByText('Tomorrow at the earliest, one per week. On that day a drink is allowed — the diet still counts.')).toBeOnTheScreen()
    // No day is picked at first.
    expect(button('Declare')).toBeDisabled()
    await press('Pick a day')
    await pickDay(addDaysISO(TODAY, 2))
    await press('Declare')

    await waitFor(async () => expect((await stored(challengeId)).socialDays).toEqual([5]))
    expect(await says(`${formatWeekday(addDaysISO(TODAY, 2))}. One drink. I'm counting.`)).toBeOnTheScreen()

    // It is listed when the sheet opens again, and cancels at once.
    await waitFor(() => expect(screen.queryByText('Declared')).toBeNull())
    await press('Plan a social night')
    expect(await screen.findByText(`${formatShortDay(addDaysISO(TODAY, 2))} · Day 5`)).toBeOnTheScreen()
    await press('Cancel Day 5')
    await waitFor(async () => expect(await stored(challengeId)).not.toHaveProperty('socialDays'))
  })

  it('says why a night is refused', async () => {
    const challengeId = await startAttempt(3, 'strong')
    await addPerfectDays(challengeId, addDaysISO(TODAY, -2), 1, 2)
    await challengeRepo.setSocialDay(challengeId, 4, true, TODAY)
    await show()
    await press('Plan a social night')
    await press('Pick a day')
    await pickDay(addDaysISO(TODAY, 3))
    await press('Declare')
    expect(await screen.findByText('Week 1 already has one: Day 4.')).toBeOnTheScreen()
    expect((await stored(challengeId)).socialDays).toEqual([4])
    // Picking another day drops the refusal.
    await pickDay(dateForDayNumber(addDaysISO(TODAY, -2), 9))
    expect(screen.queryByText('Week 1 already has one: Day 4.')).toBeNull()
    await press('Declare')
    await waitFor(async () => expect((await stored(challengeId)).socialDays).toEqual([4, 9]))
  })

  it("shows today's night on the diet tile, and asks before cancelling it", async () => {
    const challengeId = await addChallenge({ startDate: addDaysISO(TODAY, -2), attemptNumber: 1, status: 'active', variant: 'strong', socialDays: [3] })
    await profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' })
    await addPerfectDays(challengeId, addDaysISO(TODAY, -2), 1, 2)
    await show()
    expect(await screen.findByLabelText('Social night today — a drink is allowed')).toBeOnTheScreen()
    expect(screen.queryByRole('switch', { name: 'No alcohol' })).toBeNull()

    // From the diet sheet, which gives way to the social night's.
    await openSheet(/^Diet, /, /^No cheat meals\./)
    expect(screen.getByText('Social night today — a drink is allowed.')).toBeOnTheScreen()
    await pressLast('Plan a social night')
    expect(await screen.findByText('Today · Day 3')).toBeOnTheScreen()
    expect(screen.queryByText(/^No cheat meals\./)).toBeNull()

    await press('Cancel Day 3')
    expect(await screen.findByText("Cancel today's occasion? You can't declare today again, and a drink today would break your diet.")).toBeOnTheScreen()
    expect((await stored(challengeId)).socialDays).toEqual([3])
    await press('Keep it')
    await press('Cancel Day 3')
    await press('Cancel it')
    await waitFor(async () => expect(await stored(challengeId)).not.toHaveProperty('socialDays'))
    expect(await screen.findByRole('switch', { name: 'No alcohol' })).toBeOnTheScreen()
  })

  it('is not offered on Hard, nor on the last day', async () => {
    await startAttempt()
    const view = await show()
    await screen.findByLabelText('Day 1, 75 Hard #1')
    expect(screen.queryByRole('button', { name: 'Plan a social night' })).toBeNull()
    await view.unmount()

    await freshDatabase()
    const challengeId = await startAttempt(75, 'strong')
    await addPerfectDays(challengeId, addDaysISO(TODAY, -74), 1, 74)
    await show()
    await screen.findByLabelText('Day 75, 75 Strong #1')
    expect(screen.queryByRole('button', { name: 'Plan a social night' })).toBeNull()
  })

  it('can be planned before Day 1', async () => {
    const challengeId = await startAttempt(0, 'soft')
    await show()
    await press('Plan a social night')
    await press('Pick a day')
    // The first day offered is Day 1 itself: tomorrow.
    await press('Declare')
    await waitFor(async () => expect((await stored(challengeId)).socialDays).toEqual([1]))
  })
})

describe('yesterday, until noon', () => {
  /** Day 2 today, with Day 1 left as it was: nothing logged. */
  const dayTwo = () => startAttempt(2)

  it('offers to finish it, and logs onto yesterday: the photo from the library only', async () => {
    const challengeId = await dayTwo()
    await show()
    expect(await screen.findByText("Day 1 isn't finished")).toBeOnTheScreen()
    expect(screen.getByText('Forgot to log it? You have until 12:00.')).toBeOnTheScreen()
    expect(screen.getByText("Yesterday's still open. Noon.")).toBeOnTheScreen()

    await press('Finish it')
    expect(await screen.findByText('Finish Day 1')).toBeOnTheScreen()
    expect(screen.getByText('Yesterday')).toBeOnTheScreen()
    expect(screen.getByText('Log what you did yesterday. You have until 12:00; after that, the day counts as missed.')).toBeOnTheScreen()
    // No duck, no plan, no weigh-in there.
    expect(screen.queryByText(/^duck: /)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Plan my evening' })).toBeNull()
    expect(screen.queryByText('Weigh in')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Take photo' })).toBeNull()

    await press('Add 250 ml')
    await waitFor(async () => expect((await today(challengeId, 1))?.water_ml).toBe(250))
    expect((await today(challengeId, 1))!.date).toBe(addDaysISO(TODAY, -1))

    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///library/y.jpg', width: 3024, height: 4032 }] } as never)
    await press('Choose from library')
    expect(await screen.findByRole('button', { name: 'Photo, Taken, done' })).toBeOnTheScreen()
    await press('Photo, Taken, done')
    expect(await screen.findByText("Yesterday's photo, from your library.")).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /Retake photo|Take photo/ })).toBeNull()
    await press('Close')

    await press('Today')
    expect(await screen.findByLabelText('Day 2, 75 Hard #1')).toBeOnTheScreen()
  })

  it('comes back to today by itself once yesterday is finished, and the card is gone', async () => {
    const challengeId = await dayTwo()
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: addDaysISO(TODAY, -1) })
    await dayEntryRepo.update(entry.id, { dietFollowed: true, noAlcohol: true })
    await dayEntryRepo.adjustWater(entry.id, 3800)
    await dayEntryRepo.adjustPages(entry.id, 10)
    await workoutRepo.add({ dayEntryId: entry.id, type: 'Running', durationMin: 45, isOutdoor: true })
    await workoutRepo.add({ dayEntryId: entry.id, type: 'Weights', durationMin: 45, isOutdoor: false })
    await show()
    await press('Finish it')
    await screen.findByText('Finish Day 1')
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///library/y.jpg', width: 3024, height: 4032 }] } as never)
    await press('Choose from library')

    expect(await screen.findByLabelText('Day 2, 75 Hard #1')).toBeOnTheScreen()
    expect(screen.queryByText("Day 1 isn't finished")).toBeNull()
    expect(screen.getByLabelText('Streak: 1 day')).toBeOnTheScreen()
    expect((await today(challengeId, 1))!.completed).toBe(true)
  })

  it('has no card once yesterday is done, nor past noon', async () => {
    const challengeId = await dayTwo()
    await dayEntryRepo.getAllForChallenge(challengeId)
    setClock(TODAY, 13 * 60)
    const view = await show()
    expect(await screen.findByText('Day 1 was missed')).toBeOnTheScreen()
    await view.unmount()

    await freshDatabase()
    const done = await startAttempt(2)
    await addPerfectDays(done, addDaysISO(TODAY, -1), 1, 1)
    setClock(TODAY, MORNING)
    await show()
    await screen.findByLabelText('Day 2, 75 Hard #1')
    expect(screen.queryByText("Day 1 isn't finished")).toBeNull()
    expect(screen.queryByText("Yesterday's still open. Noon.")).toBeNull()
  })

  it('shows only the last day to finish the morning after Day 75, with no way back to a today', async () => {
    const challengeId = await startAttempt(76)
    await addPerfectDays(challengeId, addDaysISO(TODAY, -75), 1, 74)
    await show()
    expect(await screen.findByText('Finish Day 75')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Today' })).toBeNull()
    expect(screen.queryByText(/Day 1 starts/)).toBeNull()
  })
})
