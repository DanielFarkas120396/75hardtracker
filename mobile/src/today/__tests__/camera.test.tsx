// The camera sheet, from the web's CameraSheet tests, and what a picture is turned into before it is kept.
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { useCameraPermissions } from 'expo-camera'
import * as Font from 'expo-font'
import { AppState } from 'react-native'
import { freshDatabase } from '../../db/__tests__/fixtures'
import { CameraSheet } from '../CameraSheet'
import { coverCrop, prepareShot, savedSize } from '../photo'
import { Providers } from './support'

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }))
jest.mock('../../components/mascot/Mascot', () => ({
  Mascot: ({ mood, reaction }: { mood: string; reaction?: { kind: string } }) => {
    const { Text: Line } = jest.requireActual<typeof import('react-native')>('react-native')
    return <Line>{`duck: ${mood}${reaction ? `, ${reaction.kind}` : ''}`}</Line>
  },
}))
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
// The phone's image tools: the test notes what was asked of them.
const mockSteps: unknown[] = []
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: (uri: string) => {
      mockSteps.push({ open: uri })
      const context = {
        crop: (rect: unknown) => (mockSteps.push({ crop: rect }), context),
        resize: (size: unknown) => (mockSteps.push({ resize: size }), context),
        renderAsync: async () => ({ saveAsync: async (options: unknown) => (mockSteps.push({ save: options }), { uri: 'file:///prepared.jpg' }) }),
      }
      return context
    },
  },
}))

const request = jest.fn()
const permission = (granted: boolean, canAskAgain = false) =>
  jest.mocked(useCameraPermissions).mockReturnValue([{ granted, canAskAgain, status: granted ? 'granted' : 'denied', expires: 'never' } as never, request, jest.fn()])

