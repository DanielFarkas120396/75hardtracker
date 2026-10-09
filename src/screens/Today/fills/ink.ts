import { Vector2, Vector3, type WebGLRenderer } from 'three'
import { outQuart } from './motion'
import { mix, type FillPalette } from './palette'
import type { Painter } from './painter'
import { shaderQuad } from './quad'

/** The chosen settings (docs/prototypes/README.md, Diet). */
const P = { spread: 1.1, swirl: 0.81, grain: 150, soft: 20, drift: 0.36 }
const MARGIN = P.swirl * 40 + P.soft + 6

/** The radius from `origin` (px from the tile's centre, y up) that covers `level` of the tile: read off the sorted distances to a grid of points, plus `margin` for the swirl and the soft edge. */
export function inkRadius(level: number, width: number, height: number, origin: readonly [number, number], margin: number): number {
  const distances: number[] = []
  for (let y = 0; y < 30; y++) {
    for (let x = 0; x < 60; x++) distances.push(Math.hypot(-width / 2 + ((x + 0.5) * width) / 60 - origin[0], -height / 2 + ((y + 0.5) * height) / 30 - origin[1]))
  }
  distances.sort((a, b) => a - b)
  if (level <= 0) return -margin
  if (level >= 1) return distances[distances.length - 1] + margin
  return distances[Math.floor(level * distances.length)]
}

// The pale parts are the palette's top tone; the veins sit halfway between its deep and mid tones (deep alone read too dark on the dark tile).
// `k * k`, not pow(k, 2.0): GLSL ES leaves pow undefined for a negative base, and `e` is negative across the soft outer fringe.
const FRAG = /* glsl */ `
  varying vec2 vP;
  uniform float uTime, uR, uSwirl, uSoft, uScale;
  uniform vec2 uO;
  uniform vec3 uTop, uVein;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }
  void main() {
    vec2 q = vP / uScale;
    vec2 w = vec2(fbm(q + vec2(0.0, uTime * 0.08)), fbm(q + vec2(5.2, 1.3) - uTime * 0.06));
    vec2 w2 = vec2(fbm(q + 3.0 * w + vec2(1.7, 9.2) + uTime * 0.05), fbm(q + 3.0 * w + vec2(8.3, 2.8)));
    float e = uR - (length(vP - uO) + (w2.x - 0.5) * uSwirl * 120.0);
    float a = smoothstep(-uSoft, uSoft, e);
    if (a <= 0.0) discard;
    float k = e / (uSoft * 3.0 + 4.0);
    float rim = exp(-k * k), vein = fbm(q * 2.0 + w2 * 2.0);
    vec3 c = mix(uTop, uVein, clamp(vein * 1.1 + rim * 0.6, 0.0, 1.0));
    gl_FragColor = vec4(c, a * (0.78 + 0.22 * rim));
  }
`

/** Diet: green ink blooming through water from the switches, half the tile per switch; it keeps drifting slowly. */
export function createInk(palette: FillPalette): Painter {
  const u = {
    uTime: { value: Math.random() * 50 },
    uR: { value: -MARGIN },
    uSwirl: { value: P.swirl },
    uSoft: { value: P.soft },
    uScale: { value: P.grain },
    uO: { value: new Vector2() },
    uTop: { value: new Vector3() },
    uVein: { value: new Vector3() },
  }
  const quad = shaderQuad(FRAG, u)
  let from = 0
  let to = 0
  let p = 1
  // A spread eases from the radius last drawn, not from its level's: the radius isn't linear in the level, so a tap mid-spread would snap the edge.
  let fromR: number | null = null
  let drawnR: number | null = null
  let anchorRight = 56
  let anchorTop = 60
  const shown = () => from + (to - from) * outQuart(p)

  const painter: Painter = {
    setLevel(level, instant) {
      from = instant ? level : shown()
      to = level
      p = instant ? 1 : 0
      if (instant) drawnR = null
      fromR = drawnR
    },
    step(dt, drift) {
      p = Math.min(1, p + dt / P.spread)
      if (drift) u.uTime.value += dt * P.drift
      return p < 1
    },
    drifts: () => to > 0,
    shown,
    settled: () => p >= 0.85,
    setAnchor(right, top) {
      anchorRight = right
      anchorTop = top
    },
    render(renderer: WebGLRenderer, width, height) {
      quad.fit(width, height)
      const origin: [number, number] = [width / 2 - anchorRight, height / 2 - anchorTop]
      u.uO.value.set(origin[0], origin[1])
      const b = inkRadius(to, width, height, origin, MARGIN)
      fromR ??= inkRadius(from, width, height, origin, MARGIN)
      u.uR.value = drawnR = fromR + (b - fromR) * outQuart(p)
      renderer.render(quad.scene, quad.camera)
    },
    setPalette(p2) {
      u.uTop.value.set(...p2.top)
      u.uVein.value.set(...mix(p2.deep, p2.mid, 0.5))
    },
    dispose: quad.dispose,
  }
  painter.setPalette(palette)
  return painter
}
