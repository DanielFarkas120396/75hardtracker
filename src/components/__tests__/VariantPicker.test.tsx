import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { JOKER_DEFINITION, VARIANT_NAMES, VARIANT_SUMMARIES } from '../../content/variants'
import { VARIANTS } from '../../logic/rulesets'
import { VariantPicker } from '../VariantPicker'

describe('VariantPicker', () => {
  it('renders a radiogroup labelled Challenge, with all four variants named, and the full rules on the selected one', () => {
    render(<VariantPicker value="hard" onChange={vi.fn()} />)

    expect(screen.getByRole('radiogroup', { name: 'Challenge' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(4)
    for (const variant of VARIANTS) {
      const radio = screen.getByRole('radio', { name: new RegExp(`^${VARIANT_NAMES[variant]}`) })
      if (variant === 'hard') expect(radio).toHaveTextContent(VARIANT_SUMMARIES[variant])
      else expect(radio).not.toHaveTextContent(VARIANT_SUMMARIES[variant])
    }
  })

  it('checks nothing when no challenge is picked yet', () => {
    render(<VariantPicker value={null} onChange={vi.fn()} />)

    for (const radio of screen.getAllByRole('radio')) expect(radio).toHaveAttribute('aria-checked', 'false')
  })

  it('explains jokers on a selected challenge that has some', () => {
    render(<VariantPicker value="soft" onChange={vi.fn()} />)

    expect(screen.getByRole('radio', { name: /^75 Soft/ })).toHaveTextContent(`${JOKER_DEFINITION} ${VARIANT_SUMMARIES.soft}`)
  })

  it('marks the current value as the checked radio', () => {
    render(<VariantPicker value="medium" onChange={vi.fn()} />)

    expect(screen.getByRole('radio', { name: /^75 Medium/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /^75 Hard/ })).toHaveAttribute('aria-checked', 'false')
  })

  it('calls onChange when a variant is tapped', () => {
    const onChange = vi.fn()
    render(<VariantPicker value="hard" onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /^75 Soft/ }))

    expect(onChange).toHaveBeenCalledExactlyOnceWith('soft')
  })

  it('disables all four radios when disabled', () => {
    render(<VariantPicker value="hard" onChange={vi.fn()} disabled />)

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled()
    }
  })
})
