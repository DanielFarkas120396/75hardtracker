import { useGate } from '../../hooks/useChallengeGate'
import { JourneyScreen } from '../../journey/JourneyScreen'
import { Centred } from '../../today/parts'

export default function Journey() {
  const gate = useGate()
  if (!gate) return <Centred>Loading…</Centred>
  // Keyed by attempt: a new one starts with no rows measured and no card open.
  return <JourneyScreen key={gate.challenge.id} gate={gate} />
}
