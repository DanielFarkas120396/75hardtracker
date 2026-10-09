import { Vector2, Vector3, type WebGLRenderer } from 'three'
import { clamp01, cubicOut, spring } from './motion'
import type { FillPalette } from './palette'
import type { Painter } from './painter'
import { shaderQuad } from './quad'

/** The chosen settings (docs/prototypes/README.md, Water). */
const P = { rise: 2.4, amp: 8.5, slosh: 0.69, bubbles: 0.82, shimmer: 0.28, back: 0.66 }

/** The surface's height, px from the tile's centre (y up), for a share of the goal: just under the tile when empty, past its top (waves and all) when full. */
export function waveSurfaceY(level: number, height: number): number {
  return -height / 2 - P.amp - 3 + level * (height + 3 * P.amp + 19)
}

const FRAG = /* glsl */ `
  varying vec2 vP;
  uniform vec2 uSize;
  uniform float uLevel, uTime, uAmp, uSlosh, uRipA, uRipT, uRipX, uBub, uFizz, uShine, uBack;
  uniform vec3 uLight, uTop, uMid, uDeep;
  float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
  float waves(float x, float ph) { return uAmp * (0.6 * sin(x * 0.035 + uTime * 1.6 + ph) + 0.4 * sin(x * 0.071 - uTime * 2.3 + ph * 1.7)); }
  float caustic(vec2 p) {
    vec2 q = p * vec2(0.045, 0.06);
    float c = sin(q.x + sin(q.y + uTime * 0.9) * 1.6 + uTime * 0.7) * sin(q.y - uTime * 0.6 + sin(q.x * 0.8 - uTime * 0.5) * 1.3);
    return pow(1.0 - abs(c), 10.0);
  }
  float surf(float x, float ph) {
    float d = abs(x - uRipX) - 170.0 * uRipT;
    return uLevel + waves(x, ph) + uSlosh * x / (uSize.x * 0.5) + uRipA * sin(d * 0.09) * exp(-d * d / 1800.0);
  }
  void main() {
    float x = vP.x, y = vP.y, s = surf(x, 0.0), sb = surf(x, 2.1) + 2.0 + uAmp * 0.5, depth = s - y;
    float front = smoothstep(s + 0.8, s - 0.8, y);
    float back = smoothstep(sb + 0.8, sb - 0.8, y) * (1.0 - front) * uBack;
    float bub = 0.0;
    for (int i = 0; i < 14; i++) {
      float fi = float(i), per = 2.4 + 2.0 * hash(fi), ph = uTime / per + hash(fi + 3.3), cyc = floor(ph), a = fract(ph);
      float bx = (hash(fi * 1.7 + cyc * 3.1) - 0.5) * uSize.x * 0.92 + sin(a * 11.0 + fi) * 3.0;
      float by = -uSize.y * 0.5 + a * (uLevel + uSize.y * 0.5 + 8.0), r = 1.2 + 2.2 * hash(fi + 9.1), dd = length(vec2(x - bx, y - by));
      bub += (smoothstep(1.0, 0.0, abs(dd - r)) * 0.8 + smoothstep(r, 0.0, dd) * 0.15) * step(by + r, surf(bx, 0.0));
    }
    float hl = (exp(-depth * depth / 3.0) + caustic(vP) * uShine * exp(-max(depth, 0.0) / 70.0) + bub * uBub * (0.35 + uFizz)) * front;
    vec3 body = mix(uTop, uDeep, smoothstep(0.0, uSize.y, depth));
    float a = front * 0.78 + back * 0.35;
    vec3 c = (body * front * 0.78 + mix(uMid, uDeep, 0.3) * back * 0.35) / max(a, 0.001);
    gl_FragColor = vec4(mix(c, uLight, clamp(hl, 0.0, 1.0)), clamp(a + hl * 0.4, 0.0, 1.0));
  }
`

/** Water: the level rises with a rolling surface; each pour sloshes, sends a ripple out from the "+ 250 ml" chip and stirs the bubbles. */
export function createWave(palette: FillPalette): Painter {
  const u = {
    uSize: { value: new Vector2() },
    uLevel: { value: 0 },
    uTime: { value: 0 },
    uAmp: { value: P.amp },
    uSlosh: { value: 0 },
    uRipA: { value: 0 },
    uRipT: { value: 9 },
    uRipX: { value: 0 },
    uBub: { value: P.bubbles },
    uFizz: { value: 0 },
    uShine: { value: P.shimmer },
    uBack: { value: 0 },
    uLight: { value: new Vector3() },
    uTop: { value: new Vector3() },
    uMid: { value: new Vector3() },
    uDeep: { value: new Vector3() },
  }
  const quad = shaderQuad(FRAG, u)
  const slosh = spring(25, 0.12)
  let from = 0
  let to = 0
  let t = 1
  let time = 0
  let ripT = 9
  let fizz = 0
  let ripRight = 40
  const shown = () => from + (to - from) * cubicOut(t)

  const painter: Painter = {
    setLevel(level, instant) {
      const up = level > to
      from = instant ? level : shown()
      to = level
      t = instant ? 1 : 0
      if (instant) slosh.set(0, true)
      else if (up) {
        slosh.kick(-P.slosh * 60)
        ripT = 0
        fizz = 1
      }
    },
    step(dt, drift) {
      t = Math.min(1, t + dt / P.rise)
      if (drift) time += dt
      ripT += dt
      fizz *= Math.exp(-dt / 1.2)
      const sloshing = slosh.step(dt)
      return t < 1 || sloshing || ripT < 3
    },
    drifts: () => to > 0,
    shown,
    settled: () => Math.abs(to - shown()) < 0.005,
    setAnchor(right) {
      ripRight = right
    },
    render(renderer: WebGLRenderer, width, height) {
      quad.fit(width, height)
      const y = waveSurfaceY(shown(), height)
      u.uSize.value.set(width, height)
      u.uLevel.value = y
      u.uTime.value = time
      u.uSlosh.value = slosh.y
      u.uRipA.value = P.slosh * 5 * Math.exp(-ripT / 0.9)
      u.uRipT.value = ripT
      u.uRipX.value = width / 2 - ripRight
      u.uFizz.value = fizz
      // The back wave rides higher than the front one: it fades in over the first 12 px of rise so it never peeks out of an empty tile.
      u.uBack.value = P.back * clamp01((y - waveSurfaceY(0, height)) / 12)
      renderer.render(quad.scene, quad.camera)
    },
    setPalette(p) {
      u.uLight.value.set(...p.light)
      u.uTop.value.set(...p.top)
      u.uMid.value.set(...p.mid)
      u.uDeep.value.set(...p.deep)
    },
    dispose: quad.dispose,
  }
  painter.setPalette(palette)
  return painter
}
