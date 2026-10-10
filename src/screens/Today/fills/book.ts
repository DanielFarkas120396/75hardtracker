import {
  DoubleSide,
  LessEqualDepth,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  type WebGLRenderer,
} from 'three'
import { clamp01, inOut, smooth } from './motion'
import { FILL_LOOK, type FillPalette } from './palette'
import type { Painter } from './painter'
import { QUAD_VERT } from './quad'

/** Every ruleset reads 10 pages a day (rulesets.ts). */
const PAGES = 10
/** The chosen book (docs/prototypes/README.md, Reading), lifting at once: 2.1 s of page motion. */
const TURN = 2.2
const FADE = 0.7
const BETA = 0.6
const BASE = 0.6
const BLEND = 0.8
const REACH = 0.4
const FEATHER = 18
const FILL_FROM = 0.12
const FILL_TO = 0.9
const START = 0.04
const GUTTER = 0.32
const NX = 60
const NY = 16
const D = 900
const LIGHT = new Vector3(-200, 250, 600).normalize()
/** How fast the fill recedes after an undo, in pages a second: ten pages in 0.4 s. */
const EBB = 25

/** The gap before the next page: the calm pace for one page; several at once riffle through, all starting within 2.4 s. */
export function riffleGap(pagesToGo: number): number {
  return Math.min(TURN * 0.45, 2.4 / Math.max(1, pagesToGo))
}

const restAngle = (u: number) => BETA * (1 - smooth(clamp01(u / GUTTER)))
const GUTTER_GLSL = /* glsl */ `
  float gutterShade(float u, float depth) { float g = 1.0 - smoothstep(0.0, 0.34, u); return (g * g * 0.42 + smoothstep(0.03, 0.0, u) * 0.25) * depth; }
  float gutterLight(float u, float depth) { return smoothstep(0.1, 0.22, u) * (1.0 - smoothstep(0.22, 0.42, u)) * 0.07 * depth; }
`

const FILL_FRAG = /* glsl */ `
  varying vec2 vP;
  uniform vec2 uSize;
  uniform float uFill, uFeather, uAlpha;
  uniform vec3 uMid;
  void main() {
    float x = vP.x + uSize.x * 0.5;
    float a = uFill <= 0.0 ? 0.0 : 1.0 - clamp((x - uFill) / uFeather, 0.0, 1.0);
    gl_FragColor = vec4(uMid, a * uAlpha);
  }
`

interface Page {
  geometry: PlaneGeometry
  material: ShaderMaterial
  depth: Mesh
  color: Mesh
  start: number
  t: number
}

