import { CHALLENGE_LENGTH } from '@logic/constants'
import { dayNumberForDate, todayISO } from '@logic/dates'
import { Placeholder, PlaceholderText } from '../../components/Placeholder'
import { challengeRepo } from '../../db/repositories/challengeRepo'
import { useLiveQuery } from '../../db/useLiveQuery'

export default function TodayScreen() {
  // null: no challenge. undefined: still reading.
  const challenge = useLiveQuery(async () => (await challengeRepo.getCurrent()) ?? null, [])
  return <Placeholder title="Today">{challenge !== undefined && <PlaceholderText>{dayLine(challenge?.startDate)}</PlaceholderText>}</Placeholder>
}

function dayLine(startDate: string | undefined): string {
  if (startDate === undefined) return 'No challenge yet'
  const day = dayNumberForDate(startDate, todayISO())
  if (day < 1) return 'Not started yet'
  return `Day ${Math.min(day, CHALLENGE_LENGTH)} of ${CHALLENGE_LENGTH}`
}
