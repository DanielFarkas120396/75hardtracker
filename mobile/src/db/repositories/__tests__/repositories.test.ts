/** @jest-environment node */
// Ported from the web app's src/db/__tests__/repositories.test.ts: same cases, same names.
import { SETTING_KEYS } from '@logic/settingKeys'
import { addChallenge, freshDatabase } from '../../__tests__/fixtures'
import { challengeRepo } from '../challengeRepo'
import { settingsRepo } from '../settingsRepo'

const today = '2026-03-10'
const PROFILE = { name: 'Daniel', why: 'A fresh start', onboardedAt: '2026-09-28T08:00:00.000Z' }

beforeEach(freshDatabase)

describe('settingsRepo', () => {
  it('a setting keeps its type', async () => {
    await settingsRepo.set(SETTING_KEYS.bedtime, '22:30')
    await settingsRepo.set(SETTING_KEYS.soundEnabled, false)
    await settingsRepo.set(SETTING_KEYS.profile, PROFILE)
    expect(await settingsRepo.get(SETTING_KEYS.bedtime, '23:00')).toBe('22:30')
    expect(await settingsRepo.get(SETTING_KEYS.soundEnabled, true)).toBe(false)
    expect(await settingsRepo.get(SETTING_KEYS.profile, null)).toEqual(PROFILE)
  })

  it('gives the default for a setting that was never saved', async () => {
    expect(await settingsRepo.get('missing', 7)).toBe(7)
  })

  it('keeps the last value saved', async () => {
    await settingsRepo.set(SETTING_KEYS.bedtime, '22:30')
    await settingsRepo.set(SETTING_KEYS.bedtime, '21:00')
    expect(await settingsRepo.get(SETTING_KEYS.bedtime, '23:00')).toBe('21:00')
  })
})

describe('challengeRepo.bootstrapIfEmpty', () => {
  it('creates attempt #1 once, even when called concurrently', async () => {
    await settingsRepo.set(SETTING_KEYS.profile, PROFILE)
    await Promise.all([
      challengeRepo.bootstrapIfEmpty(today),
      challengeRepo.bootstrapIfEmpty(today),
      challengeRepo.bootstrapIfEmpty(today),
    ])
    const challenges = await challengeRepo.getAll()
    expect(challenges).toHaveLength(1)
    expect(challenges[0]).toMatchObject({ attemptNumber: 1, status: 'active', startDate: today, variant: 'hard' })
  })

  it('does nothing when any challenge exists — even a completed one', async () => {
    await addChallenge({ startDate: '2026-01-01', attemptNumber: 1, status: 'completed' })
    await settingsRepo.set(SETTING_KEYS.profile, PROFILE)
    await challengeRepo.bootstrapIfEmpty(today)
    expect(await challengeRepo.getAll()).toHaveLength(1)
  })

  it('does nothing without a profile: the welcome flow creates attempt #1 itself', async () => {
    await challengeRepo.bootstrapIfEmpty(today)
    expect(await challengeRepo.getAll()).toHaveLength(0)
  })
})

describe('challengeRepo.startNew', () => {
  it('starts attempt max + 1 with the chosen challenge', async () => {
    await addChallenge({ startDate: '2026-01-01', attemptNumber: 3, status: 'completed' })
    const id = await challengeRepo.startNew(today, 'soft')
    expect(await challengeRepo.getById(id)).toStrictEqual({
      id,
      startDate: today,
      attemptNumber: 4,
      status: 'active',
      variant: 'soft',
    })
  })

  it('never leaves two active challenges, even when tapped twice at once', async () => {
    const ids = await Promise.all([challengeRepo.startNew(today, 'hard'), challengeRepo.startNew(today, 'hard')])
    expect(ids[0]).toBe(ids[1])
    expect(await challengeRepo.getAll()).toHaveLength(1)
  })
})

describe('challengeRepo reads', () => {
  it('finds nothing in an empty database', async () => {
    expect(await challengeRepo.getActiveChallenge()).toBeUndefined()
    expect(await challengeRepo.getCurrent()).toBeUndefined()
    expect(await challengeRepo.getById(1)).toBeUndefined()
    expect(await challengeRepo.getAll()).toEqual([])
  })

  it('the current challenge is the active one', async () => {
    await addChallenge({ startDate: '2026-01-01', attemptNumber: 1, status: 'failed' })
    const active = await addChallenge({ startDate: '2026-02-01', attemptNumber: 2, status: 'active' })
    expect((await challengeRepo.getActiveChallenge())?.id).toBe(active)
    expect((await challengeRepo.getCurrent())?.id).toBe(active)
  })

  it('with none active, the current challenge is the most recent attempt', async () => {
    const latest = await addChallenge({ startDate: '2026-02-01', attemptNumber: 2, status: 'completed' })
    await addChallenge({ startDate: '2026-01-01', attemptNumber: 1, status: 'failed' })
    expect(await challengeRepo.getActiveChallenge()).toBeUndefined()
    expect((await challengeRepo.getCurrent())?.id).toBe(latest)
  })

  it('lists every attempt, oldest first', async () => {
    await addChallenge({ startDate: '2026-02-01', attemptNumber: 2, status: 'active' })
    await addChallenge({ startDate: '2026-01-01', attemptNumber: 1, status: 'failed' })
    expect((await challengeRepo.getAll()).map((challenge) => challenge.attemptNumber)).toEqual([1, 2])
  })
})