/** Reading: an open book whose pages lift from the right, curl over the spine and fade; the tile fills a tenth per page. */
export function createBook(palette: FillPalette): Painter {
  const scene = new Scene()
  const camera = new PerspectiveCamera(10, 1, 100, 2000)
  camera.position.set(0, 0, D)
  let width = 173
  let height = 120

  const fillUniforms = { uSize: { value: new Vector2() }, uFill: { value: 0 }, uFeather: { value: FEATHER }, uAlpha: { value: FILL_LOOK.book.body }, uMid: { value: new Vector3() } }
  const fill = new Mesh(
    new PlaneGeometry(1, 1),
    new ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, vertexShader: QUAD_VERT, fragmentShader: FILL_FRAG, uniforms: fillUniforms }),
  )
  fill.renderOrder = -1
  scene.add(fill)

  // The open book at rest: two halves curving down into a shaded gutter.
  const halves = [0, 1].map((flip) => {
    const geometry = new PlaneGeometry(1, 1, NX, 1)
    const material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      uniforms: { flip: { value: flip }, depth: { value: BETA / 0.6 } },
      vertexShader: 'varying float vU; uniform float flip; void main() { vU = flip > 0.5 ? 1.0 - uv.x : uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying float vU; uniform float depth; ${GUTTER_GLSL} void main() { float s = gutterShade(vU, depth), h = gutterLight(vU, depth), a = s + h; gl_FragColor = vec4(vec3(h / max(a, 0.0001)), a); }`,
    })
    const mesh = new Mesh(geometry, material)
    scene.add(mesh)
    return { geometry, material, flip }
  })
  let shapedFor = ''
  function shapeHalves() {
    const key = `${width}x${height}`
    if (key === shapedFor) return
    shapedFor = key
    const pw = width / 2
    for (const half of halves) {
      const pos = half.geometry.attributes.position
      for (let iy = 0; iy <= 1; iy++) {
        let x = 0
        let z = 0
        const y = iy === 0 ? height / 2 : -height / 2
        for (let ix = 0; ix <= NX; ix++) {
          const a = restAngle(ix / NX)
          pos.setXYZ(iy * (NX + 1) + (half.flip ? NX - ix : ix), half.flip ? -x : x, y, z)
          x += (pw / NX) * Math.cos(a)
          z += (pw / NX) * Math.sin(a)
        }
      }
      pos.needsUpdate = true
    }
  }

  // Each page draws its depth first, pushed back a hair, so a curl never blends over itself.
  const depthOnly = new MeshBasicMaterial({ transparent: true, colorWrite: false, depthWrite: true, depthTest: true, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 4 })
  const front = new Vector3()
  const back = new Vector3()
  const pageMaterial = () =>
    new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      depthFunc: LessEqualDepth,
      side: DoubleSide,
      uniforms: {
        cFront: { value: front },
        cBack: { value: back },
        opacity: { value: 0 },
        base: { value: BASE },
        reach: { value: REACH },
        depth: { value: BETA / 0.6 },
        fillX: { value: 0 },
        feather: { value: FEATHER },
        overFill: { value: BLEND },
        L: { value: LIGHT },
      },
      vertexShader: 'varying vec3 vN; varying float vU; varying float vX; void main() { vN = normalMatrix * normal; vU = uv.x; vX = (modelMatrix * vec4(position, 1.0)).x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec3 vN; varying float vU; varying float vX; uniform vec3 cFront, cBack, L; uniform float opacity, base, reach, depth, fillX, feather, overFill; ${GUTTER_GLSL}
        void main() {
          vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
          float d = max(dot(n, L), 0.0);
          vec3 c = (gl_FrontFacing ? cFront : cBack) * (0.62 + 0.5 * d);
          c = c * (1.0 - gutterShade(vU, depth)) + vec3(gutterLight(vU, depth));
          float b = 1.0 - base * (1.0 - smoothstep(0.0, reach, vU));
          float over = mix(1.0 - overFill, 1.0, smoothstep(fillX - feather, fillX + feather, vX));
          gl_FragColor = vec4(c, opacity * b * over);
        }`,
    })

  const active: Page[] = []
  let shown = 0
  let target = 0
  let time = 0
  let nextAt = 0
  let gap = TURN * 0.45
  let serial = 0
  /** Pages of fill still receding after an undo: the book never turns pages back. */
  let ebb = 0

  const share = (page: Page) => smooth((page.t - FILL_FROM) / (FILL_TO - FILL_FROM))
  const turned = () => shown + ebb + active.reduce((sum, page) => sum + share(page), 0)

  function addPage(): Page {
    const geometry = new PlaneGeometry(1, 1, NX, NY)
    const material = pageMaterial()
    const k = ++serial
    const depth = new Mesh(geometry, depthOnly)
    depth.renderOrder = 2 * k
    depth.frustumCulled = false
    const color = new Mesh(geometry, material)
    color.renderOrder = 2 * k + 1
    color.frustumCulled = false
    scene.add(depth, color)
    return { geometry, material, depth, color, start: time, t: 0 }
  }
  function dropPage(page: Page) {
    scene.remove(page.depth, page.color)
    page.geometry.dispose()
    page.material.dispose()
  }

  // The page turns around the spine; its bottom-right corner leads and the part by the spine lags, so it curls.
  function bend(page: Page, fillX: number) {
    const pos = page.geometry.attributes.position
    const pw = width / 2
    for (let iy = 0; iy <= NY; iy++) {
      const v = 1 - iy / NY
      let x = 0
      let z = 0
      for (let ix = 0; ix <= NX; ix++) {
        const u = ix / NX
        const lead = 0.3 * u * (1 - v) + 0.12 * u
        const lag = 0.16 * (1 - smooth(clamp01(u / 0.3)))
        const e = inOut((page.t - START - lag + lead) / (1 - START - lag))
        const r = restAngle(u)
        const a = r + (Math.PI - 2 * r) * e
        pos.setXYZ(iy * (NX + 1) + ix, x, v * height - height / 2, z + 0.5)
        x += (pw / NX) * Math.cos(a)
        z += (pw / NX) * Math.sin(a)
      }
    }
    pos.needsUpdate = true
    page.geometry.computeVertexNormals()
    const u = page.material.uniforms
    u.opacity.value = 0.55 * Math.min(clamp01(page.t / 0.06), 1 - smooth((page.t - FADE) / (1 - FADE)))
    u.fillX.value = fillX
  }

  const painter: Painter = {
    setLevel(level, instant) {
      const pages = Math.round(level * PAGES)
      target = pages
      if (instant) {
        active.forEach(dropPage)
        active.length = 0
        shown = pages
        ebb = 0
        return
      }
      if (pages < shown + active.length) {
        // Keep the pages already turning that still fit; the fill recedes over the rest, never jumping up.
        const from = turned()
        while (active.length > 0 && shown + active.length > pages) dropPage(active.pop()!)
        shown = Math.min(shown, pages)
        ebb = 0
        ebb = Math.max(0, from - turned())
      }
      gap = riffleGap(pages - shown - active.length)
    },
    step(dt) {
      time += dt
      ebb = Math.max(0, ebb - dt * EBB)
      if (shown + active.length < target && time >= nextAt) {
        active.push(addPage())
        nextAt = time + gap
      }
      for (let k = active.length - 1; k >= 0; k--) {
        const page = active[k]
        page.t = clamp01((time - page.start) / TURN)
        if (page.t >= 1) {
          shown = Math.min(PAGES, shown + 1)
          dropPage(page)
          active.splice(k, 1)
        }
      }
      return active.length > 0 || shown < target || ebb > 0
    },
    drifts: () => false,
    shown: () => turned() / PAGES,
    settled: () => ebb === 0 && turned() >= target - 0.02,
    render(renderer: WebGLRenderer, w, h) {
      width = w
      height = h
      camera.fov = (2 * Math.atan(h / 2 / D) * 180) / Math.PI
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      shapeHalves()
      fill.scale.set(w, h, 1)
      fill.position.z = -1
      const fillPx = (Math.min(PAGES, turned()) / PAGES) * w
      fillUniforms.uSize.value.set(w, h)
      fillUniforms.uFill.value = fillPx >= w ? w + FEATHER : fillPx
      for (const page of active) bend(page, fillPx - w / 2)
      renderer.render(scene, camera)
    },
    setPalette(p) {
      fillUniforms.uMid.value.set(...p.mid)
      front.set(...p.mid)
      back.set(...p.edge)
    },
    dispose() {
      active.forEach(dropPage)
      fill.geometry.dispose()
      ;(fill.material as ShaderMaterial).dispose()
      halves.forEach((half) => {
        half.geometry.dispose()
        half.material.dispose()
      })
      depthOnly.dispose()
    },
  }
  painter.setPalette(palette)
  return painter
}