beforeEach(async () => {
  jest.mocked(Font.useFonts).mockReturnValue([true, null])
  mockSteps.length = 0
  mockTakePicture.mockReset().mockResolvedValue({ uri: 'file:///camera/raw.jpg', width: 3000, height: 4000 })
  request.mockReset()
  permission(true)
  await freshDatabase()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('a picture, before it is kept', () => {
  it('is cropped like the viewfinder: the middle of the wider side', () => {
    expect(coverCrop(4000, 3000, 1)).toEqual({ sx: 500, sy: 0, sw: 3000, sh: 3000 })
    expect(coverCrop(3000, 4000, 1)).toEqual({ sx: 0, sy: 500, sw: 3000, sh: 3000 })
    expect(coverCrop(3000, 4000, 3 / 4)).toEqual({ sx: 0, sy: 0, sw: 3000, sh: 4000 })
  })

  it('is brought down to 1280 on its longest edge, never up', () => {
    expect(savedSize(3000, 4000)).toEqual({ width: 960, height: 1280 })
    expect(savedSize(4000, 3000)).toEqual({ width: 1280, height: 960 })
    expect(savedSize(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it('is cropped to the viewfinder, shrunk, and saved as a JPEG at 0.8', async () => {
    expect(await prepareShot({ uri: 'file:///raw.jpg', width: 3000, height: 4000 }, 0.5)).toBe('file:///prepared.jpg')
    expect(mockSteps).toEqual([
      { open: 'file:///raw.jpg' },
      { crop: { originX: 500, originY: 0, width: 2000, height: 4000 } },
      { resize: { width: 640, height: 1280 } },
      { save: { format: 'jpeg', compress: 0.8 } },
    ])
  })

  it('keeps its shape and its size when it comes small from the library', async () => {
    await prepareShot({ uri: 'file:///small.jpg', width: 800, height: 600 })
    expect(mockSteps).toEqual([{ open: 'file:///small.jpg' }, { save: { format: 'jpeg', compress: 0.8 } }])
  })
})

describe('the camera sheet', () => {
  const handlers = () => ({
    onCapture: jest.fn(async () => undefined),
    onClose: jest.fn(),
    onUnavailable: jest.fn(),
    onFacingChange: jest.fn(),
  })
  const show = (on: ReturnType<typeof handlers>, ghostUri?: string) =>
    render(<CameraSheet ghostUri={ghostUri} initialFacing="back" {...on} />, { wrapper: Providers })
  const button = (name: string) => screen.getByRole('button', { name })
  const ready = async () => fireEvent(await screen.findByTestId('camera-preview'), 'cameraReady')

  it('starts the camera, then is live once it is ready', async () => {
    await show(handlers())
    expect(await screen.findByText('Starting camera…')).toBeOnTheScreen()
    expect(button('Take photo')).toBeDisabled()
    expect(screen.getByText('duck: watching')).toBeOnTheScreen()
    await ready()
    expect(screen.queryByText('Starting camera…')).toBeNull()
    expect(button('Take photo')).toBeEnabled()
  })

  it('takes a picture cropped to what was on screen, and offers it for review', async () => {
    const on = handlers()
    await show(on)
    await ready()
    await fireEvent(screen.getByTestId('viewfinder'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 600 } } })
    await fireEvent.press(button('Take photo'))
    expect(await screen.findByRole('button', { name: 'Use photo' })).toBeEnabled()
    expect(button('Retake')).toBeEnabled()
    expect(screen.getByLabelText('Your new photo').props.source).toEqual({ uri: 'file:///prepared.jpg' })
    expect(screen.getByText('duck: judging')).toBeOnTheScreen()
    expect(mockTakePicture).toHaveBeenCalledWith({ quality: 0.92 })
    expect(mockSteps).toContainEqual({ crop: { originX: 500, originY: 0, width: 2000, height: 4000 } })
    // Nothing is saved until "Use photo".
    expect(on.onCapture).not.toHaveBeenCalled()
  })

  it('goes back to the camera on Retake, under the duck’s glare', async () => {
    await show(handlers())
    await ready()
    await fireEvent.press(button('Take photo'))
    await fireEvent.press(await screen.findByRole('button', { name: 'Retake' }))
    expect(button('Take photo')).toBeEnabled()
    expect(screen.queryByLabelText('Your new photo')).toBeNull()
    expect(screen.getByText('duck: watching, glare')).toBeOnTheScreen()
  })

  it('saves on "Use photo", says so, and slides away by itself', async () => {
    const on = handlers()
    await show(on)
    await ready()
    await fireEvent.press(button('Take photo'))
    await fireEvent.press(await screen.findByRole('button', { name: 'Use photo' }))
    expect(await screen.findByText('Saved!')).toBeOnTheScreen()
    expect(on.onCapture).toHaveBeenCalledWith('file:///prepared.jpg')
    expect(screen.getByText('duck: celebrating, approve')).toBeOnTheScreen()
    expect(on.onClose).not.toHaveBeenCalled()
    await waitFor(() => expect(on.onClose).toHaveBeenCalledTimes(1), { timeout: 3000 })
  })

  it('says so when the picture cannot be taken, and stays live', async () => {
    mockTakePicture.mockRejectedValueOnce(new Error('camera busy'))
    await show(handlers())
    await ready()
    await fireEvent.press(button('Take photo'))
    expect(await screen.findByText("Couldn't take the photo — try again.")).toBeOnTheScreen()
    expect(button('Take photo')).toBeEnabled()
  })

  it('cycles the timer through off, 3 and 10 seconds', async () => {
    await show(handlers())
    await ready()
    await fireEvent.press(button('Timer: off'))
    await fireEvent.press(button('Timer: 3 seconds'))
    await fireEvent.press(button('Timer: 10 seconds'))
    expect(button('Timer: off')).toBeOnTheScreen()
  })

  it('counts down before the picture, and the countdown can be cancelled', async () => {
    await show(handlers())
    await ready()
    await fireEvent.press(button('Timer: off'))
    await fireEvent.press(button('Take photo'))
    expect(await screen.findByText('3')).toBeOnTheScreen()
    expect(screen.getByText('duck: tapping')).toBeOnTheScreen()
    await fireEvent.press(button('Cancel timer'))
    expect(screen.queryByText('3')).toBeNull()
    expect(mockTakePicture).not.toHaveBeenCalled()

    await fireEvent.press(button('Take photo'))
    expect(await screen.findByRole('button', { name: 'Use photo' }, { timeout: 5000 })).toBeOnTheScreen()
    expect(mockTakePicture).toHaveBeenCalledTimes(1)
  }, 15_000)

  it('shows the last photo as a faint guide, only when there is one, and never over the review', async () => {
    const view = await show(handlers())
    await ready()
    expect(screen.queryByTestId('camera-ghost')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Show last photo as a guide' })).toBeNull()
    await view.unmount()

    await show(handlers(), 'file:///pictures/photos/3.jpg')
    await ready()
    expect(screen.getByTestId('camera-ghost').props.source).toEqual({ uri: 'file:///pictures/photos/3.jpg' })
    await fireEvent.press(button('Show last photo as a guide'))
    expect(screen.queryByTestId('camera-ghost')).toBeNull()
    await fireEvent.press(button('Show last photo as a guide'))
    await fireEvent.press(button('Take photo'))
    await screen.findByRole('button', { name: 'Use photo' })
    expect(screen.queryByTestId('camera-ghost')).toBeNull()
  })

  it('switches camera, mirrors the front one, and remembers the choice', async () => {
    const on = handlers()
    await show(on)
    await ready()
    expect(screen.getByTestId('camera-preview').props).toMatchObject({ facing: 'back', mirror: false })
    await fireEvent.press(button('Switch camera'))
    expect(on.onFacingChange).toHaveBeenCalledWith('front')
    expect(screen.getByTestId('camera-preview').props).toMatchObject({ facing: 'front', mirror: true })
    expect(screen.getByText('Starting camera…')).toBeOnTheScreen()
  })

  it('closes from its own button, and when the app goes to the background', async () => {
    const listen = jest.spyOn(AppState, 'addEventListener')
    const on = handlers()
    await show(on)
    await ready()
    await fireEvent.press(button('Close camera'))
    await waitFor(() => expect(on.onClose).toHaveBeenCalledTimes(1))

    // Every listener hears it (the theme listens for the date too); only the camera closes on it.
    for (const [event, onChange] of listen.mock.calls) if (event === 'change') onChange('background')
    expect(on.onClose).toHaveBeenCalledTimes(2)
  })

  it('asks for the camera once, and reports it unavailable when the answer is no', async () => {
    permission(false, true)
    request.mockResolvedValue({ granted: false })
    const on = handlers()
    await show(on)
    await waitFor(() => expect(on.onUnavailable).toHaveBeenCalledTimes(1))
    expect(request).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('camera-preview')).toBeNull()
  })

  it('reports it unavailable at once when the camera was refused before', async () => {
    permission(false, false)
    const on = handlers()
    await show(on)
    await waitFor(() => expect(on.onUnavailable).toHaveBeenCalledTimes(1))
    expect(request).not.toHaveBeenCalled()
  })
})
