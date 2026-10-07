import { describe, expect, it } from 'vitest'
import { RULESETS } from '../../logic/rulesets'
import {
  dailyRuleLines, dietRuleLine, dietToggleLabel, stakesLine, variantHighlights, formatLiters, missedDayExplanation, preStartPlanLine, readingRuleLine,
  VARIANT_NAMES, VARIANT_SUMMARIES, victoryLine, victoryTitle, workoutRuleLine,
} from '../variants'
import { taskCheer, taskRule } from '../microcopy'

describe('variant copy', () => {
  it('names the four challenges', () => {
    expect(VARIANT_NAMES).toEqual({ hard: '75 Hard', strong: '75 Strong', medium: '75 Medium', soft: '75 Soft' })
  })

  it('summarises each challenge for the picker', () => {
    expect(VARIANT_SUMMARIES.hard).toBe(
      'Two 45-min workouts (one outdoors), strict diet, no alcohol, 3.8 L of water, 10 pages of non-fiction, a photo. Miss a day: back to Day 1.',
    )
    expect(VARIANT_SUMMARIES.strong).toBe(
      'Everything in 75 Hard, plus one social occasion a week, declared the day before.',
    )
    expect(VARIANT_SUMMARIES.medium).toBe(
      'One 45-min workout, eat healthy, 3 L of water, 10 pages of any book, a photo. One social occasion a week. One joker.',
    )
    expect(VARIANT_SUMMARIES.soft).toBe('Like 75 Medium, plus a recovery day a week. Three jokers.')
  })

  it('prints litres with up to two decimals and no trailing zeros', () => {
    expect(formatLiters(3800)).toBe('3.8')
    expect(formatLiters(3000)).toBe('3')
    expect(formatLiters(1250)).toBe('1.25')
    expect(formatLiters(750)).toBe('0.75')
  })

  it('states the card rules per challenge', () => {
    expect(workoutRuleLine(RULESETS.hard)).toBe('2 sessions of at least 45 minutes, one of them outdoors.')
    expect(workoutRuleLine(RULESETS.strong)).toBe('2 sessions of at least 45 minutes, one of them outdoors.')
    expect(workoutRuleLine(RULESETS.medium)).toBe('1 session of at least 45 minutes.')
    expect(workoutRuleLine(RULESETS.soft)).toBe('1 session of at least 45 minutes. One recovery day a week.')
    expect(dietRuleLine(RULESETS.hard)).toBe('No cheat meals, no alcohol.')
    expect(dietRuleLine(RULESETS.strong)).toBe('No cheat meals. No alcohol, except on one declared social occasion a week.')
    expect(dietRuleLine(RULESETS.medium)).toBe('Eat healthy. No alcohol, except on one declared social occasion a week.')
    expect(dietToggleLabel(RULESETS.strong)).toBe('I followed my diet')
    expect(dietToggleLabel(RULESETS.soft)).toBe('I ate healthy')
    expect(readingRuleLine(RULESETS.hard)).toBe('10 pages of non-fiction a day.')
    expect(readingRuleLine(RULESETS.medium)).toBe('10 pages of any book a day.')
  })

  it('lists each missed task by the attempt rules', () => {
    expect(taskRule('workouts', RULESETS.hard)).toBe('2 workouts of 45+ min, one outdoors')
    expect(taskRule('workouts', RULESETS.medium)).toBe('1 workout of 45+ min')
    expect(taskRule('workouts', RULESETS.soft)).toBe('1 workout of 45+ min (or a recovery day)')
    expect(taskRule('diet', RULESETS.hard)).toBe('Diet followed, no alcohol')
    expect(taskRule('diet', RULESETS.strong)).toBe('Diet followed, no alcohol unless declared')
    expect(taskRule('diet', RULESETS.medium)).toBe('Ate healthy, no alcohol unless declared')
    expect(taskRule('water', RULESETS.hard)).toBe('3.8 L of water')
    expect(taskRule('water', RULESETS.medium)).toBe('3 L of water')
    expect(taskRule('reading', RULESETS.soft)).toBe('10 pages read')
    expect(taskRule('photo', RULESETS.soft)).toBe('Progress photo')
  })

  it('cheers one workout on Medium and Soft, and their 3 L', () => {
    expect(taskCheer('workouts', 1, RULESETS.hard)).toBe('Both workouts done! 💪')
    expect(taskCheer('workouts', 1, RULESETS.medium)).toBe('Workout done! 💪')
    expect(taskCheer('water', 2, RULESETS.hard)).toBe('All 3.8 L down')
    expect(taskCheer('water', 2, RULESETS.soft)).toBe('All 3 L down')
  })

  it('explains a failed attempt per challenge', () => {
    expect(missedDayExplanation(RULESETS.hard, 2)).toBe(
      '75 Hard is all-or-nothing on every task, every day. This attempt (#2) ends here — but every photo and stat you logged is saved for good.',
    )
    expect(missedDayExplanation(RULESETS.strong, 1)).toBe(
      '75 Strong is all-or-nothing on every task, every day. This attempt (#1) ends here — but every photo and stat you logged is saved for good.',
    )
    expect(missedDayExplanation(RULESETS.medium, 3)).toBe(
      '75 Medium forgives one missed day. This was your second, so this attempt (#3) ends here — but every photo and stat you logged is saved for good.',
    )
    expect(missedDayExplanation(RULESETS.soft, 1)).toBe(
      '75 Soft forgives three missed days. This was your fourth, so this attempt (#1) ends here — but every photo and stat you logged is saved for good.',
    )
  })

  it('celebrates and prepares per challenge', () => {
    expect(victoryTitle(RULESETS.medium)).toBe('75 Medium complete! 🏆')
    expect(victoryLine(RULESETS.hard)).toBe(
      "75 days. Two workouts, the diet, the water, the reading and the photo — every single day. That's done now, and it's yours.",
    )
    expect(victoryLine(RULESETS.soft)).toBe(
      "75 days. The workout, the diet, the water, the reading and the photo. That's done now, and it's yours.",
    )
    expect(preStartPlanLine(RULESETS.hard)).toBe('plan two workouts a day')
    expect(preStartPlanLine(RULESETS.medium)).toBe('plan a workout a day')
  })
})

describe('picker and deal copy', () => {
  it('sets each challenge apart in three chips', () => {
    expect(variantHighlights(RULESETS.hard)).toEqual(['2 workouts a day', 'No days off', 'No jokers'])
    expect(variantHighlights(RULESETS.strong)).toEqual(['2 workouts a day', 'Social night weekly', 'No jokers'])
    expect(variantHighlights(RULESETS.medium)).toEqual(['1 workout a day', 'Social night weekly', '1 joker'])
    expect(variantHighlights(RULESETS.soft)).toEqual(['1 workout a day', 'Social + recovery weekly', '3 jokers'])
  })

  it('says what a missed day costs', () => {
    expect(stakesLine(RULESETS.hard)).toBe('Miss a day: back to Day 1.')
    expect(stakesLine(RULESETS.medium)).toBe('One joker: one missed day forgiven. Miss one more: back to Day 1.')
    expect(stakesLine(RULESETS.soft)).toBe('Three jokers: three missed days forgiven. Miss one more: back to Day 1.')
  })

  it('lists the five daily rules', () => {
    expect(dailyRuleLines(RULESETS.hard)).toEqual([
      '2 sessions of at least 45 minutes, one of them outdoors.',
      'No cheat meals, no alcohol.',
      '3.8 L of water.',
      '10 pages of non-fiction a day.',
      'A progress photo.',
    ])
  })
})
