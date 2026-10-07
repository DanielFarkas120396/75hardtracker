import { CHALLENGE_LENGTH } from '../logic/constants'
import type { ChallengeVariant, Ruleset } from '../logic/rulesets'

/** Each challenge's display name. */
export const VARIANT_NAMES: Record<ChallengeVariant, string> = {
  hard: '75 Hard',
  strong: '75 Strong',
  medium: '75 Medium',
  soft: '75 Soft',
}

/** One line per challenge for the variant picker. */
export const VARIANT_SUMMARIES: Record<ChallengeVariant, string> = {
  hard: 'Two 45-min workouts (one outdoors), strict diet, no alcohol, 3.8 L of water, 10 pages of non-fiction, a photo. Miss a day: back to Day 1.',
  strong: 'Everything in 75 Hard, plus one social occasion a week, declared the day before.',
  medium: 'One 45-min workout, eat healthy, 3 L of water, 10 pages of any book, a photo. One social occasion a week. One joker.',
  soft: 'Like 75 Medium, plus a recovery day a week. Three jokers.',
}

/** Each challenge in a few words, for the variant picker. */
export const VARIANT_TAGLINES: Record<ChallengeVariant, string> = {
  hard: 'The original. No mercy.',
  strong: 'Hard, with one social night a week.',
  medium: 'One workout, healthy eating.',
  soft: 'A gentler start, with a recovery day.',
}

/** What a joker is, shown on a selected challenge that has some. */
export const JOKER_DEFINITION = 'A joker forgives one missed day.'

const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four'] as const

/** "Day 1" with a no-break space, so the "1" never sits alone on the next line. */
const DAY_ONE = 'Day 1'

/** The 3 things that set a challenge apart, the same 3 on every card: workouts, the weekly allowance, the jokers. */
export function variantHighlights(rules: Ruleset): string[] {
  const workouts = rules.requiredWorkouts === 1 ? '1 workout a day' : `${rules.requiredWorkouts} workouts a day`
  const week =
    rules.socialDaysPerWeek > 0 && rules.restDaysPerWeek > 0
      ? 'Social + recovery weekly'
      : rules.socialDaysPerWeek > 0
        ? 'Social night weekly'
        : rules.restDaysPerWeek > 0
          ? 'Recovery day weekly'
          : 'No days off'
  const jokers = rules.jokers === 0 ? 'No jokers' : rules.jokers === 1 ? '1 joker' : `${rules.jokers} jokers`
  return [workouts, week, jokers]
}

/** What a missed day costs, for the deal: "Miss a day: back to Day 1." or the jokers first. */
export function stakesLine(rules: Ruleset): string {
  if (rules.jokers === 0) return `Miss a day: back to ${DAY_ONE}.`
  const jokers = `${COUNT_WORDS[rules.jokers]} ${rules.jokers === 1 ? 'joker' : 'jokers'}`
  const days = rules.jokers === 1 ? 'one missed day' : `${COUNT_WORDS[rules.jokers].toLowerCase()} missed days`
  return `${jokers}: ${days} forgiven. Miss one more: back to ${DAY_ONE}.`
}

/** The daily rules, one short line each, for the deal. */
export function dailyRuleLines(rules: Ruleset): string[] {
  return [
    workoutRuleLine(rules),
    dietRuleLine(rules),
    `${formatLiters(rules.waterTargetMl)} L of water.`,
    readingRuleLine(rules),
    'A progress photo.',
  ]
}

/** Litres for display, up to two decimals and no trailing zeros: 3800 → "3.8", 3000 → "3", 750 → "0.75". */
export function formatLiters(ml: number): string {
  return String(Number((ml / 1000).toFixed(2)))
}

export function workoutRuleLine(rules: Ruleset): string {
  const sessions = rules.requiredWorkouts === 1 ? '1 session' : `${rules.requiredWorkouts} sessions`
  const outdoors = rules.requireOutdoor ? ', one of them outdoors.' : '.'
  const recovery = rules.restDaysPerWeek > 0 ? ' One recovery day a week.' : ''
  return `${sessions} of at least ${rules.minWorkoutMin} minutes${outdoors}${recovery}`
}

export function dietRuleLine(rules: Ruleset): string {
  if (rules.dietKind === 'healthy') return 'Eat healthy. No alcohol, except on one declared social occasion a week.'
  return rules.socialDaysPerWeek > 0
    ? 'No cheat meals. No alcohol, except on one declared social occasion a week.'
    : 'No cheat meals, no alcohol.'
}

export function dietToggleLabel(rules: Ruleset): string {
  return rules.dietKind === 'healthy' ? 'I ate healthy' : 'I followed my diet'
}

export function readingRuleLine(rules: Ruleset): string {
  return `${rules.pagesTarget} pages of ${rules.readingKind === 'non-fiction' ? 'non-fiction' : 'any book'} a day.`
}

const MISS_ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth'] as const
const JOKER_WORDS = ['no', 'one', 'two', 'three', 'four'] as const

export function missedDayExplanation(rules: Ruleset, attemptNumber: number): string {
  const name = VARIANT_NAMES[rules.variant]
  const saved = `this attempt (#${attemptNumber}) ends here — but every photo and stat you logged is saved for good.`
  if (rules.jokers === 0) return `${name} is all-or-nothing on every task, every day. ${saved[0].toUpperCase()}${saved.slice(1)}`
  const forgives = `${JOKER_WORDS[rules.jokers]} missed ${rules.jokers === 1 ? 'day' : 'days'}`
  return `${name} forgives ${forgives}. This was your ${MISS_ORDINALS[rules.jokers]}, so ${saved}`
}

export function victoryTitle(rules: Ruleset): string {
  return `${VARIANT_NAMES[rules.variant]} complete! 🏆`
}

export function victoryLine(rules: Ruleset): string {
  return rules.requiredWorkouts === 2
    ? `${CHALLENGE_LENGTH} days. Two workouts, the diet, the water, the reading and the photo — every single day. That's done now, and it's yours.`
    : `${CHALLENGE_LENGTH} days. The workout, the diet, the water, the reading and the photo. That's done now, and it's yours.`
}

export function preStartPlanLine(rules: Ruleset): string {
  return rules.requiredWorkouts === 2 ? 'plan two workouts a day' : 'plan a workout a day'
}
