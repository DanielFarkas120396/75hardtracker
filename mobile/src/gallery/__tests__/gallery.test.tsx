// The Gallery tab as the phone shows it: the cases of the plan's Review Focus
// (docs/superpowers/plans/2026-11-19-v4-part-6-gallery.md), from the web's GalleryScreen, PhotoLightbox and
// PhotoCompare tests.
import { addDaysISO, dateForDayNumber, formatDisplayDate, todayISO } from '@logic/dates'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native'
import * as Font from 'expo-font'
import { AccessibilityInfo, Image, ScrollView, StyleSheet } from 'react-native'
import GalleryRoute from '../../app/(tabs)/gallery'
import { addChallenge, freshDatabase } from '../../db/__tests__/fixtures'
import { transaction } from '../../db/open'
import { profileRepo } from '../../db/repositories/profileRepo'
import { insertRow } from '../../db/table'
import { useHideTabBar } from '../../hooks/useTabBar'
import { Providers } from '../../today/__tests__/support'
import { takeCameraRequest } from '../cameraRequest'
import { PhotoCompare, PRELOAD_WAIT_MS } from '../PhotoCompare'
import type { GalleryEntry } from '../useGalleryPhotos'

const mockNavigate = jest.fn()
jest.mock('expo-router', () => ({ router: { navigate: (href: string) => mockNavigate(href) } }))
jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }))
jest.mock('../../files/store', () => {
  const fs = jest.requireActual<typeof import('node:fs')>('node:fs')
  const os = jest.requireActual<typeof import('node:os')>('node:os')
  const path = jest.requireActual<typeof import('node:path')>('node:path')
  const { nodeStore } = jest.requireActual<typeof import('../../files/__tests__/nodeStore')>('../../files/__tests__/nodeStore')
  return { expoStore: nodeStore(fs.mkdtempSync(path.join(os.tmpdir(), 'gallery-'))) }
})
// The duck redraws every frame (he has his own tests).
jest.mock('../../components/mascot/Mascot', () => ({ Mascot: () => null }))

const TODAY = todayISO()

beforeEach(async () => {
  jest.mocked(Font.useFonts).mockReturnValue([true, null])
  mockNavigate.mockClear()
  takeCameraRequest('')
  await freshDatabase()
})
afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

/** An attempt whose Day `day` is today, with a photo on each of `photoDays`. */
async function attempt(day: number, photoDays: number[], attemptNumber = 2, status: 'active' | 'failed' = 'active') {
  const start = addDaysISO(TODAY, -(day - 1))
  const id = await addChallenge({ startDate: start, attemptNumber, status, variant: 'hard' })
  await profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' })
  await transaction(async (db) => {
    for (const dayNumber of photoDays) {
      const date = dateForDayNumber(start, dayNumber)
      const photoId = await insertRow(db, 'photos', { date, file: `${attemptNumber}-${dayNumber}.jpg`, mimeType: 'image/jpeg' })
      await insertRow(db, 'dayEntries', { challengeId: id, date, dayNumber, water_ml: 0, pages_read: 0, dietFollowed: false, noAlcohol: false, photoId, completed: false })
    }
  })
  return { id, start }
}

const show = async () => {
  await render(<GalleryRoute />, { wrapper: Providers })
  await screen.findByText('Gallery')
}
const tiles = () => screen.getAllByRole('button', { name: /^Day \d+ progress$/ }).map((b) => b.props.accessibilityLabel as string)

describe('the page', () => {
  it('with no photos, shows the duck and sends you to Today with its camera', async () => {
    await attempt(3, [])
    await show()
    expect(await screen.findByRole('header', { name: 'No photos yet' })).toBeOnTheScreen()
    expect(screen.getByText("One photo a day, and in 75 days you'll see how far you climbed.")).toBeOnTheScreen()

    await fireEvent.press(screen.getByRole('button', { name: "Take today's photo" }))
    expect(mockNavigate).toHaveBeenCalledWith('/')
    expect(takeCameraRequest(TODAY)).toBe(true)
  })

  it("shows this attempt's photos only, newest first, in one grid", async () => {
    await attempt(80, [1, 2], 1, 'failed')
    await attempt(41, [1, 40])
    await show()
    await waitFor(() => expect(tiles()).toEqual(['Day 40 progress', 'Day 1 progress']))
  })

  it('shows Compare with the first and the latest day, only from two photos', async () => {
    await attempt(33, [1, 32])
    await show()
    await fireEvent.press(await screen.findByRole('button', { name: 'Compare, Day 1 → Day 32' }))
    expect(await screen.findByLabelText('Compare photos')).toBeOnTheScreen()
  })

  it('has no Compare with one photo in this attempt, whatever older attempts hold', async () => {
    await attempt(80, [1, 2], 1, 'failed')
    await attempt(3, [1])
    await show()
    await waitFor(() => expect(tiles()).toEqual(['Day 1 progress']))
    expect(screen.queryByRole('button', { name: /^Compare/ })).toBeNull()
  })
})

