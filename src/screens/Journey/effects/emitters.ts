import { MAP_WIDTH, worldBand } from '../layout'
import { WORLDS, type WorldId } from '../worlds'

/**
 * What each Journey world gives off — flames, sparks, ash, fireflies, leaves,
 * petals, snow, golden orbs — and how a single particle lives and moves.
 * Pure data and maths (no three.js), so it's testable without WebGL; the
 * renderer only draws what this describes. Units are the map's SVG units,
 * with y pointing down the map.
 */

/** How a particle is drawn by the renderer's shader. */
export type ParticleShape = 'glow' | 'flame' | 'leaf' | 'flake'

type Range = readonly [number, number]

export interface EmitterSpec {
  shape: ParticleShape
  /** Glowing light (added onto the scene) rather than a solid speck. Added light vanishes on pale worlds, so those use solid colour. */
  additive: boolean
  /** Particles alive at once in this world. */
  count: number
  colors: readonly string[]
  /** Diameter, in map units. */
  size: Range
  /** Seconds before the particle fades out and respawns. */
  life: Range
  vx: Range
  /** Negative rises, positive falls. */
  vy: Range
  /** Side-to-side drift amplitude (units per second). */
  sway: number
  /** Random walk strength, for things that wander like fireflies. */
  wander: number
  /** Maximum spin, in radians per second (leaves and petals). */
  spin: number
  /** Where particles appear across the map: along the scenery at the edges, or anywhere. */
  zone: 'edges' | 'anywhere'
  /** Peak opacity. */
  alpha: number
  /** Flickers in brightness and size, like a flame or a firefly. */
  flicker: boolean
}

const spec = (s: Partial<EmitterSpec> & Pick<EmitterSpec, 'shape' | 'count' | 'colors' | 'size' | 'life'>): EmitterSpec => ({
  additive: false,
  vx: [0, 0],
  vy: [0, 0],
  sway: 0,
  wander: 0,
  spin: 0,
  zone: 'anywhere',
  alpha: 1,
  flicker: false,
  ...s,
})

export const EMITTERS: Record<WorldId, readonly EmitterSpec[]> = {
  hell: [
    // Flames licking up from the lava along the edges.
    spec({ shape: 'flame', additive: true, count: 18, colors: ['#ff6a14', '#ffa024'], size: [28, 46], life: [0.6, 1.3], vx: [-3, 3], vy: [-20, -8], zone: 'edges', flicker: true }),
    // Sparks shooting up.
    spec({ shape: 'glow', additive: true, count: 50, colors: ['#ffd36b', '#ff8a2a'], size: [4.5, 8], life: [1.4, 3], vx: [-8, 8], vy: [-60, -24], sway: 6 }),
    // A slow, pulsing heat glow.
    spec({ shape: 'glow', additive: true, count: 6, colors: ['#ff4a1a'], size: [80, 130], life: [3, 5], vx: [-1, 1], vy: [-3, 3], zone: 'edges', alpha: 0.4 }),
  ],
  wasteland: [
    // Ash flakes drifting in the wind.
    spec({ shape: 'flake', count: 54, colors: ['#ece6e0', '#bdb4ac'], size: [3, 6], life: [5, 9], vx: [6, 16], vy: [-4, 6], sway: 10, alpha: 0.85 }),
    // Slow dust swirls.
    spec({ shape: 'glow', count: 6, colors: ['#d4cbc2'], size: [70, 120], life: [4, 7], vx: [4, 10], vy: [-2, 2], alpha: 0.22 }),
  ],
  forest: [
    // Fireflies wandering along the trees.
    spec({ shape: 'glow', additive: true, count: 30, colors: ['#e8ff8a', '#c6ff6a'], size: [8, 14], life: [3, 6], vx: [-4, 4], vy: [-4, 4], wander: 16, zone: 'edges', flicker: true }),
    // Pine needles and leaves falling.
    spec({ shape: 'leaf', count: 18, colors: ['#3f7a4a', '#6b8f3a', '#8a6a2f'], size: [8, 12], life: [5, 8], vx: [-6, 6], vy: [10, 22], sway: 12, spin: 2 }),
  ],
  meadow: [
    // Petals tumbling down.
    spec({ shape: 'leaf', count: 26, colors: ['#ff9fc4', '#fff3f8', '#ffd84a'], size: [7, 11], life: [5, 8], vx: [4, 14], vy: [8, 18], sway: 14, spin: 3 }),
    // A few green leaves.
    spec({ shape: 'leaf', count: 10, colors: ['#5aac4f', '#7cc264'], size: [9, 13], life: [5, 8], vx: [2, 10], vy: [10, 20], sway: 12, spin: 2.5 }),
    // Glowing pollen.
    spec({ shape: 'glow', count: 24, colors: ['#f2cf3a'], size: [5, 8], life: [3, 6], vx: [-3, 3], vy: [-3, 3], wander: 8, flicker: true, alpha: 0.9 }),
  ],
  mountains: [
    // Snowflakes of different sizes, swaying, with gusts (see GUST).
    spec({ shape: 'flake', count: 90, colors: ['#ffffff'], size: [3, 8], life: [6, 10], vx: [-4, 10], vy: [18, 34], sway: 10 }),
  ],
  heaven: [
    // Golden sparkles.
    spec({ shape: 'glow', count: 30, colors: ['#e0a81c', '#f3c23a'], size: [6, 10], life: [1.5, 3], vx: [-2, 2], vy: [-10, -4], flicker: true }),
    // Soft glowing orbs rising slowly.
    spec({ shape: 'glow', count: 12, colors: ['#f0bf3c'], size: [24, 40], life: [5, 8], vx: [-2, 2], vy: [-8, -3], sway: 6, alpha: 0.55 }),
  ],
}

