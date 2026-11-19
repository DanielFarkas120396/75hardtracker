import { useIsFocused } from 'expo-router'
import { useGate } from '../../hooks/useChallengeGate'
import { StatsScreen } from '../../stats/StatsScreen'
import { ScreenFocusContext } from '../../today/TaskBoard'
import { Centred } from '../../today/parts'

/** The Stats tab. Its drawings' loops rest while another tab is in front. */
export default function Stats() {
  const gate = useGate()
  const focused = useIsFocused()
  if (!gate) return <Centred>Loading…</Centred>
  return (
    <ScreenFocusContext.Provider value={focused}>
      <StatsScreen key={gate.challenge.id} gate={gate} />
    </ScreenFocusContext.Provider>
  )
}
