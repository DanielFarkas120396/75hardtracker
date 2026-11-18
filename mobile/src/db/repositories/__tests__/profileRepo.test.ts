/** @jest-environment node */
// Ported from the web app's src/db/__tests__/repositories.test.ts ("the profile"): same cases.
import { addDaysISO } from '@logic/dates'
import { addChallenge, freshDatabase } from '../../__tests__/fixtures'
import { challengeRepo } from '../challengeRepo'
import { profileRepo } from '../profileRepo'

const today = '2026-03-10'
const now = new Date('2026-09-28T08:00:00.000Z')

beforeEach(freshDatabase)

it('is undefined until the welcome flow is done', async () => {
  expect(await profileRepo.get()).toBeUndefined()
})

it('completes the flow for a new player: attempt #1 with the chosen challenge and start, then the profile', async () => {
  const result = await profileRepo.completeOnboarding(
    { name: ' Daniel ', why: 'A fresh start' },
    { startDate: addDaysISO(today, 1), variant: 'medium' },
    now,
  )

  expect(result).toEqual({ ok: true })
  expect(await challengeRepo.getAll()).toMatchObject([
    { attemptNumber: 1, status: 'active', variant: 'medium', startDate: addDaysISO(today, 1) },
  ])
  expect(await profileRepo.get()).toEqual({ name: 'Daniel', why: 'A fresh start', onboardedAt: now.toISOString() })
})

it('never adds an attempt when one exists already, and never touches it', async () => {
  const challengeId = await addChallenge({ startDate: addDaysISO(today, -3), attemptNumber: 1, status: 'active' })
  const before = await challengeRepo.getById(challengeId)

  await profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' }, { startDate: today, variant: 'soft' }, now)

  expect(await challengeRepo.getAll()).toEqual([before])
})

it('saves only the profile for a returning player', async () => {
  const challengeId = await addChallenge({ startDate: addDaysISO(today, -3), attemptNumber: 1, status: 'active' })
  const before = await challengeRepo.getById(challengeId)

  await profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' }, undefined, now)

  expect(await challengeRepo.getAll()).toEqual([before])
  expect(await profileRepo.get()).toMatchObject({ name: 'Daniel', why: 'A fresh start' })
})

it('writes nothing when the name or the reason is unusable', async () => {
  const firstAttempt = { startDate: today, variant: 'hard' as const }
  expect(await profileRepo.completeOnboarding({ name: '  ', why: 'A fresh start' }, firstAttempt)).toEqual({
    ok: false,
    reason: 'invalid',
  })
  expect(await profileRepo.completeOnboarding({ name: 'Daniel', why: '' }, firstAttempt)).toEqual({
    ok: false,
    reason: 'invalid',
  })
  expect(await challengeRepo.getAll()).toHaveLength(0)
  expect(await profileRepo.get()).toBeUndefined()
})

it('creates one attempt even when the deal is signed twice at once', async () => {
  const sign = () => profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' }, { startDate: today, variant: 'hard' }, now)
  await Promise.all([sign(), sign()])
  expect(await challengeRepo.getAll()).toHaveLength(1)
})
