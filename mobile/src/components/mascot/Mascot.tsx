import { createRig, poseToTransforms, type DuckMood, type DuckReaction } from '@logic/duckRig'
import { useEffect, useState } from 'react'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { DuckArt } from './DuckArt'

export type { DuckMood, DuckReaction } from '@logic/duckRig'

const MOOD_LABELS: Record<DuckMood, string> = {
  content: 'The duck, satisfied',
  watching: 'The duck, watching you',
  tapping: 'The duck, tapping his knife',
  hunting: 'The duck, knife raised',
  celebrating: 'The duck, celebrating',
  triumphant: 'The duck, knife held high',
  judging: 'The duck, staring at you',
  waiting: 'The duck, waiting',
  sad: 'The duck, looking sad',
}

interface MascotProps {
  mood: DuckMood
  size?: number
  /** A one-off reaction; pass a new object (a new `id`) to trigger it again. */
  reaction?: { kind: DuckReaction; id: number }
  /** Hidden from assistive tech, for when nearby text already carries the message. */
  decorative?: boolean
}

/**
 * The companion: the knife-holding duck, animated by the same motion rig as in
 * the web app (src/logic/duckRig.ts). One frame loop per duck asks the rig for
 * the next pose. Under reduced motion he holds his mood's pose.
 *
 * ponytail: each frame goes through React state, which redraws the SVG. If the
 * phone drops frames, write the transforms natively instead. His eyes don't
 * follow touches yet (the web's useTouchGaze); that comes with Today.
 */
export function Mascot({ mood, size = 120, reaction, decorative = false }: MascotProps) {
  const reducedMotion = useReduceMotion()
  const [rig] = useState(() => createRig({ mood, reducedMotion }))
  const [pose, setPose] = useState(() => rig.step(0))

  useEffect(() => rig.setMood(mood), [rig, mood])
  useEffect(() => rig.setReducedMotion(reducedMotion), [rig, reducedMotion])
  useEffect(() => {
    if (reaction) rig.react(reaction.kind)
  }, [rig, reaction])

  useEffect(() => {
    let frame = 0
    let last: number | undefined
    const tick = (now: number) => {
      // A long pause (the app was in the background) must not become one giant step.
      const seconds = last === undefined ? 0 : Math.min((now - last) / 1000, 0.1)
      last = now
      setPose(rig.step(seconds))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [rig])

  return (
    <DuckArt
      size={size}
      transforms={poseToTransforms(pose)}
      opacities={pose}
      label={decorative ? undefined : MOOD_LABELS[mood]}
    />
  )
}
