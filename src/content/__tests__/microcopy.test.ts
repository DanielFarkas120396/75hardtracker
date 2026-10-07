import { describe, expect, it } from 'vitest'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { TASK_IDS } from '../../logic/dayCompletion'
import type { Menace, MenaceLevel, MenaceReason } from '../../logic/menace'
import { RULESETS, VARIANTS } from '../../logic/rulesets'
import {
  CATCHPHRASES,
  duckLine,
  GLARE_LINE,
  LUNGE_LINE,
  nextCatchphrase,
  planReminderLine,
  planSavedLine,
  pokeLine,
  POKE_LINES,
  taskCheer,
  timeLeftLine,
} from '../microcopy'

describe('taskCheer', () => {
  it('rotates, so consecutive days get different cheers', () => {
    for (const task of TASK_IDS) expect(taskCheer(task, 2, RULESETS.hard)).not.toBe(taskCheer(task, 1, RULESETS.hard))
  })

  it('has a cheer short enough for the one-line pill on every challenge day, for every variant', () => {
    for (const variant of VARIANTS) {
      for (const task of TASK_IDS) {
        for (let day = 1; day <= CHALLENGE_LENGTH; day++) {
          const cheer = taskCheer(task, day, RULESETS[variant])
          expect(cheer).toBeTruthy()
          expect(cheer.length).toBeLessThanOrEqual(28)
        }
      }
    }
  })

  it("words Strong's diet cheer without mentioning drinks, since a declared occasion allows one", () => {
    expect(taskCheer('diet', 3, RULESETS.strong)).toBe('No cheats. Solid.')
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

  it('watches an untouched day, and leaves the counting to the ring', () => {
    expect(duckLine({ menace: threat('watching', 'plenty'), missing: TASK_IDS, dayNumber: 1 })).toBe(
      "New day. I'm watching.",
    )
    expect(duckLine({ menace: threat('watching', 'plenty'), missing: ['water', 'reading'], dayNumber: 1 })).toBe(
      'Started. Not finished.',
    )
  })

  it('stops greeting once something is logged, and puts an unfinished yesterday first', () => {
    const calm = { menace: threat('watching', 'plenty'), missing: TASK_IDS, dayNumber: 1, name: 'Sam' }
    expect(duckLine(calm)).toBe("New day, Sam. I'm watching.")
    expect(duckLine({ ...calm, started: true })).toBe('Started. Not finished.')
    expect(duckLine({ ...calm, yesterdayOpen: true })).toBe("Yesterday's still open. Noon.")
    // Only his calm line gives way: a close call still speaks.
    expect(duckLine({ ...calm, menace: threat('tapping', 'close'), yesterdayOpen: true })).toBe(
      "Tick. Tock. You're cutting it close.",
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

  it("starts an untouched day with the player's name, when known", () => {
    expect(duckLine({ menace: threat('watching', 'plenty'), missing: TASK_IDS, dayNumber: 1, name: 'Daniel' })).toBe(
      "New day, Daniel. I'm watching.",
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

  it('names the next plan under the ring', () => {
    expect(planReminderLine('reading', 21 * 60)).toBe('Reading at 21:00')
  })
})

describe('nextCatchphrase', () => {
  it('picks one of his lines for the mood, never the one he just said', () => {
    for (let i = 0; i < 20; i++) {
      const line = nextCatchphrase('hunting', 'Run.')
      expect(CATCHPHRASES.hunting).toContain(line)
      expect(line).not.toBe('Run.')
    }
  })
})

describe('timeLeftLine', () => {
  it('counts down to midnight', () => {
    expect(timeLeftLine(22 * 60 + 30)).toBe('1h30 left')
    expect(timeLeftLine(21 * 60)).toBe('3h00 left')
    expect(timeLeftLine(23 * 60 + 15)).toBe('45 min left')
  })
})
