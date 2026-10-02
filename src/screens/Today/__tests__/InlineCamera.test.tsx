import { act, fireEvent, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { InlineCamera, SAVED_LINGER_MS } from '../InlineCamera'

const camera = vi.hoisted(() => ({
  startCamera: vi.fn(),
  captureFrame: vi.fn(),
  stop: vi.fn(),
}))

vi.mock('../../../lib/camera', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/camera')>()),
  startCamera: camera.startCamera,
  captureFrame: camera.captureFrame,
}))

const fakeStream = () => ({ getTracks: () => [{ stop: camera.stop }] }) as unknown as MediaStream
const shot = new Blob(['shot'], { type: 'image/jpeg' })

/** Lets the startCamera / captureFrame promises settle. */
const flush = () => act(async () => {})

function renderCamera(props: Partial<Parameters<typeof InlineCamera>[0]> = {}) {
  const handlers = {
    onCapture: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    onUnavailable: vi.fn(),
  }
  render(<InlineCamera {...handlers} {...props} />)
  return handlers
}

describe('InlineCamera', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    // jsdom has no object URLs; BlobImage only needs a string back.
    URL.createObjectURL = vi.fn(() => 'blob:photo')
    URL.revokeObjectURL = vi.fn()
  })

  beforeEach(() => {
    localStorage.clear()
    camera.startCamera.mockReset().mockImplementation(() => Promise.resolve(fakeStream()))
    camera.captureFrame.mockReset().mockResolvedValue(shot)
    camera.stop.mockReset()
  })

  afterEach(() => vi.useRealTimers())

  it('opens the back camera first, and remembers a switch to the front', async () => {
    renderCamera()
    await flush()
    expect(camera.startCamera).toHaveBeenLastCalledWith('environment')

    fireEvent.click(screen.getByRole('button', { name: 'Switch camera' }))
    await flush()

    expect(camera.stop).toHaveBeenCalledTimes(1) // the back camera is released before the front one opens
    expect(camera.startCamera).toHaveBeenLastCalledWith('user')
    expect(screen.getByTestId('camera-preview')).toHaveClass('-scale-x-100')
    expect(localStorage.getItem('75hard.cameraFacing')).toBe('user')
  })

  it('takes a photo, then saves it on "Use photo" and folds away', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { onCapture, onClose } = renderCamera()
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }))
    await flush()
    expect(camera.captureFrame).toHaveBeenCalledWith(expect.any(HTMLVideoElement), false)

    fireEvent.click(screen.getByRole('button', { name: 'Use photo' }))
    await flush()
    expect(onCapture).toHaveBeenCalledWith(shot)
    expect(screen.getByRole('button', { name: 'Saved!' })).toBeDisabled()

    act(() => vi.advanceTimersByTime(SAVED_LINGER_MS))
    expect(onClose).toHaveBeenCalled()
  })

  it('goes back to the live camera on "Retake"', async () => {
    const { onCapture } = renderCamera()
    await flush()
    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }))
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Retake' }))

    expect(screen.getByRole('button', { name: 'Take photo' })).toBeEnabled()
    expect(onCapture).not.toHaveBeenCalled()
  })

  it('keeps the review open with an error when saving fails', async () => {
    renderCamera({ onCapture: vi.fn().mockRejectedValue(new Error('disk full')) })
    await flush()
    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }))
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Use photo' }))
    await flush()

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't save that photo")
    expect(screen.getByRole('button', { name: 'Use photo' })).toBeEnabled()
  })

  it('counts down 3 seconds before shooting when the timer is on', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderCamera()
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Timer: off' }))
    expect(screen.getByRole('button', { name: 'Timer: 3 seconds' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }))

    // Each tick schedules the next one, so the clock moves a second at a time.
    const tick = () => act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByText('3')).toBeInTheDocument()
    tick()
    tick()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(camera.captureFrame).not.toHaveBeenCalled()

    tick()
    await flush()
    expect(camera.captureFrame).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Use photo' })).toBeInTheDocument()
  })

  it('lets a countdown be cancelled', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderCamera()
    await flush()
    fireEvent.click(screen.getByRole('button', { name: 'Timer: off' }))
    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }))

    fireEvent.click(screen.getByRole('button', { name: 'Cancel timer' }))
    act(() => vi.advanceTimersByTime(5000))

    expect(camera.captureFrame).not.toHaveBeenCalled()
  })

  it('shows the last photo as a ghost that can be toggled off', async () => {
    renderCamera({ ghost: new Blob(['yesterday']) })
    await flush()
    expect(screen.getByTestId('camera-ghost')).toHaveClass('opacity-30')

    fireEvent.click(screen.getByRole('button', { name: 'Show last photo as a guide' }))

    expect(screen.queryByTestId('camera-ghost')).not.toBeInTheDocument()
  })

  it('reports when the camera cannot start', async () => {
    camera.startCamera.mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
    const { onUnavailable } = renderCamera()
    await flush()
    expect(onUnavailable).toHaveBeenCalled()
  })

  it('releases the camera when it unmounts', async () => {
    const { unmount } = render(
      <InlineCamera onCapture={vi.fn()} onClose={vi.fn()} onUnavailable={vi.fn()} />,
    )
    await flush()
    unmount()
    expect(camera.stop).toHaveBeenCalled()
  })

  it('closes when the app goes to the background', async () => {
    const { onClose } = renderCamera()
    await flush()

    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    visibility.mockRestore()

    expect(onClose).toHaveBeenCalled()
  })
})
