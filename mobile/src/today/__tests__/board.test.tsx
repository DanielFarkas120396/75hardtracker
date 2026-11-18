import { isDayComplete, taskCompletionMap } from '@logic/dayCompletion'
import type { PainterKind } from '@logic/fillKinds'
import { RULESETS } from '@logic/rulesets'
import type { DayTaskData } from '@logic/types'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import * as Font from 'expo-font'
import { AccessibilityInfo, Text } from 'react-native'
import { freshDatabase } from '../../db/__tests__/fixtures'
import type { DayEntry } from '../../db/types'
import { useBoardBusy } from '../boardSettle'
import type { FillEngine } from '../fills/engine'
import { TaskBoard } from '../TaskBoard'
import { Providers } from './support'

// The board's choreography, with a stand-in for the fills' engine: the test says when a fill has moved or settled.

jest.mock('expo-font', () => ({ useFonts: jest.fn(() => [true, null]), isLoaded: jest.fn(() => true) }))
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(async () => {}), ImpactFeedbackStyle: { Light: 'light' } }))

interface FakeFill {
  level: number
  shown: number
  settled: number | null
  modes: string[]
  onFrame: () => void
}

const mockFills = new Map<PainterKind, FakeFill>()
const mockHold = jest.fn()
const mockEngine: FillEngine = {
  supports: () => true,
  hold: mockHold,
  setPalette: () => undefined,
  setReduceMotion: () => undefined,
  add(kind, _surface, onFrame) {
    const fill: FakeFill = { level: 0, shown: 0, settled: 0, modes: [], onFrame }
    mockFills.set(kind, fill)
    return {
      setLevel(level, mode) {
        if (level === fill.level && mode !== 'instant') return
        fill.level = level
        fill.modes.push(mode)
        fill.settled = mode === 'instant' ? level : null
        if (mode === 'instant') fill.shown = level
      },
      shown: () => fill.shown,
      settledAt: () => fill.settled,
      setAnchor: () => undefined,
      setHasImage: () => undefined,
      setSize: () => undefined,
      remove: () => {
        if (mockFills.get(kind) === fill) mockFills.delete(kind)
      },
    }
  },
}
jest.mock('../fills/TileFill', () => ({ ...jest.requireActual('../fills/TileFill'), useFillEngine: () => mockEngine }))

/** The fill draws a frame showing `shown` of the way. */
const frame = (kind: PainterKind, shown: number) =>
  act(async () => {
    const fill = mockFills.get(kind)!
    fill.shown = shown
    fill.onFrame()
  })
/** The fill comes to rest at its level. */
const settle = (kind: PainterKind) =>
  act(async () => {
    const fill = mockFills.get(kind)!
    fill.shown = fill.level
    fill.settled = fill.level
    fill.onFrame()
  })

const RULES = RULESETS.hard
const EMPTY: DayTaskData = { water_ml: 0, pages_read: 0, dietFollowed: false, noAlcohol: false, hasPhoto: false, workouts: [] }
const ENTRY = { id: 1, challengeId: 1, date: '2026-11-18', dayNumber: 3, water_ml: 0, pages_read: 0, dietFollowed: false, noAlcohol: false, completed: false } as DayEntry

function Busy() {
  return <Text>{useBoardBusy() ? 'busy' : 'idle'}</Text>
}

const onLanded = jest.fn()
const board = (data: DayTaskData, paused = false, completed = isDayComplete(data, RULES)) => (
  <>
    <TaskBoard entry={{ ...ENTRY, completed }} data={data} completion={taskCompletionMap(data, RULES)} rules={RULES} paused={paused} onLandedChange={onLanded} onOpen={() => undefined} />
    <Busy />
  </>
)
const show = (data: DayTaskData, paused = false) => render(board(data, paused), { wrapper: Providers })
const tile = (name: string) => screen.queryByRole('button', { name })
const landed = () => onLanded.mock.calls.at(-1)?.[0]
const flags = globalThis as { __SKIP_ANIMATIONS__?: boolean }

