import { useAnimationFrame, useReducedMotionConfig } from 'framer-motion'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { DuckArt } from './duckArt'
import { createRig, poseToTransforms, type DuckMood, type DuckReaction, type Rig, type RigPose } from './rig'
import { useTouchGaze } from './useTouchGaze'

export type { DuckMood, DuckReaction } from './rig'

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

const PART_NAMES = [
  'whole',
  'body',
  'left-wing',
  'knife',
  'right-wing',
  'eyes',
  'eye-left',
  'eye-right',
  'happy',
  'brows',
  'brow-left',
  'brow-right',
  'glint',
  'sweat',
] as const

type Parts = Record<(typeof PART_NAMES)[number], SVGElement>

function collectParts(svg: SVGSVGElement): Parts {
  const parts: Partial<Parts> = {}
  for (const name of PART_NAMES) {
    const element = svg.querySelector<SVGElement>(`[data-part="${name}"]`)
    if (element) parts[name] = element
  }
  return parts as Parts
}

/** Writes one pose into the SVG: attributes only, so React never re-renders per frame. */
function draw(parts: Parts, pose: RigPose): void {
  const t = poseToTransforms(pose)
  parts.whole.setAttribute('transform', t.whole)
  parts.body.setAttribute('transform', t.body)
  parts['left-wing'].setAttribute('transform', t.leftWing)
  parts.knife.setAttribute('transform', t.knife)
  parts['right-wing'].setAttribute('transform', t.rightWing)
  parts['eye-left'].setAttribute('transform', t.eyeL)
  parts['eye-right'].setAttribute('transform', t.eyeR)
  parts.eyes.setAttribute('opacity', pose.eyesOpacity.toFixed(3))
  parts.happy.setAttribute('opacity', pose.happyOpacity.toFixed(3))
  parts.happy.setAttribute('transform', t.happy)
  parts.brows.setAttribute('opacity', pose.browsOpacity.toFixed(3))
  parts.brows.setAttribute('transform', t.brows)
  parts['brow-left'].setAttribute('transform', t.browL)
  parts['brow-right'].setAttribute('transform', t.browR)
  parts.glint.setAttribute('transform', t.glint)
  parts.sweat.setAttribute('opacity', pose.sweatOpacity.toFixed(3))
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
 * The companion: the knife-holding duck, animated by the motion rig in
 * rig.ts. One frame loop per duck writes SVG attributes directly (the most
 * reliable transform path on WebKit). Under reduced motion he holds his
 * mood's pose.
 */
export function Mascot({ mood, size = 120, reaction, decorative = false }: MascotProps) {
  const reducedMotion = useReducedMotionConfig() ?? false
  const svgRef = useRef<SVGSVGElement>(null)
  const partsRef = useRef<Parts | null>(null)
  const rigRef = useRef<Rig | null>(null)
  if (rigRef.current === null) rigRef.current = createRig({ mood, reducedMotion })

  useLayoutEffect(() => {
    if (!svgRef.current || !rigRef.current) return
    partsRef.current = collectParts(svgRef.current)
    draw(partsRef.current, rigRef.current.step(0))
  }, [])

  useEffect(() => {
    rigRef.current?.setMood(mood)
  }, [mood])

  useEffect(() => {
    rigRef.current?.setReducedMotion(reducedMotion)
  }, [reducedMotion])

  useEffect(() => {
    if (reaction) rigRef.current?.react(reaction.kind)
  }, [reaction])

  useTouchGaze(svgRef, rigRef)

  useAnimationFrame((_, delta) => {
    if (partsRef.current && rigRef.current) draw(partsRef.current, rigRef.current.step(delta / 1000))
  })

  return <DuckArt ref={svgRef} size={size} label={decorative ? undefined : MOOD_LABELS[mood]} />
}
