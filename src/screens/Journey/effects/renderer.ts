import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  NormalBlending,
  OrthographicCamera,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from 'three'
import { MAP_WIDTH } from '../layout'
import { WORLDS } from '../worlds'
import { EMITTERS, particleAlpha, spawnParticle, stepParticle, visibleWorlds, type EmitterSpec, type Particle, type ParticleShape } from './emitters'

/**
 * Draws the Journey's particles with three.js on a screen-sized canvas that
 * sits over the map's background (under the road and stones). The camera
 * follows the scroll position, so particles live in map coordinates and
 * scroll with the scenery. Only the worlds on screen are simulated, at up
 * to 30 frames a second; a scroll is followed on the very next frame.
 */

const MAX_POINTS = 600
const FRAME_MS = 1000 / 30
const SHAPE_INDEX: Record<ParticleShape, number> = { glow: 0, flame: 1, leaf: 2, flake: 3 }

const VERTEX = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aAlpha;
  attribute float aRotation;
  attribute float aShape;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRotation;
  varying float vShape;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vRotation = aRotation;
    vShape = aShape;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale;
  }
`

const FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRotation;
  varying float vShape;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float c = cos(vRotation);
    float s = sin(vRotation);
    vec2 r = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);
    float a;
    vec3 color = vColor;
    if (vShape < 0.5) {
      // Glow: a soft round light with a white-hot core.
      float d = length(uv);
      a = pow(smoothstep(0.5, 0.0, d), 1.4);
      color = mix(vColor, vec3(1.0), smoothstep(0.18, 0.0, d) * 0.6);
    } else if (vShape < 1.5) {
      // Flame: a teardrop, round at the bottom and pointed at the top, with a hot core.
      vec2 p = vec2(uv.x, -uv.y + 0.12);
      float f = length(vec2(p.x * (1.4 + p.y * 2.2), p.y));
      a = smoothstep(0.44, 0.06, f);
      color = mix(vColor, vec3(1.0, 0.95, 0.7), smoothstep(0.28, 0.0, f));
    } else if (vShape < 2.5) {
      // Leaf or petal: a narrow ellipse, turned by its spin.
      a = smoothstep(0.5, 0.4, length(vec2(r.x * 2.4, r.y)));
    } else {
      // Flake: a small soft dot.
      a = smoothstep(0.5, 0.2, length(uv));
    }
    gl_FragColor = vec4(color, a * vAlpha);
  }
`

/** One batch of points sharing a blending mode, with buffers sized for the most particles ever shown. */
function createBatch(additive: boolean) {
  const geometry = new BufferGeometry()
  const buffers = {
    position: new Float32Array(MAX_POINTS * 3),
    aSize: new Float32Array(MAX_POINTS),
    aColor: new Float32Array(MAX_POINTS * 3),
    aAlpha: new Float32Array(MAX_POINTS),
    aRotation: new Float32Array(MAX_POINTS),
    aShape: new Float32Array(MAX_POINTS),
  }
  geometry.setAttribute('position', new BufferAttribute(buffers.position, 3))
  geometry.setAttribute('aSize', new BufferAttribute(buffers.aSize, 1))
  geometry.setAttribute('aColor', new BufferAttribute(buffers.aColor, 3))
  geometry.setAttribute('aAlpha', new BufferAttribute(buffers.aAlpha, 1))
  geometry.setAttribute('aRotation', new BufferAttribute(buffers.aRotation, 1))
  geometry.setAttribute('aShape', new BufferAttribute(buffers.aShape, 1))
  geometry.setDrawRange(0, 0)

  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: { uScale: { value: 1 } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: additive ? AdditiveBlending : NormalBlending,
  })
  const points = new Points(geometry, material)
  points.frustumCulled = false

  let count = 0
  return {
    points,
    material,
    geometry,
    reset() {
      count = 0
    },
    add(p: Particle, emitter: EmitterSpec, alpha: number, sizeFactor: number) {
      if (count >= MAX_POINTS) return
      buffers.position.set([p.x, -p.y, 0], count * 3)
      buffers.aSize[count] = p.size * sizeFactor
      buffers.aColor.set(p.color, count * 3)
      buffers.aAlpha[count] = alpha
      buffers.aRotation[count] = p.rotation
      buffers.aShape[count] = SHAPE_INDEX[emitter.shape]
      count++
    },
    commit() {
      for (const name of Object.keys(buffers)) geometry.getAttribute(name).needsUpdate = true
      geometry.setDrawRange(0, count)
    },
  }
}

