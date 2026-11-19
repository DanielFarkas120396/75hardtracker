import { addDaysISO, todayISO } from '@logic/dates'
import type { ChallengeGate } from '@logic/challengeGate'
import { render, waitFor } from '@testing-library/react-native'
import { addChallenge, addPerfectDays, freshDatabase } from '../../db/__tests__/fixtures'
import { challengeRepo } from '../../db/repositories/challengeRepo'
import { GateProvider, useGate } from '../useChallengeGate'

beforeEach(freshDatabase)
afterEach(() => jest.restoreAllMocks())

it('gives every reader under one provider the same gate, and marks a finished attempt completed once', async () => {
  const start = addDaysISO(todayISO(), -75)
  const id = await addChallenge({ startDate: start, attemptNumber: 1, status: 'active', variant: 'hard' })
  await addPerfectDays(id, start, 1, 75)
  const markCompleted = jest.spyOn(challengeRepo, 'markCompleted')
  const seen: Record<string, ChallengeGate | null | undefined> = {}
  const Reader = ({ name }: { name: string }) => {
    seen[name] = useGate()
    return null
  }

  await render(
    <GateProvider>
      <Reader name="today" />
      <Reader name="journey" />
    </GateProvider>,
  )

  await waitFor(() => expect(seen.today?.kind).toBe('completed'))
  expect(seen.journey).toBe(seen.today)
  await waitFor(() => expect(markCompleted).toHaveBeenCalledTimes(1))
})

it('asks for its provider', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  const Reader = () => {
    useGate()
    return null
  }
  await expect(render(<Reader />)).rejects.toThrow('useGate needs a GateProvider')
})
