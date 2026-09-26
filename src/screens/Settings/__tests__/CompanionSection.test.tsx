import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CompanionSection } from '../CompanionSection'

describe('CompanionSection', () => {
  it('saves a bedtime in range', () => {
    const onBedtimeChange = vi.fn(async () => {})
    render(<CompanionSection bedtime="23:00" onBedtimeChange={onBedtimeChange} />)
    fireEvent.change(screen.getByLabelText('Bedtime'), { target: { value: '22:30' } })
    expect(onBedtimeChange).toHaveBeenCalledWith('22:30')
  })

  it('explains a bedtime out of range instead of saving it', () => {
    const onBedtimeChange = vi.fn(async () => {})
    render(<CompanionSection bedtime="23:00" onBedtimeChange={onBedtimeChange} />)
    fireEvent.change(screen.getByLabelText('Bedtime'), { target: { value: '17:00' } })
    expect(onBedtimeChange).not.toHaveBeenCalled()
    expect(screen.getByText('Pick a time between 18:00 and 23:59.')).toBeInTheDocument()
  })

  it('follows the saved bedtime when it loads', () => {
    const { rerender } = render(<CompanionSection bedtime="23:00" onBedtimeChange={vi.fn(async () => {})} />)
    rerender(<CompanionSection bedtime="21:30" onBedtimeChange={vi.fn(async () => {})} />)
    expect(screen.getByLabelText('Bedtime')).toHaveValue('21:30')
  })
})
