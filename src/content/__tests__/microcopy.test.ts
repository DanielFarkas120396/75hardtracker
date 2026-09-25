import { describe, expect, it } from 'vitest'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { TASK_IDS } from '../../logic/dayCompletion'
import type { Menace, MenaceLevel, MenaceReason } from '../../logic/menace'
import { duckLine, GLARE_LINE, LUNGE_LINE, mascotLine, planSavedLine, pokeLine, POKE_LINES, taskCheer } from '../microcopy'

describe('taskCheer', () => {
  it('rotates, so consecutive days get different cheers', () => {
    for (const task of TASK_IDS) expect(taskCheer(task, 2)).not.toBe(taskCheer(task, 1))
  })

  it('has a cheer short enough for the one-line pill on every challenge day', () => {
    for (const task of TASK_IDS) {
      for (let day = 1; day <= CHALLENGE_LENGTH; day++) {
        const cheer = taskCheer(task, day)
        expect(cheer).toBeTruthy()
        expect(cheer.length).toBeLessThanOrEqual(28)
      }
    }
  })
})

describe('mascotLine', () => {
  it('cheers a perfect day', () => {
    expect(mascotLine([])).toMatch(/perfect day/i)
  })

  it('names the last task left', () => {
    expect(mascotLine(['photo'])).toMatch(/photo/)
    expect(mascotLine(['water'])).toMatch(/water/)
  })

  it('greets an untouched day, then counts progress', () => {
    expect(mascotLine(TASK_IDS)).toMatch(/let's go/i)
    expect(mascotLine(['water', 'reading'])).toBe('3 down, 2 to go!')
  })
})

const threat = (level: MenaceLevel, reason: MenaceReason, extra: Partial<Menace> = {}): Menace => ({
  level,
  reason,
  ...extra,
})

describe('duckLine', () => {
  it('rests the knife on a perfect day, with a line that rotates by day', () => {
    expect(duckLine({ menace: threat('content', 'done'), missing: [], dayNumber: 1 })).toBe(
      'Perfect day. The knife rests.',
    )
    expect(duckLine({ menace: threat('content', 'done'), missing: [], dayNumber: 2 })).toBe('All five. You may live.')
  })

  it('watches an untouched day, then counts progress', () => {
    expect(duckLine({ menace: threat('watching', 'plenty'), missing: TASK_IDS, dayNumber: 1 })).toBe(
      "New day. I'm watching.",
    )
    expect(duckLine({ menace: threat('watching', 'plenty'), missing: ['water', 'reading'], dayNumber: 1 })).toBe(
      "3 down, 2 to go. I'm watching.",
    )
  })

  it('names the last task left', () => {
    expect(duckLine({ menace: threat('watching', 'plenty'), missing: ['photo'], dayNumber: 1 })).toBe(
      'Just the photo left. Smile. Or else.',
    )
    expect(duckLine({ menace: threat('watching', 'plenty'), missing: ['water'], dayNumber: 1 })).toBe(
      'Just the water left. Drink.',
    )
  })

  it('quotes the plan back', () => {
    const plan = { task: 'reading' as const, at: 22 * 60 + 30 }
    expect(duckLine({ menace: threat('watching', 'plan-pending', { next: plan }), missing: ['reading'], dayNumber: 1 })).toBe(
      "Reading at 22:30. I'll be there.",
    )
    expect(duckLine({ menace: threat('watching', 'plan-due', { next: plan }), missing: ['reading'], dayNumber: 1 })).toBe(
      "It's 22:30. Reading. I'm watching.",
    )
    expect(duckLine({ menace: threat('tapping', 'plan-broken', { broken: plan }), missing: ['reading'], dayNumber: 1 })).toBe(
      'You said 22:30.',
    )
  })

  it('escalates as time runs out', () => {
    const missing = ['reading'] as const
    expect(duckLine({ menace: threat('tapping', 'close'), missing, dayNumber: 1 })).toBe(
      "Tick. Tock. You're cutting it close.",
    )
    expect(duckLine({ menace: threat('hunting', 'wont-fit'), missing, dayNumber: 1 })).toBe(
      "Midnight's coming. So am I.",
    )
    expect(duckLine({ menace: threat('hunting', 'past-bedtime'), missing, dayNumber: 1 })).toBe(
      'Past your bedtime. Not mine.',
    )
  })
})

describe('reaction lines', () => {
  it('cycles through the poke lines', () => {
    expect(pokeLine(0)).toBe('Hands off. Hands on your water bottle.')
    expect(pokeLine(POKE_LINES.length)).toBe(pokeLine(0))
    expect(LUNGE_LINE).toBe("That's it.")
    expect(GLARE_LINE).toBe('I saw that.')
  })

  it('confirms the earliest plan', () => {
    expect(planSavedLine(20 * 60 + 5)).toBe('20:05. Not a minute later.')
  })
})
