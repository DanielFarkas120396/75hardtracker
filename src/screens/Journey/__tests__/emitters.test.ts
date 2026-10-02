import { describe, expect, it } from 'vitest'
import { EMITTERS, particleAlpha, spawnParticle, stepParticle, visibleWorlds } from '../effects/emitters'
import { MAP_HEIGHT, MAP_WIDTH, worldBand } from '../layout'
import { WORLDS } from '../worlds'

/** A repeatable pseudo-random sequence. */
function seededRand(seed = 1) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

describe('EMITTERS', () => {
  it('gives every world its effects, within a particle budget the phone can carry', () => {
    for (const world of WORLDS) {
      const emitters = EMITTERS[world.id]
      expect(emitters.length).toBeGreaterThan(0)
      expect(emitters.reduce((n, e) => n + e.count, 0)).toBeLessThanOrEqual(120)
    }
  })

  it('makes hell burn and the mountains snow', () => {
    expect(EMITTERS.hell.map((e) => e.shape)).toContain('flame')
    expect(EMITTERS.mountains.every((e) => e.shape === 'flake' && e.vy[0] > 0)).toBe(true)
  })
})

describe('spawnParticle', () => {
  it('places a particle inside its world, and edge effects along the scenery', () => {
    const rand = seededRand(7)
    WORLDS.forEach((world, i) => {
      const { top, bottom } = worldBand(i)
      for (const emitter of EMITTERS[world.id]) {
        for (let n = 0; n < 50; n++) {
          const p = spawnParticle(emitter, i, rand)
          expect(p.y).toBeGreaterThanOrEqual(top)
          expect(p.y).toBeLessThanOrEqual(bottom)
          expect(p.x).toBeGreaterThanOrEqual(0)
          expect(p.x).toBeLessThanOrEqual(MAP_WIDTH)
          if (emitter.zone === 'edges') expect(p.x < 80 || p.x > MAP_WIDTH - 80).toBe(true)
        }
      }
    })
  })

  it('can start part-way through its life, so a world appears already busy', () => {
    const p = spawnParticle(EMITTERS.hell[1], 0, () => 0.5, true)
    expect(p.age).toBeGreaterThan(0)
    expect(p.age).toBeLessThan(p.life)
  })
})

describe('stepParticle', () => {
  it('moves sparks up and snow down, then ends the particle when its life is over', () => {
    const spark = spawnParticle(EMITTERS.hell[1], 0, seededRand(3))
    const sparkY = spark.y
    expect(stepParticle(spark, EMITTERS.hell[1], 'hell', 0.1, 0)).toBe(true)
    expect(spark.y).toBeLessThan(sparkY)

    const snow = spawnParticle(EMITTERS.mountains[0], 4, seededRand(4))
    const snowY = snow.y
    stepParticle(snow, EMITTERS.mountains[0], 'mountains', 0.1, 0)
    expect(snow.y).toBeGreaterThan(snowY)

    snow.age = snow.life - 0.01
    expect(stepParticle(snow, EMITTERS.mountains[0], 'mountains', 0.1, 0)).toBe(false)
  })

  it('wraps particles that drift off one side back in on the other', () => {
    const ash = spawnParticle(EMITTERS.wasteland[0], 1, seededRand(5))
    ash.x = MAP_WIDTH + 19.9
    ash.vx = 50
    stepParticle(ash, EMITTERS.wasteland[0], 'wasteland', 0.1, 0)
    expect(ash.x).toBeLessThan(0)
  })
})

describe('particleAlpha', () => {
  it('fades in and out, and never goes past the emitter peak', () => {
    const emitter = EMITTERS.heaven[1]
    const p = spawnParticle(emitter, 5, seededRand(6))
    p.age = 0
    expect(particleAlpha(p, emitter, 0)).toBe(0)
    p.age = p.life * 0.5
    expect(particleAlpha(p, emitter, 0)).toBeCloseTo(emitter.alpha)
    p.age = p.life * 0.99
    expect(particleAlpha(p, emitter, 0)).toBeLessThan(0.1)
  })
})

describe('visibleWorlds', () => {
  it('finds the worlds on screen, so only those are animated', () => {
    expect(visibleWorlds(MAP_HEIGHT - 400, MAP_HEIGHT)).toEqual([0])
    expect(visibleWorlds(0, 300)).toEqual([WORLDS.length - 1])
    const border = worldBand(1).bottom
    expect(visibleWorlds(border - 100, border + 100)).toEqual([0, 1])
  })
})
