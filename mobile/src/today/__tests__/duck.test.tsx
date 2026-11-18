// The Today duck, from the web's DuckHeader tests: when he speaks, what he answers, and when he lunges.
import { TASK_IDS } from '@logic/dayCompletion'
import type { Menace } from '@logic/menace'
import { CATCHPHRASES } from '@logic/microcopy'
import { SETTING_KEYS } from '@logic/settingKeys'
import type { TaskId } from '@logic/types'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import * as Font from 'expo-font'
import { AccessibilityInfo, Text, View } from 'react-native'
import { freshDatabase } from '../../db/__tests__/fixtures'
import { settingsRepo } from '../../db/repositories/settingsRepo'
import { BUBBLE_WIDTH, CHATTER_MAX_MS, FIRST_LINE_DELAY_MS, SPEECH_MS, useDuck, type DuckAnnouncement } from '../DuckHeader'
import { Providers } from './support'

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }))
const mockPlay = jest.fn()
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({ play: mockPlay, seekTo: jest.fn(async () => {}) }),
  setAudioModeAsync: jest.fn(async () => {}),
}))
jest.mock('../../components/mascot/Mascot', () => ({
  Mascot: ({ mood, reaction }: { mood: string; reaction?: { kind: string } }) => {
    const { Text: Line } = jest.requireActual<typeof import('react-native')>('react-native')
    return <Line>{`duck: ${mood}${reaction ? `, ${reaction.kind}` : ''}`}</Line>
  },
}))

const WATCHING: Menace = { level: 'watching', reason: 'plenty' }
const none = Object.fromEntries(TASK_IDS.map((task) => [task, false])) as Record<TaskId, boolean>
const onLunge = jest.fn()

interface Props {
  menace?: Menace
  missing?: readonly TaskId[]
  completion?: Record<TaskId, boolean>
  announcement?: DuckAnnouncement
  lineInHero?: boolean
}

function Duck({ menace = WATCHING, missing = TASK_IDS, completion = none, announcement, lineInHero = false }: Props) {
  const { duck, speech } = useDuck({ menace, missing, completion, dayNumber: 1, name: 'Daniel', announcement, onLunge, lineInHero })
  return (
    <View>
      {speech}
      {duck}
      <Text>the page</Text>
    </View>
  )
}

/** The bubble is for the eyes: VoiceOver hears his lines instead, so the queries must look past that. */
const says = (text: string) => screen.queryByText(text, { includeHiddenElements: true })
const duck = () => screen.getByText(/^duck: /, { includeHiddenElements: true })
const wait = (ms: number) => act(async () => void jest.advanceTimersByTime(ms))
const poke = () => fireEvent.press(screen.getByRole('button', { name: 'Poke the duck' }))

let announce: jest.SpyInstance

