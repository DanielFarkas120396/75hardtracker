import { fireEvent, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { Modal } from '../ui/Modal'

function Host({ onClose, open }: { onClose: () => void; open: boolean }) {
  return (
    <>
      <button type="button">Water</button>
      <Modal open={open} onClose={onClose} placement="sheet" labelledBy="sheet-title">
        <h2 id="sheet-title">Water</h2>
        <button type="button">+ 250 ml</button>
      </Modal>
    </>
  )
}

describe('Modal as a sheet', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  it('is a dialog named by its heading, and closes on the backdrop and on Escape', () => {
    const onClose = vi.fn()
    render(<Host open onClose={onClose} />)

    const dialog = screen.getByRole('dialog', { name: 'Water' })
    expect(dialog).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: '+ 250 ml' }))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(dialog.parentElement as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('gives focus back to the element that had it when it closes', () => {
    const { rerender } = render(<Host open={false} onClose={() => {}} />)
    const tile = screen.getByRole('button', { name: 'Water' })
    tile.focus()

    rerender(<Host open onClose={() => {}} />)
    expect(screen.getByRole('dialog')).toHaveFocus()

    rerender(<Host open={false} onClose={() => {}} />)
    expect(tile).toHaveFocus()
  })
})
