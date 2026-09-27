import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VARIANT_NAMES, VARIANT_SUMMARIES } from '../../content/variants'
import { VARIANTS } from '../../logic/rulesets'
import { VariantPicker } from '../VariantPicker'

describe('VariantPicker', () => {
  it('renders a radiogroup labelled Challenge, with all four variants named and summarised', () => {
    render(<VariantPicker value="hard" onChange={vi.fn()} />)

    expect(screen.getByRole('radiogroup', { name: 'Challenge' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(4)
    for (const variant of VARIANTS) {
      const radio = screen.getByRole('radio', { name: new RegExp(`^${VARIANT_NAMES[variant]}`) })
      expect(radio).toHaveTextContent(VARIANT_SUMMARIES[variant])
    }
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