beforeEach(async () => {
  jest.mocked(Font.useFonts).mockReturnValue([true, null])
  mockPlay.mockClear()
  onLunge.mockClear()
  await freshDatabase()
  jest.useFakeTimers()
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
  // React Native's test setup already ships this as a mock: restoring spies doesn't empty it.
  jest.mocked(AccessibilityInfo.announceForAccessibility).mockClear()
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

const show = async (props: Props = {}) => {
  const view = await render(<Duck {...props} />, { wrapper: Providers })
  await act(async () => void jest.advanceTimersByTime(0))
  return view
}

it('says the day’s line a beat after Today opens, aloud too, then falls quiet', async () => {
  await show()
  expect(says("New day, Daniel. I'm watching.")).toBeNull()
  await wait(FIRST_LINE_DELAY_MS)
  expect(says("New day, Daniel. I'm watching.")).not.toBeNull()
  // The bubble has room of its own: without it, it would be squeezed to the duck's 64 points.
  expect(screen.getByTestId('duck-bubble', { includeHiddenElements: true })).toHaveStyle({ position: 'absolute', width: BUBBLE_WIDTH })
  expect(BUBBLE_WIDTH).toBe(92)
  expect(announce).toHaveBeenCalledWith("New day, Daniel. I'm watching.")
  await wait(SPEECH_MS)
  expect(says("New day, Daniel. I'm watching.")).toBeNull()
})

it('keeps his line out of the bubble while it is shown under the gauge', async () => {
  const view = await show({ lineInHero: true })
  await wait(FIRST_LINE_DELAY_MS + 100)
  expect(says("New day, Daniel. I'm watching.")).toBeNull()
  // A new line doesn't go in the bubble either.
  await view.rerender(<Duck lineInHero missing={['water']} completion={{ ...none, diet: true }} />)
  expect(says('Just the water left. Drink.')).toBeNull()
})

it('speaks up when his line changes', async () => {
  const view = await show()
  await wait(FIRST_LINE_DELAY_MS + SPEECH_MS)
  await view.rerender(<Duck missing={['photo']} completion={{ ...none, diet: true, water: true, reading: true, workouts: true }} />)
  expect(says('Just the photo left. Smile. Or else.')).not.toBeNull()
  expect(duck()).toHaveTextContent('duck: watching, approve')
})

it('glares, and says so, when a task is unticked', async () => {
  const view = await show({ completion: { ...none, diet: true }, missing: ['workouts', 'water', 'reading', 'photo'] })
  await wait(FIRST_LINE_DELAY_MS + SPEECH_MS)
  await view.rerender(<Duck />)
  expect(says('I saw that.')).not.toBeNull()
  expect(duck()).toHaveTextContent('duck: watching, glare')
  expect(announce).toHaveBeenCalledWith('I saw that.')
})

it('answers each poke, cycling his lines, with the knife’s sound and without VoiceOver reading them', async () => {
  await show({ lineInHero: true })
  await poke()
  expect(says('Hands off. Hands on your water bottle.')).not.toBeNull()
  expect(duck()).toHaveTextContent('duck: watching, poke')
  await wait(3000)
  expect(says('Hands off. Hands on your water bottle.')).toBeNull()
  await poke()
  expect(says('Poke me again. I dare you.')).not.toBeNull()
  expect(mockPlay).toHaveBeenCalledTimes(2)
  expect(announce.mock.calls).toEqual([])
  expect(onLunge).not.toHaveBeenCalled()
})

it('lunges on the third quick poke, once, then starts counting again', async () => {
  await show({ lineInHero: true })
  await poke()
  await wait(300)
  await poke()
  await wait(300)
  await poke()
  expect(says("That's it.")).not.toBeNull()
  expect(duck()).toHaveTextContent('duck: watching, lunge')
  expect(onLunge).toHaveBeenCalledTimes(1)
  await wait(300)
  await poke()
  expect(onLunge).toHaveBeenCalledTimes(1)
  expect(says('That tickles. The knife does not.')).not.toBeNull()
})

it('says what the screen tells him to, with its reaction', async () => {
  const view = await show({ lineInHero: true })
  await view.rerender(<Duck lineInHero announcement={{ text: '21:00. Not a minute later.', reaction: 'relax', id: 1 }} />)
  expect(says('21:00. Not a minute later.')).not.toBeNull()
  expect(duck()).toHaveTextContent('duck: watching, relax')
  expect(announce).toHaveBeenCalledWith('21:00. Not a minute later.')
})

it('says a catchphrase now and then, never the one he just said, and not aloud', async () => {
  jest.spyOn(Math, 'random').mockReturnValue(0)
  await show({ lineInHero: true })
  await wait(CHATTER_MAX_MS)
  expect(says(CATCHPHRASES.watching[0])).not.toBeNull()
  await wait(CHATTER_MAX_MS)
  expect(says(CATCHPHRASES.watching[0])).toBeNull()
  expect(says(CATCHPHRASES.watching[1])).not.toBeNull()
  expect(announce).not.toHaveBeenCalled()
})

it('keeps the knife quiet when sounds are turned off', async () => {
  jest.useRealTimers()
  await settingsRepo.set(SETTING_KEYS.soundEnabled, false)
  await render(<Duck lineInHero />, { wrapper: Providers })
  await screen.findByText('the page')
  // The setting is read from the database: give it its moment.
  await new Promise((resolve) => setTimeout(resolve, 50))
  await poke()
  expect(says('Hands off. Hands on your water bottle.')).not.toBeNull()
  expect(mockPlay).not.toHaveBeenCalled()
})
