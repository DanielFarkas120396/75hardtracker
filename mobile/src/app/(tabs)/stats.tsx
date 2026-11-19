import { useGate } from '../../hooks/useChallengeGate'
import { StatsScreen } from '../../stats/StatsScreen'
import { Centred } from '../../today/parts'

export default function Stats() {
  const gate = useGate()
  if (!gate) return <Centred>Loading…</Centred>
  return <StatsScreen key={gate.challenge.id} gate={gate} />
}
