import { act, render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { challengeRepo } from '../repositories/challengeRepo'
import { useLiveQuery } from '../useLiveQuery'
import { freshDatabase } from './fixtures'

function AttemptCount() {
  const challenges = useLiveQuery(() => challengeRepo.getAll(), [])
  return <Text>{challenges === undefined ? 'reading' : `${challenges.length} attempts`}</Text>
}

beforeEach(freshDatabase)

it('gives undefined until the first read is back', async () => {
  await render(<AttemptCount />)
  expect(await screen.findByText('0 attempts')).toBeOnTheScreen()
})

it('rereads when the database changes', async () => {
  await render(<AttemptCount />)
  expect(await screen.findByText('0 attempts')).toBeOnTheScreen()
  await act(async () => {
    await challengeRepo.startNew('2026-01-01', 'hard')
  })
  expect(await screen.findByText('1 attempts')).toBeOnTheScreen()
})

it('stops listening once the screen is gone', async () => {
  const query = jest.fn(() => challengeRepo.getAll())
  function Watcher() {
    useLiveQuery(query, [])
    return null
  }
  const view = await render(<Watcher />)
  await act(async () => {})
  await view.unmount()
  const calls = query.mock.calls.length
  await challengeRepo.startNew('2026-01-01', 'hard')
  expect(query).toHaveBeenCalledTimes(calls)
})