/** The particles of one world, one list per emitter. */
type WorldPool = Particle[][]

/**
 * Starts the effects on `canvas`, following `scroller`'s scroll position.
 * Returns a function that stops them and frees the GPU resources.
 */
export function startEffects(canvas: HTMLCanvasElement, scroller: HTMLElement): () => void {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' })
  renderer.setClearColor(0x000000, 0)
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  renderer.setPixelRatio(pixelRatio)

  const scene = new Scene()
  const camera = new OrthographicCamera(0, MAP_WIDTH, 0, -1, -1, 1)
  // Solid specks first, glowing light on top.
  const solid = createBatch(false)
  const glowing = createBatch(true)
  scene.add(solid.points, glowing.points)

  const pools = new Map<number, WorldPool>()
  const poolFor = (worldIndex: number): WorldPool => {
    let pool = pools.get(worldIndex)
    if (!pool) {
      pool = EMITTERS[WORLDS[worldIndex].id].map((emitter) =>
        Array.from({ length: emitter.count }, () => spawnParticle(emitter, worldIndex, Math.random, true)),
      )
      pools.set(worldIndex, pool)
    }
    return pool
  }

  let width = 0
  let height = 0
  let frame = 0
  let last = performance.now()
  let clock = 0
  let renderedScroll = -1

  /** Moves the camera to what's on screen; returns the visible stretch of map, in map units. */
  const followScroll = () => {
    const unitsPerPx = MAP_WIDTH / width
    const viewTop = scroller.scrollTop * unitsPerPx
    const viewBottom = viewTop + height * unitsPerPx
    camera.top = -viewTop
    camera.bottom = -viewBottom
    camera.updateProjectionMatrix()
    const scale = pixelRatio / unitsPerPx
    solid.material.uniforms.uScale.value = scale
    glowing.material.uniforms.uScale.value = scale
    renderedScroll = scroller.scrollTop
    return { viewTop, viewBottom }
  }

  /** Moves every particle on screen on by `dt` seconds and refills the GPU buffers. */
  const simulate = (dt: number, viewTop: number, viewBottom: number) => {
    solid.reset()
    glowing.reset()
    for (const worldIndex of visibleWorlds(viewTop - 60, viewBottom + 60)) {
      const world = WORLDS[worldIndex]
      const pool = poolFor(worldIndex)
      EMITTERS[world.id].forEach((emitter, e) => {
        const particles = pool[e]
        for (let i = 0; i < particles.length; i++) {
          if (!stepParticle(particles[i], emitter, world.id, dt, clock)) particles[i] = spawnParticle(emitter, worldIndex)
          const p = particles[i]
          const alpha = particleAlpha(p, emitter, clock)
          if (alpha <= 0.01) continue
          const sizeFactor = emitter.flicker ? 0.85 + 0.15 * Math.sin(clock * 7 + p.phase) : 1
          ;(emitter.additive ? glowing : solid).add(p, emitter, alpha, sizeFactor)
        }
      })
    }
    solid.commit()
    glowing.commit()
  }

  const tick = (now: number) => {
    frame = requestAnimationFrame(tick)
    if (canvas.clientWidth !== width || canvas.clientHeight !== height) {
      width = canvas.clientWidth
      height = canvas.clientHeight
      renderer.setSize(width, height, false)
    }
    if (!width || !height) return

    const elapsed = now - last
    const due = elapsed >= FRAME_MS
    // Particles move at up to 30 fps, but follow a scroll on the very next frame, so they stay fixed to the scenery.
    if (!due && scroller.scrollTop === renderedScroll) return
    const { viewTop, viewBottom } = followScroll()
    if (due) {
      last = now
      const dt = Math.min(elapsed / 1000, 0.1)
      clock += dt
      simulate(dt, viewTop, viewBottom)
    }
    renderer.render(scene, camera)
  }
  frame = requestAnimationFrame(tick)

  return () => {
    cancelAnimationFrame(frame)
    for (const batch of [solid, glowing]) {
      batch.geometry.dispose()
      batch.material.dispose()
    }
    renderer.dispose()
  }
}
