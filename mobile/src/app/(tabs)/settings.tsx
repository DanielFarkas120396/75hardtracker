import { useIsFocused } from 'expo-router'
import { useGate } from '../../hooks/useChallengeGate'
import { SettingsScreen } from '../../settings/SettingsScreen'
import { Centred } from '../../today/parts'

/** The Settings tab. */
export default function Settings() {
  const gate = useGate()
  const focused = useIsFocused()
  if (!gate) return <Centred>Loading…</Centred>
  return <SettingsScreen gate={gate} focused={focused} />
}
