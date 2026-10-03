import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { freshDatabase } from '../../../db/__tests__/fixtures'
import { GalleryScreen } from '../GalleryScreen'

describe('GalleryScreen', () => {
  beforeEach(freshDatabase)

  it('with no photos, shows the duck and sends you to take one', async () => {
    const onTakePhoto = vi.fn()
    render(<GalleryScreen onTakePhoto={onTakePhoto} />)

    expect(await screen.findByRole('heading', { name: 'No photos yet' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: "Take today's photo" }))
    expect(onTakePhoto).toHaveBeenCalledOnce()
  })
})
