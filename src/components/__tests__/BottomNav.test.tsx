import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BottomNav } from '../ui/BottomNav'

describe('BottomNav', () => {
  it('marks the active tab and switches on tap', () => {
    const onChange = vi.fn()
    render(<BottomNav active="stats" onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Stats' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Today' })).not.toHaveAttribute('aria-current')
    fireEvent.click(screen.getByRole('button', { name: 'Gallery' }))
    expect(onChange).toHaveBeenCalledWith('gallery')
  })
})
