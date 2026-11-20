import { Vector2, Vector3, type WebGLRenderer } from 'three'
import { createWaveModel, WAVE } from '../../../logic/fillWave'
import type { FillPalette } from './palette'
import type { Painter } from './painter'
import { shaderQuad } from './quad'

export { waveSurfaceY } from '../../../logic/fillWave'

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
    uAmp: { value: WAVE.amp },
    uSlosh: { value: 0 },
    uRipA: { value: 0 },
    uRipT: { value: 9 },
    uRipX: { value: 0 },
    uBub: { value: WAVE.bubbles },
    uFizz: { value: 0 },
    uShine: { value: WAVE.shimmer },
    uBack: { value: 0 },
    uLight: { value: new Vector3() },
    uTop: { value: new Vector3() },
    uMid: { value: new Vector3() },
    uDeep: { value: new Vector3() },
  }
  const quad = shaderQuad(FRAG, u)
  const model = createWaveModel()

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
      u.uSize.value.set(width, height)
      u.uLevel.value = f.level
      u.uTime.value = f.time
      u.uSlosh.value = f.slosh
      u.uRipA.value = f.ripA
      u.uRipT.value = f.ripT
      u.uRipX.value = f.ripX
      u.uFizz.value = f.fizz
      u.uBack.value = f.back
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
