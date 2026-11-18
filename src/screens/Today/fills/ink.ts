import { Vector2, Vector3, type WebGLRenderer } from 'three'
import { createInkModel, INK, INK_MARGIN } from '../../../logic/fillInk'
import { mix, type FillPalette } from './palette'
import type { Painter } from './painter'
import { shaderQuad } from './quad'

export { inkRadius } from '../../../logic/fillInk'

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
    uTime: { value: 0 },
    uR: { value: -INK_MARGIN },
    uSwirl: { value: INK.swirl },
    uSoft: { value: INK.soft },
    uScale: { value: INK.grain },
    uO: { value: new Vector2() },
    uTop: { value: new Vector3() },
    uVein: { value: new Vector3() },
  }
  const quad = shaderQuad(FRAG, u)
  const model = createInkModel()

  const painter: Painter = {
    setLevel: model.setLevel,
    step: model.step,
    drifts: model.drifts,
    shown: model.shown,
    settled: model.settled,
    setAnchor: model.setAnchor,
    render(renderer: WebGLRenderer, width, height) {
      quad.fit(width, height)
      const f = model.frame(width, height)
      u.uTime.value = f.time
      u.uO.value.set(f.origin[0], f.origin[1])
      u.uR.value = f.radius
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
