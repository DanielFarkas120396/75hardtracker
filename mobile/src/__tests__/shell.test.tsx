import { resolveGate } from '@logic/challengeGate'
import { missingTasks } from '@logic/dayCompletion'
import { toDayTaskData } from '@logic/mappers'
import { rulesFor } from '@logic/rulesets'
import { SETTING_KEYS } from '@logic/settingKeys'
import { dayNumberForDate, todayISO } from '@logic/dates'
import { render, screen, waitFor } from '@testing-library/react-native'
import * as Font from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Text } from 'react-native'
import { AppGate } from '../components/AppGate'
import { nodeStore } from '../files/__tests__/nodeStore'
import { picturePath, stagePictures } from '../files/pictures'
import { expoStore } from '../files/store'
import { measurementRepo } from '../db/repositories/measurementRepo'
import { photoRepo } from '../db/repositories/photoRepo'
import { addChallenge, freshDatabase } from '../db/__tests__/fixtures'
import * as open from '../db/open'
import { challengeRepo } from '../db/repositories/challengeRepo'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import { workoutRepo } from '../db/repositories/workoutRepo'
import { profileRepo } from '../db/repositories/profileRepo'
import { settingsRepo } from '../db/repositories/settingsRepo'
import { SEEDS, seedDay } from '../dev/seed'

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }))
// The seeds' bundled pictures are the files in assets/images/seed; the app's pictures go to a folder on this computer.
jest.mock('expo-asset', () => {
  const { pathToFileURL } = jest.requireActual<typeof import('node:url')>('node:url')
  const path = jest.requireActual<typeof import('node:path')>('node:path')
  return {
    Asset: { fromModule: () => ({ downloadAsync: async () => ({ localUri: pathToFileURL(path.join(__dirname, '../../assets/images/seed/seed-1.jpg')).href }) }) },
  }
})
jest.mock('../files/store', () => {
  const fs = jest.requireActual<typeof import('node:fs')>('node:fs')
  const os = jest.requireActual<typeof import('node:os')>('node:os')
  const path = jest.requireActual<typeof import('node:path')>('node:path')
  const { nodeStore } = jest.requireActual<typeof import('../files/__tests__/nodeStore')>('../files/__tests__/nodeStore')
  return { expoStore: nodeStore(fs.mkdtempSync(path.join(os.tmpdir(), 'seed-'))) }
})
jest.mock('expo-audio', () => ({ useAudioPlayer: () => ({ play: jest.fn(), seekTo: jest.fn(async () => {}) }), setAudioModeAsync: jest.fn(async () => {}) }))
jest.mock('expo-splash-screen', () => ({ hideAsync: jest.fn(async () => {}), preventAutoHideAsync: jest.fn(async () => {}) }))
const hideSplash = jest.mocked(SplashScreen.hideAsync)
jest.mock('../db/open', () => ({ ...jest.requireActual('../db/open'), openAppDatabase: jest.fn() }))
const openAppDatabase = jest.mocked(open.openAppDatabase)

beforeEach(async () => {
  jest.mocked(Font.useFonts).mockReturnValue([true, null])
  hideSplash.mockClear()
  await freshDatabase()
})

