/** @jest-environment node */
import { CHALLENGE_LENGTH } from '@logic/constants'
import { addDaysISO } from '@logic/dates'
import { addChallenge, addPerfectDays, freshDatabase } from '../../__tests__/fixtures'
import { getDb } from '../../open'
import { allRows, getRow } from '../../table'
import { challengeRepo } from '../challengeRepo'

// The web's cases for how an attempt ends (src/db/__tests__/repositories.test.ts), same names.

const today = '2026-07-15'
const challenge = (id: number) => getRow(getDb(), 'challenges', id)
const challenges = (where = '') => allRows(getDb(), 'challenges', where)

beforeEach(freshDatabase)

describe('challengeRepo.restart', () => {
  it('archives the attempt and starts attempt max + 1', async () => {
    await addChallenge({ startDate: '2026-01-01', attemptNumber: 3, status: 'completed' })
    const failedId = await addChallenge({ startDate: '2026-06-01', attemptNumber: 4, status: 'active' })

    const newId = await challengeRepo.restart(failedId, today)

    expect(await challenge(failedId)).toMatchObject({ status: 'failed' })
    expect(await challenge(newId)).toMatchObject({ attemptNumber: 5, status: 'active', startDate: today })
  })

  it('never leaves two active challenges, even when tapped twice at once', async () => {
    const failedId = await addChallenge({ startDate: '2026-06-01', attemptNumber: 1, status: 'active' })

    const ids = await Promise.all([challengeRepo.restart(failedId, today), challengeRepo.restart(failedId, today)])

    expect(await challenges("WHERE status = 'active'")).toHaveLength(1)
    expect(ids[0]).toBe(ids[1])
    expect(await challenges()).toHaveLength(2)
  })

  it('restart keeps a Soft attempt Soft', async () => {
    const failedId = await addChallenge({ startDate: addDaysISO(today, -1), attemptNumber: 1, status: 'active', variant: 'soft' })
    const newId = await challengeRepo.restart(failedId, today)
    expect((await challenge(newId))?.variant).toBe('soft')
  })

  it('restart of a variant-less attempt starts Hard, leaving the old row without a variant key', async () => {
    const failedId = await addChallenge({ startDate: addDaysISO(today, -1), attemptNumber: 1, status: 'active' })
    const newId = await challengeRepo.restart(failedId, today)
    expect((await challenge(newId))?.variant).toBe('hard')
    expect(await challenge(failedId)).not.toHaveProperty('variant')
  })
})

describe('challengeRepo.markCompleted', () => {
  it('marks an active attempt completed, and leaves any other alone', async () => {
    const active = await addChallenge({ startDate: addDaysISO(today, -(CHALLENGE_LENGTH - 1)), attemptNumber: 2, status: 'active' })
    const failed = await addChallenge({ startDate: '2026-01-01', attemptNumber: 1, status: 'failed' })
    await challengeRepo.markCompleted(active)
    await challengeRepo.markCompleted(failed)
    expect((await challenge(active))?.status).toBe('completed')
    expect((await challenge(failed))?.status).toBe('failed')
    // Then attempt #3 starts, without a stray attempt.
    const next = await challengeRepo.startNew(today, 'hard')
    expect(await challenge(next)).toMatchObject({ attemptNumber: 3, status: 'active' })
    expect(await challenges()).toHaveLength(3)
  })
})

describe('giving up', () => {
  it('changes only the status and the give-up date, leaving a pre-variants attempt variant-less', async () => {
    const startDate = addDaysISO(today, -11)
    const challengeId = await addChallenge({ startDate, attemptNumber: 1, status: 'active' })
    await addPerfectDays(challengeId, startDate, 1, 11)
    const before = await challenge(challengeId)
    const entriesBefore = await allRows(getDb(), 'dayEntries', 'WHERE challengeId = ?', [challengeId])

    expect(await challengeRepo.giveUp(challengeId, today)).toEqual({ ok: true })

    expect(await challenge(challengeId)).toEqual({ ...before, status: 'abandoned', abandonedOn: today })
    expect(await challenge(challengeId)).not.toHaveProperty('variant')
    expect(await allRows(getDb(), 'dayEntries', 'WHERE challengeId = ?', [challengeId])).toEqual(entriesBefore)
  })

  it('works from Day 1 to Day 75', async () => {
    const dayOne = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active', variant: 'soft' })
    expect(await challengeRepo.giveUp(dayOne, today)).toEqual({ ok: true })

    const lastDay = await addChallenge({ startDate: addDaysISO(today, -(CHALLENGE_LENGTH - 1)), attemptNumber: 2, status: 'active' })
    expect(await challengeRepo.giveUp(lastDay, today)).toEqual({ ok: true })
  })

  it('is locked before Day 1 and after Day 75', async () => {
    const before = await addChallenge({ startDate: addDaysISO(today, 1), attemptNumber: 1, status: 'active' })
    expect(await challengeRepo.giveUp(before, today)).toEqual({ ok: false, reason: 'locked' })
    expect((await challenge(before))?.status).toBe('active')
    await freshDatabase()
    // Today is Day 76.
    const after = await addChallenge({ startDate: addDaysISO(today, -CHALLENGE_LENGTH), attemptNumber: 1, status: 'active' })
    expect(await challengeRepo.giveUp(after, today)).toEqual({ ok: false, reason: 'locked' })
    expect((await challenge(after))?.status).toBe('active')
  })

  it('is locked on an attempt that is no longer active, or that does not exist', async () => {
    const completed = await addChallenge({ startDate: addDaysISO(today, -3), attemptNumber: 1, status: 'completed' })
    expect(await challengeRepo.giveUp(completed, today)).toEqual({ ok: false, reason: 'locked' })
    expect((await challenge(completed))?.status).toBe('completed')
    expect(await challengeRepo.giveUp(completed + 1, today)).toEqual({ ok: false, reason: 'locked' })
  })

  it('stays the current attempt until startNew begins the next one, numbered after it', async () => {
    const givenUp = await addChallenge({ startDate: addDaysISO(today, -4), attemptNumber: 3, status: 'active' })
    await challengeRepo.giveUp(givenUp, today)
    expect(await challengeRepo.getCurrent()).toMatchObject({ id: givenUp, status: 'abandoned', abandonedOn: today })

    const nextId = await challengeRepo.startNew(addDaysISO(today, 1), 'medium')

    expect(await challenge(nextId)).toMatchObject({ attemptNumber: 4, status: 'active', variant: 'medium', startDate: addDaysISO(today, 1) })
    expect((await challengeRepo.getCurrent())?.id).toBe(nextId)
  })
})

describe('acknowledging jokers', () => {
  it('only grows, never shrinks', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active', variant: 'soft' })

    await challengeRepo.acknowledgeJokers(challengeId, 1)
    expect((await challenge(challengeId))?.jokersAcknowledged).toBe(1)

    await challengeRepo.acknowledgeJokers(challengeId, 0)
    expect((await challenge(challengeId))?.jokersAcknowledged).toBe(1)
  })
})
