import { Vector2, Vector3, type WebGLRenderer } from 'three'
import { createSprintModel, SPRINT } from '../../../logic/fillSprint'
import type { FillPalette } from './palette'
import type { Painter } from './painter'
import { shaderQuad } from './quad'

export { sprintFront } from '../../../logic/fillSprint'

const FRAG = /* glsl */ `
  varying vec2 vP;
  uniform vec2 uSize;
  uniform float uFront, uVel, uRows, uLen, uSoft, uTime, uFlow;
  uniform vec3 uMid, uLight;
  float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
  void main() {
    float x = vP.x + uSize.x * 0.5, rowH = uSize.y / uRows, row = floor((vP.y + uSize.y * 0.5) / rowH), ry = fract((vP.y + uSize.y * 0.5) / rowH);
    float thick = smoothstep(0.3, 0.08, abs(ry - 0.5)), thin = smoothstep(0.14, 0.03, abs(ry - 0.5)), rs = 0.6 + 0.8 * h1(row), off = h1(row + 7.3);
    float lead = uLen * uVel * (0.25 + 0.95 * h1(row + 3.1)), f = uFront + (h1(row + 1.7) - 0.5) * uSoft;
    float behind = smoothstep(f, f - uSoft, x);
    float streak = lead > 0.5 ? thick * smoothstep(f, f + lead, x) * step(x, f + lead) * step(f - 2.0, x) : 0.0;
    float flow = thin * pow(fract(x / 120.0 - uTime * uFlow * rs + off), 6.0) * 0.6 * behind;
    float fill = behind * 0.62;
    float a = clamp(fill + streak + flow, 0.0, 1.0);
    vec3 c = (uMid * fill + uLight * (streak + flow)) / max(fill + streak + flow, 0.001);
    gl_FragColor = vec4(c, a);
  }
`

/** Workouts: the fill races in from the left with speed lines in lanes, which pull back into it as it stops; thin lines keep flowing through it. */
export function createSprint(palette: FillPalette): Painter {
  const u = {
    uSize: { value: new Vector2() },
    uFront: { value: 0 },
    uVel: { value: 0 },
    uRows: { value: SPRINT.lanes },
    uLen: { value: SPRINT.streak },
    uSoft: { value: SPRINT.ragged },
    uTime: { value: 0 },
    uFlow: { value: SPRINT.flow },
    uMid: { value: new Vector3() },
    uLight: { value: new Vector3() },
  }
  const quad = shaderQuad(FRAG, u)
  const model = createSprintModel()

  const painter: Painter = {
    setLevel: model.setLevel,
    step: model.step,
    drifts: model.drifts,
    shown: model.shown,
    settled: model.settled,
    render(renderer: WebGLRenderer, width, height) {
      quad.fit(width, height)
      const f = model.frame(width, height)
      u.uSize.value.set(width, height)
      u.uFront.value = f.front
      u.uVel.value = f.vel
      u.uTime.value = f.time
      renderer.render(quad.scene, quad.camera)
    },
    setPalette(p) {
      u.uMid.value.set(...p.mid)
      u.uLight.value.set(...p.light)
    },
    dispose: quad.dispose,
  }
  painter.setPalette(palette)
  return painter
}
