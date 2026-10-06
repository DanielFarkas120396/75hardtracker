import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { freshDatabase } from '../../../db/__tests__/fixtures'
import { GalleryScreen } from '../GalleryScreen'

describe('GalleryScreen', () => {
  beforeEach(freshDatabase)

  it('with no photos, shows the duck and sends you to take one', async () => {
    const onTakePhoto = vi.fn()
    render(<GalleryScreen onTakePhoto={onTakePhoto} />)

    // The first render waits on a live query: under a loaded test run, it can take more than a second.
    expect(await screen.findByRole('heading', { name: 'No photos yet' }, { timeout: 5000 })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: "Take today's photo" }))
    expect(onTakePhoto).toHaveBeenCalledOnce()
  })
})
