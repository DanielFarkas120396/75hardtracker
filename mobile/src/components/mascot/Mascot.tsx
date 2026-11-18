import { createRig, poseToTransforms, type DuckMood, type DuckReaction } from '@logic/duckRig'
import { useEffect, useRef, useState, type ComponentRef } from 'react'
import { View } from 'react-native'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { DuckArt } from './DuckArt'
import { artPoint, gaze } from './gaze'

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
 * phone drops frames, write the transforms natively instead.
 *
 * His eyes follow a finger and glance down when the page scrolls, on the
 * screens that tell `gaze` about their touches.
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

  // A touch arrives as a point of the window; the rig wants it in the art's own units.
  const box = useRef<ComponentRef<typeof View>>(null)
  useEffect(
    () =>
      gaze.watch({
        touch: (pageX, pageY) =>
          box.current?.measureInWindow((left, top, width, height) => {
            if (width > 0 && height > 0) rig.touch(artPoint(pageX, pageY, { left, top, width, height }))
          }),
        scrolled: () => rig.scrolled(),
      }),
    [rig],
  )

  return (
    // The drawing's own size, wherever he stands: a box stretched by its parent would move his eyes off the finger.
    <View ref={box} collapsable={false} style={{ width: size, height: (size * 500) / 490 }}>
      <DuckArt size={size} transforms={poseToTransforms(pose)} opacities={pose} label={decorative ? undefined : MOOD_LABELS[mood]} />
    </View>
  )
}
