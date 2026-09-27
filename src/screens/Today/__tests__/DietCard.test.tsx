import { fireEvent, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { DayEntry } from '../../../db/types'
import { RULESETS } from '../../../logic/rulesets'
import { DietCard } from '../DietCard'

const entry: DayEntry = {
  id: 1,
  challengeId: 1,
  date: '2026-09-25',
  dayNumber: 1,
  water_ml: 0,
  pages_read: 0,
  dietFollowed: false,
  noAlcohol: false,
  completed: false,
}

describe('DietCard', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  it('Hard: has no social button, and shows the alcohol toggle', () => {
    render(
      <DietCard
        entry={entry}
        complete={false}
        cheer=""
        rules={RULESETS.hard}
        socialToday={false}
        canPlanSocial={false}
        onPlanSocial={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: '🥂 Plan a social occasion' })).not.toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'No alcohol' })).toBeInTheDocument()
  })

  it('Strong, no social occasion declared today: the button calls onPlanSocial', () => {
    const onPlanSocial = vi.fn()
    render(
      <DietCard
        entry={entry}
        complete={false}
        cheer=""
        rules={RULESETS.strong}
        socialToday={false}
        canPlanSocial
        onPlanSocial={onPlanSocial}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '🥂 Plan a social occasion' }))
    expect(onPlanSocial).toHaveBeenCalled()
  })

  it('Strong, a social occasion today: shows the allowance line instead of the alcohol toggle', () => {
    render(
      <DietCard
        entry={entry}
        complete={false}
        cheer=""
        rules={RULESETS.strong}
        socialToday
        canPlanSocial
        onPlanSocial={vi.fn()}
      />,
    )

    expect(screen.getByText('🥂 Social occasion today — a drink is allowed.')).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'No alcohol' })).not.toBeInTheDocument()
  })

  it('Strong, canPlanSocial false (e.g. Day 75): hides the plan button even though the rules allow it', () => {
    render(
      <DietCard
        entry={entry}
        complete={false}
        cheer=""
        rules={RULESETS.strong}
        socialToday={false}
        canPlanSocial={false}
        onPlanSocial={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: '🥂 Plan a social occasion' })).not.toBeInTheDocument()
  })
})
