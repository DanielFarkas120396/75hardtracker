import { Vector2, Vector3, type WebGLRenderer } from 'three'
import { clamp01, cubicOut } from './motion'
import type { FillPalette } from './palette'
import type { Painter } from './painter'
import { shaderQuad } from './quad'

/** The chosen settings (docs/prototypes/README.md, Workouts). */
const P = { run: 0.7, lanes: 12, streak: 90, ragged: 16, flow: 0.3 }

/** The fill's front, px from the tile's left edge: off the left when empty, off the right (ragged edge and all) when full. */
export function sprintFront(level: number, width: number): number {
  const edge = P.ragged + 10
  return -edge + level * (width + 2 * edge)
}

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
    uRows: { value: P.lanes },
    uLen: { value: P.streak },
    uSoft: { value: P.ragged },
    uTime: { value: 0 },
    uFlow: { value: P.flow },
    uMid: { value: new Vector3() },
    uLight: { value: new Vector3() },
  }
  const quad = shaderQuad(FRAG, u)
  let from = 0
  let to = 0
  let t = 1
  let time = 0
  let prev = 0
  let vel = 0
  // Off at full speed on the tap (ease out): the streaks are longest at once and pull in as it stops.
  const shown = () => from + (to - from) * cubicOut(t)

  const painter: Painter = {
    setLevel(level, instant) {
      from = instant ? level : shown()
      to = level
      t = instant ? 1 : 0
      if (instant) vel = 0
      prev = shown()
    },
    step(dt, drift) {
      t = Math.min(1, t + dt / P.run)
      if (drift) time += dt
      const now = shown()
      // How fast the front moves, against its top speed, sets how far the streaks reach.
      const v = dt > 0 ? Math.abs(now - prev) / dt / (Math.abs(to - from) / P.run * 1.5 + 1e-3) : 0
      prev = now
      vel += (clamp01(v) - vel) * Math.min(1, dt * 12)
      return t < 1 || vel > 0.01
    },
    drifts: () => to > 0,
    shown,
    settled: () => t >= 0.8,
    render(renderer: WebGLRenderer, width, height) {
      quad.fit(width, height)
      u.uSize.value.set(width, height)
      u.uFront.value = sprintFront(shown(), width)
      u.uVel.value = vel
      u.uTime.value = time
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
