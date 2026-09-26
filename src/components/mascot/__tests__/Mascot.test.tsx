import { render, screen } from '@testing-library/react'
import { MotionConfig, MotionGlobalConfig } from 'framer-motion'
import { beforeAll, describe, expect, it } from 'vitest'
import { Mascot } from '../Mascot'

describe('Mascot', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  it('names the duck and his mood for screen readers', () => {
    render(<Mascot mood="sad" />)
    expect(screen.getByRole('img', { name: 'The duck, looking sad' })).toBeInTheDocument()
  })

  it('stays out of the accessibility tree when decorative', () => {
    const { container } = render(<Mascot mood="watching" decorative />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('draws the still pose of the mood right away under reduced motion', () => {
    const { container } = render(
      <MotionConfig reducedMotion="always">
        <Mascot mood="hunting" />
      </MotionConfig>,
    )
    expect(container.querySelector('[data-part="left-wing"]')).toHaveAttribute('transform', 'rotate(-26 51 195)')
    expect(container.querySelector('[data-part="knife"]')).toHaveAttribute(
      'transform',
      'translate(0 0) rotate(26 100 332)',
    )
  })
})
