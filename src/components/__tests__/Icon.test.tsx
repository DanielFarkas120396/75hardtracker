import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Icon } from '../icons/Icon'
import { ICON_NAMES } from '../icons/icons'

describe('Icon', () => {
  it.each(ICON_NAMES)('draws %s in the current colour, hidden from screen readers', (name) => {
    const { container } = render(<Icon name={name} />)
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('stroke', 'currentColor')
    expect(svg.childElementCount).toBeGreaterThan(0)
  })

  it('is announced when given a label', () => {
    render(<Icon name="water" label="Water" />)
    expect(screen.getByRole('img', { name: 'Water' })).toBeInTheDocument()
  })

  it('draws thinner lines when asked, for the big drawings', () => {
    const { container } = render(<Icon name="cycling" size={220} strokeWidth={1} />)
    expect(container.querySelector('svg')).toHaveAttribute('stroke-width', '1')
  })
})
