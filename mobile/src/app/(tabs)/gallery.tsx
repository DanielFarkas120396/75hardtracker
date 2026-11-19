import { GalleryScreen } from '../../gallery/GalleryScreen'
import { useGate } from '../../hooks/useChallengeGate'
import { Centred } from '../../today/parts'

export default function Gallery() {
  const gate = useGate()
  if (!gate) return <Centred>Loading…</Centred>
  // Keyed by attempt: a new one opens with nothing shown over it.
  return <GalleryScreen key={gate.challenge.id} gate={gate} />
}
