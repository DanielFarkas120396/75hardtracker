import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Challenge } from '../../../db/types'
import { RulesSection } from '../RulesSection'

const challenge = (variant: Challenge['variant']): Challenge => ({ id: 1, startDate: '2026-01-01', attemptNumber: 1, status: 'active', variant })

describe('RulesSection', () => {
  it('shows the attempt rules, the stakes, the noon limit and the lack of reminders', () => {
    render(<RulesSection challenge={challenge('hard')} />)
    expect(screen.getByText('3.8 L of water.')).toBeInTheDocument()
    expect(screen.getByText('Miss a day: back to Day 1.')).toBeInTheDocument()
    expect(screen.getByText(/Yesterday stays open until noon/)).toBeInTheDocument()
    expect(screen.getByText(/^No reminders\./)).toBeInTheDocument()
  })

  it('follows the challenge of the attempt', () => {
    render(<RulesSection challenge={challenge('soft')} />)
    expect(screen.getByText('3 L of water.')).toBeInTheDocument()
    expect(screen.getByText(/Three jokers/)).toBeInTheDocument()
  })
})
