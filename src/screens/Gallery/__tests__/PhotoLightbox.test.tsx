import { fireEvent, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { Modal } from '../../../components/ui/Modal'
import type { GalleryEntry } from '../../../hooks/useGalleryPhotos'
import { PhotoLightbox } from '../PhotoLightbox'

const entry: GalleryEntry = {
  photo: { id: 1, date: '2026-09-01', blob: new Blob(['jpeg'], { type: 'image/jpeg' }) },
  dayNumber: 1,
  attemptNumber: 1,
  date: '2026-09-01',
}

/** The attempt-history layout: a lightbox opened on top of a modal. */
function renderOverModal(lightboxIndex: number | null) {
  const closeModal = vi.fn()
  const closeLightbox = vi.fn()
  render(
    <>
      <Modal open onClose={closeModal}>
        Attempt #1
      </Modal>
      <PhotoLightbox entries={[entry]} index={lightboxIndex} onClose={closeLightbox} onNavigate={() => {}} />
    </>,
  )
  return { closeModal, closeLightbox }
}

describe('PhotoLightbox over a modal', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
    // jsdom has no object URLs; BlobImage only needs a string back.
    URL.createObjectURL = vi.fn(() => 'blob:photo')
    URL.revokeObjectURL = vi.fn()
  })

  it('closes on Escape without closing the modal underneath', () => {
    const { closeModal, closeLightbox } = renderOverModal(0)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(closeLightbox).toHaveBeenCalledOnce()
    expect(closeModal).not.toHaveBeenCalled()
  })

  it('lets Escape reach the modal while no photo is open', () => {
    const { closeModal, closeLightbox } = renderOverModal(null)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(closeModal).toHaveBeenCalledOnce()
    expect(closeLightbox).not.toHaveBeenCalled()
  })
})