beforeEach(async () => {
  jest.mocked(Font.useFonts).mockReturnValue([true, null])
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
  jest.mocked(AccessibilityInfo.announceForAccessibility).mockClear()
  mockFills.clear()
  mockHold.mockClear()
  onLanded.mockClear()
  flags.__SKIP_ANIMATIONS__ = false
  // A frame takes 16 ms here, so an animation ends when the test's clock is moved on (the stand-in frames take no time, and never would).
  jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((frame) => setTimeout(() => frame(Date.now()), 16) as unknown as number)
  await freshDatabase()
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
  flags.__SKIP_ANIMATIONS__ = true
})

describe('the board’s choreography', () => {
  it('opens with the done tasks as chips at once, their fills at the day’s level, and nothing moving', async () => {
    await show({ ...EMPTY, pages_read: 10, water_ml: 1900 })
    expect(await screen.findByRole('button', { name: 'Reading, 10 pages, done' })).toBeOnTheScreen()
    expect(tile('Water, 1.9 of 3.8 L')).toBeOnTheScreen()
    expect(mockFills.get('wave')).toMatchObject({ level: 0.5, modes: ['instant'] })
    // The done task has no tile, so no fill.
    expect(mockFills.has('book')).toBe(false)
    expect(landed()).toBe(1)
    expect(screen.getByText('idle')).toBeOnTheScreen()
  })

  it('takes a done task from tile to full, through its glow, into its chip; the gauge counts it only once it has landed', async () => {
    jest.useFakeTimers()
    const view = await show(EMPTY)
    await act(async () => {})
    await view.rerender(board({ ...EMPTY, water_ml: 3800 }))
    // Its fill is still rising: a tile, counted by no one, and the board is busy.
    expect(mockFills.get('wave')).toMatchObject({ level: 1, modes: ['instant', 'animate'] })
    expect(tile('Water, 3.8 L')).toBeOnTheScreen()
    expect(tile('Water, 3.8 L, done')).toBeNull()
    expect(screen.getByText('busy')).toBeOnTheScreen()
    expect(landed()).toBe(0)
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Water done.')

    // Settled at the top: full. Its shortcut has gone, and it holds for its glow.
    await settle('wave')
    expect(screen.queryByRole('button', { name: 'Add 250 ml' })).toBeNull()
    expect(tile('Water, 3.8 L, done')).toBeNull()
    await act(async () => void jest.advanceTimersByTime(379))
    expect(landed()).toBe(0)

    // It sets off from where it stood, and lands where its chip is.
    await fireEvent(screen.getByTestId('board-grid'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 358, height: 384 } } })
    await fireEvent(screen.getByTestId('cell-water'), 'layout', { nativeEvent: { layout: { x: 0, y: 264, width: 358, height: 120 } } })
    await act(async () => void jest.advanceTimersByTime(1))
    expect(landed()).toBe(0)
    expect(screen.getByText('busy')).toBeOnTheScreen()
    // Lifted out of the grid where it stood, it waits for its chip's place; the chip is there to be measured, unseen.
    expect(screen.queryByTestId('cell-water')).toBeNull()
    expect(screen.getByTestId('morphing-water', { includeHiddenElements: true })).toBeOnTheScreen()
    expect(tile('Water, 3.8 L, done')).toBeNull()
    expect(screen.getByRole('button', { name: 'Water, 3.8 L, done', includeHiddenElements: true })).toHaveStyle({ opacity: 0 })

    // Its chip's place is what starts the trip: no timer is moved on here, so the fallback for a board with no
    // layout (150 ms) can't be what lands it.
    await fireEvent(screen.getByTestId('board-chips'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 358, height: 48 } } })
    await fireEvent(screen.getByTestId('chip-water'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 96, height: 48 } } })
    await act(async () => {})
    expect(screen.queryByTestId('morphing-water', { includeHiddenElements: true })).toBeNull()
    expect(tile('Water, 3.8 L, done')).toBeOnTheScreen()
    expect(tile('Water, 3.8 L, done')).not.toHaveStyle({ opacity: 0 })
    expect(landed()).toBe(1)
    expect(screen.getByText('idle')).toBeOnTheScreen()
  })

  it('waits for its chip’s place before it lands, and gives up on the trip only after 150 ms', async () => {
    jest.useFakeTimers()
    const view = await show(EMPTY)
    await act(async () => {})
    await view.rerender(board({ ...EMPTY, water_ml: 3800 }))
    await settle('wave')
    await fireEvent(screen.getByTestId('board-grid'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 358, height: 384 } } })
    await fireEvent(screen.getByTestId('cell-water'), 'layout', { nativeEvent: { layout: { x: 0, y: 264, width: 358, height: 120 } } })
    await act(async () => void jest.advanceTimersByTime(380))
    expect(screen.getByTestId('morphing-water', { includeHiddenElements: true })).toBeOnTheScreen()
    await act(async () => void jest.advanceTimersByTime(149))
    expect(landed()).toBe(0)
    await act(async () => void jest.advanceTimersByTime(1))
    expect(landed()).toBe(1)
    expect(tile('Water, 3.8 L, done')).toBeOnTheScreen()
  })

  it('keeps the board busy while a task done under a sheet waits for its chip', async () => {
    jest.useFakeTimers()
    const view = await show({ ...EMPTY, water_ml: 3550 }, true)
    await act(async () => {})
    await view.rerender(board({ ...EMPTY, water_ml: 3800 }, true))
    expect(screen.getByText('busy')).toBeOnTheScreen()
    expect(tile('Water, 3.55 of 3.8 L')).toBeOnTheScreen()
    // The sheet closes: the tile fills, glows and lands.
    await view.rerender(board({ ...EMPTY, water_ml: 3800 }, false))
    expect(screen.getByText('busy')).toBeOnTheScreen()
    await settle('wave')
    await act(async () => void jest.advanceTimersByTime(1000))
    expect(tile('Water, 3.8 L, done')).toBeOnTheScreen()
    expect(screen.getByText('idle')).toBeOnTheScreen()
  })

  it('stays busy while the day is saved complete but its last workout has not loaded', async () => {
    flags.__SKIP_ANIMATIONS__ = true
    const allButOne: DayTaskData = { water_ml: 3800, pages_read: 10, dietFollowed: true, noAlcohol: true, hasPhoto: true, workouts: [{ durationMin: 45, isOutdoor: true }] }
    const view = await render(board(allButOne, false, true), { wrapper: Providers })
    await act(async () => {})
    expect(screen.getByText('busy')).toBeOnTheScreen()
    await view.rerender(board({ ...allButOne, workouts: [...allButOne.workouts, { durationMin: 45, isOutdoor: false }] }, false, true))
    expect(screen.getByText('idle')).toBeOnTheScreen()
  })

  it('writes a status in the ink colour over a fill, the reading’s at 0 pages too, and leaves it muted on a bare tile', async () => {
    await show({ ...EMPTY, water_ml: 0, pages_read: 0, workouts: [{ durationMin: 45, isOutdoor: true }] })
    await act(async () => {})
    const colourOf = (line: string): string | undefined =>
      [screen.getByText(line).props.style].flat(5).reduce((found: string | undefined, style: { color?: string } | null | false) => (style && style.color) || found, undefined)
    const ink = colourOf('Water')
    expect(ink).toBeDefined()
    // The book draws its open pages at rest: its line is always over a fill.
    expect(colourOf('0 of 10 pages')).toBe(ink)
    // An empty wave draws nothing: the muted grey reads there.
    expect(colourOf('0 / 3.8 L')).not.toBe(ink)
    // A fill part way: ink.
    expect(colourOf('1 of 2 · 45 min')).toBe(ink)
  })

  it('shows the chip even when the board has no layout to travel by', async () => {
    jest.useFakeTimers()
    const view = await show(EMPTY)
    await act(async () => {})
    await view.rerender(board({ ...EMPTY, dietFollowed: true, noAlcohol: true }))
    await settle('ink')
    await act(async () => void jest.advanceTimersByTime(380))
    expect(tile('Diet, Followed, done')).toBeOnTheScreen()
    expect(landed()).toBe(1)
  })

  it('goes back to a tile when the task is undone, whatever it was doing', async () => {
    jest.useFakeTimers()
    const view = await show(EMPTY)
    await act(async () => {})
    const done = { ...EMPTY, pages_read: 10 }
    // Undone while its fill rises.
    await view.rerender(board(done))
    await view.rerender(board(EMPTY))
    await settle('book')
    await act(async () => void jest.advanceTimersByTime(1000))
    expect(tile('Reading, 0 of 10 pages')).toBeOnTheScreen()
    // Undone while it glows.
    await view.rerender(board(done))
    await settle('book')
    await act(async () => void jest.advanceTimersByTime(200))
    await view.rerender(board(EMPTY))
    await act(async () => void jest.advanceTimersByTime(1000))
    expect(tile('Reading, 0 of 10 pages')).toBeOnTheScreen()
    expect(landed()).toBe(0)
    // Undone as a chip.
    await view.rerender(board(done))
    await settle('book')
    await act(async () => void jest.advanceTimersByTime(380))
    expect(landed()).toBe(1)
    await view.rerender(board(EMPTY))
    expect(tile('Reading, 0 of 10 pages')).toBeOnTheScreen()
    expect(landed()).toBe(0)
    expect(screen.getByText('idle')).toBeOnTheScreen()
  })

  it('counts the water up with its fill, then tells the day as it is', async () => {
    const view = await show(EMPTY)
    await act(async () => {})
    await view.rerender(board({ ...EMPTY, water_ml: 1000 }))
    await frame('wave', 0.1)
    expect(tile('Water, 1 of 3.8 L')).toBeOnTheScreen()
    // 0.1 of 3.8 L, to the nearest 50 ml.
    expect(screen.getByText('0.4 / 3.8 L')).toBeOnTheScreen()
    await frame('wave', 0.2)
    expect(screen.getByText('0.75 / 3.8 L')).toBeOnTheScreen()
    await settle('wave')
    expect(screen.getByText('1 / 3.8 L')).toBeOnTheScreen()
    // The count lands where it was going: no dip, no slide-in.
    expect(screen.getByText('1 / 3.8 L').parent).toHaveStyle({ opacity: 1, transform: [{ translateY: 0 }] })
  })

  it('holds still under a sheet, fills included, and plays what changed once it closes', async () => {
    const view = await show(EMPTY, true)
    await act(async () => {})
    expect(mockHold).toHaveBeenLastCalledWith(true)
    await view.rerender(board({ ...EMPTY, water_ml: 1900 }, true))
    expect(mockFills.get('wave')!.level).toBe(0)
    expect(tile('Water, 0 of 3.8 L')).toBeOnTheScreen()
    await view.rerender(board({ ...EMPTY, water_ml: 1900 }, false))
    expect(mockHold).toHaveBeenLastCalledWith(false)
    expect(mockFills.get('wave')).toMatchObject({ level: 0.5, modes: ['instant', 'animate'] })
    expect(tile('Water, 1.9 of 3.8 L')).toBeOnTheScreen()
  })

  it('under reduce motion crossfades the fill, and the chip follows without a glow or a trip', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
    jest.useFakeTimers()
    const view = await show(EMPTY)
    await act(async () => {})
    await view.rerender(board({ ...EMPTY, water_ml: 3800 }))
    expect(mockFills.get('wave')!.modes).toEqual(['instant', 'fade'])
    await settle('wave')
    await act(async () => void jest.advanceTimersByTime(1))
    expect(tile('Water, 3.8 L, done')).toBeOnTheScreen()
    expect(landed()).toBe(1)
  })

  it('makes a done task a chip at once when nothing animates', async () => {
    flags.__SKIP_ANIMATIONS__ = true
    const view = await show(EMPTY)
    await act(async () => {})
    await view.rerender(board({ ...EMPTY, pages_read: 10 }))
    expect(tile('Reading, 10 pages, done')).toBeOnTheScreen()
    expect(landed()).toBe(1)
  })
})