/** Wind gusts on the mountains: a slow wave added to the snow's sideways speed. */
const GUST = { strength: 14, period: 7 }

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  size: number
  color: readonly [number, number, number]
  /** A random offset for this particle's sway and flicker, so neighbours don't move in step. */
  phase: number
  rotation: number
  spin: number
}

type Rand = () => number

const between = ([lo, hi]: Range, rand: Rand) => lo + (hi - lo) * rand()

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** The scenery strips along the left and right edges of the map. */
const EDGE_WIDTH = 72

/**
 * A new particle somewhere in its world. With `midLife`, it starts part-way
 * through its life, so a freshly shown world looks already busy rather than
 * everything fading in at once.
 */
export function spawnParticle(emitter: EmitterSpec, worldIndex: number, rand: Rand = Math.random, midLife = false): Particle {
  const { top, bottom } = worldBand(worldIndex)
  const x =
    emitter.zone === 'edges'
      ? rand() < 0.5
        ? rand() * EDGE_WIDTH
        : MAP_WIDTH - rand() * EDGE_WIDTH
      : rand() * MAP_WIDTH
  const life = between(emitter.life, rand)
  return {
    x,
    y: top + rand() * (bottom - top),
    vx: between(emitter.vx, rand),
    vy: between(emitter.vy, rand),
    age: midLife ? rand() * life : 0,
    life,
    size: between(emitter.size, rand),
    color: hexToRgb(emitter.colors[Math.floor(rand() * emitter.colors.length)]),
    phase: rand() * Math.PI * 2,
    rotation: rand() * Math.PI * 2,
    spin: (rand() * 2 - 1) * emitter.spin,
  }
}

/**
 * Moves a particle on by `dt` seconds (`time` is the clock, for sway and
 * gusts). Returns false once it has lived out its life and should respawn.
 */
export function stepParticle(p: Particle, emitter: EmitterSpec, worldId: WorldId, dt: number, time: number, rand: Rand = Math.random): boolean {
  p.age += dt
  if (p.age >= p.life) return false

  if (emitter.wander > 0) {
    p.vx += (rand() * 2 - 1) * emitter.wander * dt
    p.vy += (rand() * 2 - 1) * emitter.wander * dt
    // Keep wanderers slow.
    p.vx *= 1 - 0.8 * dt
    p.vy *= 1 - 0.8 * dt
  }
  const gust = worldId === 'mountains' ? GUST.strength * Math.max(0, Math.sin((time / GUST.period) * Math.PI * 2)) : 0
  const sway = emitter.sway * Math.sin(time * 1.3 + p.phase)

  p.x += (p.vx + sway + gust) * dt
  p.y += p.vy * dt
  p.rotation += p.spin * dt

  // Drifting off one side brings it back in on the other.
  if (p.x < -20) p.x += MAP_WIDTH + 40
  else if (p.x > MAP_WIDTH + 20) p.x -= MAP_WIDTH + 40
  return true
}

/** How visible a particle is now: it fades in, holds, fades out, and flickers if its emitter does. */
export function particleAlpha(p: Particle, emitter: EmitterSpec, time: number): number {
  const t = p.age / p.life
  const fade = Math.min(1, t / 0.2, (1 - t) / 0.3)
  const flicker = emitter.flicker ? 0.65 + 0.35 * Math.sin(time * 9 + p.phase * 3) : 1
  return Math.max(0, fade) * flicker * emitter.alpha
}

/** The worlds that overlap the stretch of map between `viewTop` and `viewBottom` (map units). */
export function visibleWorlds(viewTop: number, viewBottom: number): number[] {
  return WORLDS.flatMap((_, i) => {
    const { top, bottom } = worldBand(i)
    return bottom >= viewTop && top <= viewBottom ? [i] : []
  })
}
