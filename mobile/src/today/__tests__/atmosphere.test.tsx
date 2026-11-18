// The evening's mood lighting, the page that carries it, and the gaze the page feeds.
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as Font from 'expo-font'
import { AccessibilityInfo, Animated, Text } from 'react-native'
import { artPoint, gaze } from '../../components/mascot/gaze'
import { freshDatabase } from '../../db/__tests__/fixtures'
import { MenaceAtmosphere } from '../MenaceAtmosphere'
import { Page } from '../parts'
import { PhotoCaptureContext, type PhotoCaptureApi } from '../photoCaptureContext'
import { Providers } from './support'

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }))

beforeEach(async () => {
  jest.mocked(Font.useFonts).mockReturnValue([true, null])
  await freshDatabase()
})

afterEach(() => {
  jest.restoreAllMocks()
})

const reduceMotion = (on: boolean) => jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(on)
const layer = (name: 'dark' | 'red' | 'flash') => screen.queryByTestId(`atmosphere-${name}`, { includeHiddenElements: true })
const show = (level: 'content' | 'watching' | 'tapping' | 'hunting', flashes = 0) => render(<MenaceAtmosphere level={level} flashes={flashes} />)

describe('the mood lighting', () => {
  it('draws nothing while there is time', async () => {
    reduceMotion(false)
    await show('watching')
    expect(layer('dark')).toBeNull()
    expect(layer('red')).toBeNull()
    expect(layer('flash')).toBeNull()
  })

  it('darkens the edges while he taps, and clears once he calms down', async () => {
    reduceMotion(false)
    const view = await show('tapping')
    expect(layer('dark')).not.toBeNull()
    expect(layer('red')).toBeNull()
    await view.rerender(<MenaceAtmosphere level="watching" flashes={0} />)
    // It fades out over a second, then is gone.
    expect(layer('dark')).not.toBeNull()
    await waitFor(() => expect(layer('dark')).toBeNull(), { timeout: 3000 })
  })

  it('glows red and pulses slowly while he hunts', async () => {
    reduceMotion(false)
    const loop = jest.spyOn(Animated, 'loop')
    await show('hunting')
    expect(layer('red')).not.toBeNull()
    expect(layer('dark')).toBeNull()
    await waitFor(() => expect(loop).toHaveBeenCalledTimes(1))
  })

  it('flashes once per lunge, and the flash is gone after', async () => {
    reduceMotion(false)
    const view = await show('watching')
    await view.rerender(<MenaceAtmosphere level="watching" flashes={1} />)
    expect(layer('flash')).not.toBeNull()
    await waitFor(() => expect(layer('flash')).toBeNull(), { timeout: 3000 })
    // The same count again is no new lunge.
    await view.rerender(<MenaceAtmosphere level="tapping" flashes={1} />)
    expect(layer('flash')).toBeNull()
  })

  it('neither pulses nor flashes under reduce motion', async () => {
    reduceMotion(true)
    const view = await show('watching')
    // The setting is read from the phone: give it its moment.
    await new Promise((resolve) => setTimeout(resolve, 50))
    const loop = jest.spyOn(Animated, 'loop')
    await view.rerender(<MenaceAtmosphere level="hunting" flashes={1} />)
    expect(layer('red')).not.toBeNull()
    expect(layer('flash')).toBeNull()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(loop).not.toHaveBeenCalled()
  })
})

describe('the gaze', () => {
  it('turns a point of the window into the duck’s own units', () => {
    // A duck drawn 49 by 50 at (100, 200): his art runs from (-10, 20) over 490 by 500.
    const box = { left: 100, top: 200, width: 49, height: 50 }
    expect(artPoint(100, 200, box)).toEqual({ x: -10, y: 20 })
    expect(artPoint(149, 250, box)).toEqual({ x: 480, y: 520 })
    expect(artPoint(124.5, 225, box)).toEqual({ x: 235, y: 270 })
    // A touch far from him still gives a direction to look in.
    expect(artPoint(300, 600, box).x).toBeGreaterThan(480)
  })

  it('hears of every touch on the page and of its scrolling, until it stops watching', async () => {
    const seen: string[] = []
    const stop = gaze.watch({ touch: (x, y) => seen.push(`touch ${x},${y}`), scrolled: () => seen.push('scrolled') })
    const camera = { cameraOpen: false } as PhotoCaptureApi
    await render(
      <PhotoCaptureContext.Provider value={camera}>
        <Page>
          <Text>the page</Text>
        </Page>
      </PhotoCaptureContext.Provider>,
      { wrapper: Providers },
    )
    await screen.findByText('the page')
    await fireEvent(screen.getByTestId('today-page'), 'touchStart', { nativeEvent: { pageX: 40, pageY: 300 } })
    await fireEvent(screen.getByTestId('today-page'), 'touchMove', { nativeEvent: { pageX: 44, pageY: 310 } })
    await fireEvent.scroll(screen.getByTestId('today-scroll'), { nativeEvent: { contentOffset: { y: 120 } } })
    expect(seen).toEqual(['touch 40,300', 'touch 44,310', 'scrolled'])

    stop()
    await fireEvent(screen.getByTestId('today-page'), 'touchStart', { nativeEvent: { pageX: 1, pageY: 1 } })
    expect(seen).toHaveLength(3)
  })
})