describe('the lightbox', () => {
  it('shows the photo tapped with its attempt, day and date, goes older and newer, and closes', async () => {
    const { start } = await attempt(41, [1, 20, 40])
    await show()
    await fireEvent.press(await screen.findByRole('button', { name: 'Day 20 progress' }))

    const caption = (day: number) => `Attempt #2 — Day ${day} · ${formatDisplayDate(dateForDayNumber(start, day))}`
    expect(await screen.findByText(caption(20))).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: '← Older' }))
    expect(await screen.findByText(caption(1))).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: '← Older' })).toBeDisabled()
    await fireEvent.press(screen.getByRole('button', { name: 'Newer →' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Newer →' }))
    expect(await screen.findByText(caption(40))).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Newer →' })).toBeDisabled()

    await fireEvent.press(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByText(caption(40))).toBeNull())
  })

  it('closes from a tap beside the photo', async () => {
    await attempt(3, [1, 2])
    await show()
    await fireEvent.press(await screen.findByRole('button', { name: 'Day 1 progress' }))
    await fireEvent.press(await screen.findByTestId('lightbox-backdrop'))
    await waitFor(() => expect(screen.queryByText(/^Attempt #2 — Day 1/)).toBeNull())
  })

  it('closes when a screen that covers the app brings Today forward', async () => {
    await attempt(3, [1, 2])
    function Covering() {
      useHideTabBar()
      return null
    }
    const ui = (covered: boolean) => (
      <>
        <GalleryRoute />
        {covered && <Covering />}
      </>
    )
    const view = await render(ui(false), { wrapper: Providers })
    await fireEvent.press(await screen.findByRole('button', { name: 'Day 1 progress' }))
    expect(await screen.findByText(/^Attempt #2 — Day 1/)).toBeOnTheScreen()
    await view.rerender(ui(true))
    await waitFor(() => expect(screen.queryByText(/^Attempt #2 — Day 1/)).toBeNull())
  })
})

const entries: GalleryEntry[] = [1, 3, 5, 7].map((dayNumber) => ({
  photo: { id: dayNumber * 10, uri: `file:///photos/${dayNumber}.jpg` },
  dayNumber,
  attemptNumber: 1,
  date: `2026-10-0${dayNumber}`,
}))
const compare = () => render(<PhotoCompare entries={entries} onClose={() => {}} />, { wrapper: Providers })
const photo = (day: number) => screen.queryByLabelText(`Day ${day} progress`)
const adjust = async (name: string, action: 'increment' | 'decrement', times = 1) => {
  for (let i = 0; i < times; i++) await fireEvent(screen.getByLabelText(name), 'accessibilityAction', { nativeEvent: { actionName: action } })
}

describe('Compare, the slider', () => {
  it('opens on the first and the latest photo', async () => {
    await compare()
    expect(photo(1)).toBeOnTheScreen()
    expect(photo(7)).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Change the earlier day, Day 1' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Change the later day, Day 7' })).toBeOnTheScreen()
    expect(screen.getByText('Day 1 → Day 7 · 6 days')).toBeOnTheScreen()
  })

  it('moves the line with VoiceOver and with a finger', async () => {
    await compare()
    const left = () => StyleSheet.flatten(screen.getByTestId('compare-later').props.style).left as number
    const width = StyleSheet.flatten(screen.getByTestId('compare-frame').props.style).width as number
    await adjust('Compare Day 1 and Day 7', 'decrement', 2)
    expect(left()).toBeCloseTo(width * 0.3)
    expect(screen.getByLabelText('Compare Day 1 and Day 7').props.accessibilityValue).toEqual({ text: '30%' })

    await fireEvent(screen.getByTestId('compare-frame'), 'responderGrant', { nativeEvent: { locationX: width * 0.8, touches: [], changedTouches: [] }, touchHistory: { touchBank: [] } })
    expect(left()).toBeCloseTo(width * 0.8)
  })

  it('never takes a drag away from a side label: the label keeps its tap', async () => {
    await compare()
    const frame = screen.getByTestId('compare-frame')
    expect(frame.props.onMoveShouldSetResponder({ nativeEvent: { touches: [{}] }, touchHistory: { touchBank: [], numberActiveTouches: 1, indexOfSingleActiveTouch: 0, mostRecentTimeStamp: 0 } })).toBe(false)
  })

  it('opens the strip with the side’s day in the middle', async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype as unknown as { scrollTo: (o: object) => void }, 'scrollTo').mockImplementation(() => {})
    await compare()
    const width = StyleSheet.flatten(screen.getByTestId('compare-frame').props.style).width as number
    await fireEvent.press(screen.getByRole('button', { name: 'Change the later day, Day 7' }))
    // The strip's own layout comes after its days': the centring must not wait on it.
    await fireEvent(screen.getByRole('button', { name: 'Day 7' }), 'layout', { nativeEvent: { layout: { x: 400, y: 0, width: 44, height: 64 } } })
    expect(scrollTo).toHaveBeenLastCalledWith({ x: 400 - (width - 44) / 2, animated: false })
  })

  it('picks another day for one side, never the other side’s', async () => {
    await compare()
    await fireEvent.press(screen.getByRole('button', { name: 'Change the later day, Day 7' }))
    expect(screen.getByRole('button', { name: 'Day 1' })).toBeDisabled()
    await fireEvent.press(screen.getByRole('button', { name: 'Day 3' }))
    expect(screen.getByText('Day 1 → Day 3 · 2 days')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Day 5' })).toBeNull()
  })

  it('swaps the sides when a pick puts the days the wrong way round', async () => {
    await compare()
    await fireEvent.press(screen.getByRole('button', { name: 'Change the later day, Day 7' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Day 3' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Change the earlier day, Day 1' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Day 5' }))
    expect(screen.getByRole('button', { name: 'Change the earlier day, Day 3' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Change the later day, Day 5' })).toBeOnTheScreen()
  })
})

describe('Compare, the time-lapse', () => {
  /** Lets the time-lapse run for `ms`, 100 ms at a time, so each frame renders and sets the next one's timer. */
  async function play(ms: number) {
    for (let t = 0; t < ms; t += 100) await act(async () => jest.advanceTimersByTime(100))
  }
  const timeLapse = async () => {
    jest.useFakeTimers()
    await compare()
    await fireEvent.press(screen.getByRole('button', { name: 'Time-lapse' }))
  }

  beforeEach(() => {
    jest.spyOn(Image, 'prefetch').mockResolvedValue(true)
  })

  it('plays every photo and stops on the latest, then offers Replay', async () => {
    await timeLapse()
    await play(100)
    expect(photo(1)).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Replay' })).toBeNull()
    await play(400)
    expect(photo(3)).toBeOnTheScreen()
    await play(5000)
    expect(photo(7)).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Replay' }))
    expect(photo(1)).toBeOnTheScreen()
  })

  it('shows the day the scrubber is on, and stops playing', async () => {
    await timeLapse()
    await play(100)
    await adjust('Day', 'increment', 2)
    expect(photo(5)).toBeOnTheScreen()
    await play(5000)
    expect(photo(5)).toBeOnTheScreen()
  })

  it('plays faster from the next photo when the speed goes up', async () => {
    await timeLapse()
    await play(100)
    await adjust('Speed', 'increment', 7)
    await play(100)
    expect(photo(3)).toBeOnTheScreen()
  })

  it('plays anyway when the pictures never finish loading', async () => {
    jest.mocked(Image.prefetch).mockReturnValue(new Promise(() => {}))
    await timeLapse()
    await play(PRELOAD_WAIT_MS - 100)
    expect(screen.getByText('Loading…')).toBeOnTheScreen()
    await play(200)
    expect(photo(1)).toBeOnTheScreen()
  })

  it('with Reduce Motion, opens on the latest photo and never plays', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
    jest.useFakeTimers()
    const view = await compare()
    await act(async () => {})
    await view.rerender(<PhotoCompare entries={entries} onClose={() => {}} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Time-lapse' }))
    await play(5000)
    expect(photo(7)).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Replay' })).toBeNull()
    expect(screen.queryByLabelText('Speed')).toBeNull()
    await adjust('Day', 'decrement', 3)
    expect(photo(1)).toBeOnTheScreen()
  })

  it('names the frame for VoiceOver', async () => {
    await timeLapse()
    await play(100)
    expect(within(screen.getByLabelText('Compare photos')).getByLabelText('Day 1 progress')).toBeOnTheScreen()
  })
})
