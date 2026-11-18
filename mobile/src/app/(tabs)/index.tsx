import { CHALLENGE_LENGTH } from '@logic/constants'
import { dayNumberForDate } from '@logic/dates'
import { Placeholder, PlaceholderText } from '../../components/Placeholder'
import { challengeRepo } from '../../db/repositories/challengeRepo'
import { useLiveQuery } from '../../db/useLiveQuery'
import { useToday } from '../../hooks/useToday'

export default function TodayScreen() {
  // null: no challenge. undefined: still reading.
  const challenge = useLiveQuery(async () => (await challengeRepo.getCurrent()) ?? null, [])
  const today = useToday()
  return (
    <Placeholder title="Today">
      {challenge !== undefined && <PlaceholderText>{dayLine(challenge?.startDate, today)}</PlaceholderText>}
    </Placeholder>
  )
}

function dayLine(startDate: string | undefined, today: string): string {
  if (startDate === undefined) return 'No challenge yet'
  const day = dayNumberForDate(startDate, today)
  if (day < 1) return 'Not started yet'
  return `Day ${Math.min(day, CHALLENGE_LENGTH)} of ${CHALLENGE_LENGTH}`
}