describe('seedDay', () => {
  it('replaces whatever was there with one attempt on that day', async () => {
    await addChallenge({ startDate: '2026-01-01', attemptNumber: 4, status: 'failed' })
    await settingsRepo.set(SETTING_KEYS.bedtime, '22:30')
    await seedDay(30)
    const challenges = await challengeRepo.getAll()
    expect(challenges).toHaveLength(1)
    expect(challenges[0]).toMatchObject({ attemptNumber: 1, status: 'active', variant: 'hard' })
    expect(dayNumberForDate(challenges[0].startDate, todayISO())).toBe(30)
    expect(await settingsRepo.get(SETTING_KEYS.bedtime, 'none')).toBe('none')
    // With a profile, so the app opens on Today and not on the welcome flow.
    expect(await profileRepo.get()).toMatchObject({ name: 'Tester' })
  })

  it('gives each done day a real picture, a note every other day and workouts that vary', async () => {
    await seedDay(12)
    const challenge = (await challengeRepo.getCurrent())!
    const days = await dayEntryRepo.getAllForChallenge(challenge.id)
    const photos = await photoRepo.getMany(days.flatMap((d) => (d.photoId == null ? [] : [d.photoId])))
    expect(photos).toHaveLength(11)
    for (const photo of photos) expect(expoStore.exists(picturePath('photos', photo.file))).toBe(true)
    expect(days.filter((d) => d.notes).length).toBe(6)
    const workouts = await workoutRepo.getForDayEntries(days.map((d) => d.id))
    expect(new Set(workouts.map((w) => w.type)).size).toBeGreaterThan(3)
    expect(workouts.every((w) => w.feel !== undefined)).toBe(true)
    // Weigh-ins on the evening before Day 1 and every third day: 0, 3, 6, 9.
    expect(await measurementRepo.getAll()).toHaveLength(4)
  })

  it('offers each ending one tap away, at any time of day', async () => {
    /** What the app shows after a seed, early in the morning and in the evening. */
    const gates = async (label: string) => {
      await SEEDS.find((seed) => seed.label === label)!.run()
      const challenge = (await challengeRepo.getCurrent())!
      const days = await dayEntryRepo.getAllForChallenge(challenge.id)
      return [8 * 60, 20 * 60].map((nowMin) => resolveGate(challenge, days, todayISO(), nowMin))
    }
    for (const gate of await gates('Seed Day 12')) expect(gate).toMatchObject({ kind: 'active', todayDayNumber: 12, streak: 11 })
    for (const gate of await gates('Seed a missed day')) expect(gate).toMatchObject({ kind: 'needsRestart', failedDayNumber: 10 })
    for (const gate of await gates('Seed a joker')) expect(gate).toMatchObject({ kind: 'jokerUsed', newlyMissed: [10], jokersLeft: 0 })
    // Day 75 lacks only its photo: one picture, and the attempt is won.
    for (const gate of await gates('Seed Day 75')) expect(gate).toMatchObject({ kind: 'active', todayDayNumber: 75, streak: 74 })
    const challenge = (await challengeRepo.getCurrent())!
    const last = (await dayEntryRepo.getByChallengeAndDayNumber(challenge.id, 75))!
    expect(missingTasks(toDayTaskData(last, await workoutRepo.getForDayEntry(last.id), undefined), rulesFor(challenge))).toEqual(['photo'])
  })
})

describe('opening the app', () => {
  const files = () => nodeStore(mkdtempSync(join(tmpdir(), 'gate-')))

  it('finishes putting imported pictures in place when the last import was cut short', async () => {
    const root = mkdtempSync(join(tmpdir(), 'gate-'))
    const store = nodeStore(root)
    await stagePictures(store, [{ folder: 'photos', id: 3, base64: 'aGk=', mimeType: 'image/jpeg' }])
    await settingsRepo.set('picturesPending', true)
    openAppDatabase.mockResolvedValue(open.getDb())
    await render(
      <AppGate store={store}>
        <Text>inside</Text>
      </AppGate>,
    )
    expect(await screen.findByText('inside')).toBeOnTheScreen()
    expect(readdirSync(join(root, 'pictures/photos'))).toEqual(['3.jpg'])
  })

  it('shows the app once the database is open', async () => {
    openAppDatabase.mockResolvedValue(open.getDb())
    await render(
      <AppGate store={files()}>
        <Text>inside</Text>
      </AppGate>,
    )
    expect(await screen.findByText('inside')).toBeOnTheScreen()
    expect(hideSplash).toHaveBeenCalled()
  })

  it('keeps the splash screen up while the fonts are loading', async () => {
    jest.mocked(Font.useFonts).mockReturnValue([false, null])
    openAppDatabase.mockResolvedValue(open.getDb())
    await render(
      <AppGate store={files()}>
        <Text>inside</Text>
      </AppGate>,
    )
    await waitFor(() => expect(openAppDatabase).toHaveBeenCalled())
    expect(screen.queryByText('inside')).toBeNull()
    expect(hideSplash).not.toHaveBeenCalled()
  })

  it('lifts the splash screen and shows the app when the fonts fail', async () => {
    jest.mocked(Font.useFonts).mockReturnValue([false, new Error('no fonts')])
    openAppDatabase.mockResolvedValue(open.getDb())
    await render(
      <AppGate store={files()}>
        <Text>inside</Text>
      </AppGate>,
    )
    expect(await screen.findByText('inside')).toBeOnTheScreen()
    expect(hideSplash).toHaveBeenCalled()
  })

  it('shows an error screen when the database can’t open', async () => {
    openAppDatabase.mockRejectedValue(new Error('disk full'))
    await render(
      <AppGate store={files()}>
        <Text>inside</Text>
      </AppGate>,
    )
    expect(await screen.findByText("Your data couldn't be opened.")).toBeOnTheScreen()
    expect(screen.getByText('disk full')).toBeOnTheScreen()
    expect(hideSplash).toHaveBeenCalled()
    expect(screen.queryByText('inside')).toBeNull()
  })
})
