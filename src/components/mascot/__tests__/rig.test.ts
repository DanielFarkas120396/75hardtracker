import { describe, expect, it } from 'vitest'
import {
  createRig,
  MOOD_POSES,
  poseToTransforms,
  registerPoke,
  tapAngle,
  TOSS_PERIOD,
  tossAt,
  type DuckMood,
  type Rig,
  type RigPose,
} from '../rig'

const FRAME = 1 / 60

/** A deterministic stand-in for Math.random. */
function seeded(): () => number {
  let state = 1
  return () => {
    state = (state * 16807) % 2147483647
    return state / 2147483647
  }
}

function run(rig: Rig, seconds: number): RigPose {
  let pose = rig.step(FRAME)
  for (let i = 1; i < Math.round(seconds / FRAME); i++) pose = rig.step(FRAME)
  return pose
}

/** Smallest difference between two angles, in degrees. */
const angleGap = (a: number, b: number) => Math.abs((((a - b) % 360) + 540) % 360 - 180)

describe('tapAngle', () => {
  it('lifts, strikes and settles without jumps', () => {
    expect(tapAngle(0)).toBeCloseTo(0)
    expect(tapAngle(0.72 - 1e-9)).toBeCloseTo(tapAngle(0.72), 5)
    expect(tapAngle(0.72)).toBeCloseTo(-12)
    expect(tapAngle(0.8 - 1e-9)).toBeCloseTo(tapAngle(0.8), 5)
    expect(tapAngle(0.8)).toBeCloseTo(3)
    expect(tapAngle(1 - 1e-9)).toBeCloseTo(0, 5)
  })
})

describe('tossAt', () => {
  it('is continuous at every phase join', () => {
    for (const s of [0.25, 0.4, 1.1, 1.6]) {
      const before = tossAt(s - 1e-9)
      const after = tossAt(s)
      expect(before.arm).toBeCloseTo(after.arm, 5)
      expect(before.lift).toBeCloseTo(after.lift, 5)
      expect(angleGap(before.spin, after.spin)).toBeCloseTo(0, 3)
    }
  })

  it('only lifts the knife while it is in the air', () => {
    expect(tossAt(0.2).lift).toBe(0)
    expect(tossAt(0.75).lift).toBeGreaterThan(100)
    expect(tossAt(2).lift).toBe(0)
  })
})

describe('createRig', () => {
  const HELD: DuckMood[] = ['content', 'watching', 'tapping', 'hunting', 'triumphant', 'judging', 'waiting', 'sad']

  it.each(HELD)('keeps the knife in the hand while %s', (mood) => {
    const rig = createRig({ mood, random: seeded() })
    for (let i = 0; i < 600; i++) expect(rig.step(FRAME).knifeOffset).toEqual([0, 0])
  })

  it('throws and catches the knife while celebrating, without jumps', () => {
    const rig = createRig({ mood: 'celebrating', random: seeded() })
    let previous = rig.step(FRAME)
    let flew = false
    for (let i = 0; i < Math.round((2 * TOSS_PERIOD) / FRAME); i++) {
      const pose = rig.step(FRAME)
      const jump = Math.hypot(
        pose.knifeOffset[0] - previous.knifeOffset[0],
        pose.knifeOffset[1] - previous.knifeOffset[1],
      )
      expect(jump).toBeLessThan(25)
      if (Math.hypot(...pose.knifeOffset) > 100) flew = true
      previous = pose
    }
    expect(flew).toBe(true)
  })

  it('settles on the pose of a new mood', () => {
    const rig = createRig({ mood: 'watching', random: seeded() })
    rig.setMood('hunting')
    const pose = run(rig, 3)
    expect(pose.arm).toBeGreaterThan(-27.5)
    expect(pose.arm).toBeLessThan(-24.5)
    expect(pose.knife).toBeCloseTo(26, 0)
    expect(pose.browsOpacity).toBeCloseTo(1, 1)
  })

  it('crossfades to happy eyes instead of swapping them', () => {
    const rig = createRig({ mood: 'watching', random: seeded() })
    rig.setMood('content')
    const first = rig.step(FRAME)
    expect(first.happyOpacity).toBeGreaterThan(0)
    expect(first.happyOpacity).toBeLessThan(0.1)
    const settled = run(rig, 2)
    expect(settled.happyOpacity).toBeCloseTo(1, 2)
    expect(settled.eyesOpacity).toBeCloseTo(0, 2)
  })

  it('holds a still pose under reduced motion, and ignores reactions', () => {
    const rig = createRig({ mood: 'hunting', reducedMotion: true, random: seeded() })
    const still = rig.step(FRAME)
    rig.react('lunge')
    rig.react('poke')
    rig.touch({ x: 0, y: 0 })
    expect(run(rig, 2)).toEqual(still)
    expect(still.arm).toBe(MOOD_POSES.hunting.arm)
    expect(still.knife).toBe(MOOD_POSES.hunting.knife)
    expect(Math.abs(still.hop)).toBe(0)
    expect(Math.abs(still.shake)).toBe(0)
  })

  it('looks where a finger touches, then looks around again', () => {
    const rig = createRig({ mood: 'watching', random: seeded() })
    run(rig, 0.5)
    rig.touch({ x: 480, y: 175 })
    expect(run(rig, 0.5).gazeX).toBeGreaterThan(8)
    expect(run(rig, 5).gazeX).toBeLessThan(9)
  })

  it('lunges: winds the knife up overhead, then strikes back down', () => {
    const rig = createRig({ mood: 'watching', random: seeded() })
    run(rig, 1)
    rig.react('lunge')
    const windUp = run(rig, 0.3)
    expect(windUp.arm).toBeLessThan(-40)
    expect(windUp.scaleY).toBeGreaterThan(1.15)
    expect(Math.abs(run(rig, 2.5).arm)).toBeLessThan(0.5)
  })
})

describe('poseToTransforms', () => {
  it('turns the arm about the shoulder and the knife about the grip', () => {
    const rig = createRig({ mood: 'hunting', reducedMotion: true })
    const transforms = poseToTransforms(rig.step(0))
    expect(transforms.leftWing).toBe('rotate(-26 51 195)')
    expect(transforms.knife).toBe('translate(0 0) rotate(26 100 332)')
  })
})

describe('registerPoke', () => {
  it('turns the third poke within 1.8 s into a lunge', () => {
    let result = registerPoke([], 0)
    expect(result.kind).toBe('poke')
    result = registerPoke(result.recent, 500)
    expect(result.kind).toBe('poke')
    result = registerPoke(result.recent, 1000)
    expect(result.kind).toBe('lunge')
    expect(registerPoke(result.recent, 1100).kind).toBe('poke')
  })

  it('forgets pokes older than the window', () => {
    let result = registerPoke([], 0)
    result = registerPoke(result.recent, 1000)
    expect(registerPoke(result.recent, 2500).kind).toBe('poke')
  })
})
