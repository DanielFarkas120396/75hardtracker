import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import { dayEntryRepo } from '../../../db/repositories/dayEntryRepo'
import { todayISO } from '../../../lib/dates'
import { PhotoCapture } from '../PhotoCapture'
import { PhotoTask } from '../PhotoTask'

const camera = vi.hoisted(() => ({ supported: true, startCamera: vi.fn() }))

vi.mock('../../../lib/camera', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/camera')>()),
  isCameraSupported: () => camera.supported,
  startCamera: camera.startCamera,
}))

async function renderCard() {
  const onCameraOpen = vi.fn()
  const challengeId = await addChallenge({ startDate: todayISO(), attemptNumber: 1, status: 'active' })
  const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: todayISO() })
  render(
    <PhotoCapture entry={entry} onCameraOpen={onCameraOpen}>
      <PhotoTask />
    </PhotoCapture>,
  )
  const fileClick = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
  return { fileClick, onCameraOpen }
}

describe('PhotoCapture', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  afterEach(() => vi.restoreAllMocks())

  beforeEach(async () => {
    await freshDatabase()
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    camera.supported = true
    camera.startCamera.mockReset().mockResolvedValue({ getTracks: () => [] })
  })

  it('opens the camera sheet, and closes it', async () => {
    const { fileClick, onCameraOpen } = await renderCard()

    fireEvent.click(screen.getByRole('button', { name: '📷 Take photo' }))

    expect(await screen.findByTestId('camera-preview')).toBeInTheDocument()
    expect(onCameraOpen).toHaveBeenCalledTimes(1)
    expect(fileClick).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Close camera' }))
    await waitFor(() => expect(screen.queryByTestId('camera-preview')).not.toBeInTheDocument())
  })

  it("falls back to the phone's camera app when the browser has no in-app camera", async () => {
    camera.supported = false
    const { fileClick } = await renderCard()

    fireEvent.click(screen.getByRole('button', { name: '📷 Take photo' }))

    expect(fileClick).toHaveBeenCalled()
    expect(screen.queryByTestId('camera-preview')).not.toBeInTheDocument()
  })

  it("explains and falls back when the camera can't start", async () => {
    camera.startCamera.mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
    const { fileClick } = await renderCard()

    fireEvent.click(screen.getByRole('button', { name: '📷 Take photo' }))
    await act(async () => {})

    expect(screen.queryByTestId('camera-preview')).not.toBeInTheDocument()
    expect(screen.getByText(/in-app camera isn't available/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '📷 Take photo' }))
    expect(fileClick).toHaveBeenCalled()
  })
})
