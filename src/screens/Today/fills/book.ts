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
import { BOOK, createBookModel, pageAngle, pageOpacity, restAngle, spineShade } from '../../../logic/fillBook'
import { FILL_LOOK, type FillPalette } from './palette'
import type { Painter } from './painter'
import { QUAD_VERT } from './quad'

export { riffleGap, spineShade } from '../../../logic/fillBook'

const NX = 60
const NY = 16
const D = 900
const LIGHT = new Vector3(-200, 250, 600).normalize()

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

interface PageMeshes {
  geometry: PlaneGeometry
  material: ShaderMaterial
  depth: Mesh
  color: Mesh
}

/** Reading: an open book whose pages lift from the right, curl over the spine and fade; the tile fills a tenth per page. */
export function createBook(palette: FillPalette): Painter {
  const scene = new Scene()
  const camera = new PerspectiveCamera(10, 1, 100, 2000)
  camera.position.set(0, 0, D)
  let width = 173
  let height = 120

  const fillUniforms = { uSize: { value: new Vector2() }, uFill: { value: 0 }, uFeather: { value: BOOK.feather }, uAlpha: { value: FILL_LOOK.book.body }, uMid: { value: new Vector3() } }
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
      uniforms: { flip: { value: flip }, depth: { value: 0 } },
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
        base: { value: BOOK.base },
        reach: { value: BOOK.reach },
        depth: { value: BOOK.beta / 0.6 },
        fillX: { value: 0 },
        feather: { value: BOOK.feather },
        overFill: { value: BOOK.blend },
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

  let mode = palette.mode
  const model = createBookModel()
  /** The meshes of each page the model is turning, by the page's id. */
  const meshes = new Map<number, PageMeshes>()

  function addPage(id: number): PageMeshes {
    const geometry = new PlaneGeometry(1, 1, NX, NY)
    const material = pageMaterial()
    const depth = new Mesh(geometry, depthOnly)
    depth.renderOrder = 2 * id
    depth.frustumCulled = false
    const color = new Mesh(geometry, material)
    color.renderOrder = 2 * id + 1
    color.frustumCulled = false
    scene.add(depth, color)
    return { geometry, material, depth, color }
  }
  function dropPage(page: PageMeshes) {
    scene.remove(page.depth, page.color)
    page.geometry.dispose()
    page.material.dispose()
  }

  // The page turns around the spine; its bottom-right corner leads and the part by the spine lags, so it curls.
  function bend(page: PageMeshes, t: number, fillX: number) {
    const pos = page.geometry.attributes.position
    const pw = width / 2
    for (let iy = 0; iy <= NY; iy++) {
      const v = 1 - iy / NY
      let x = 0
      let z = 0
      for (let ix = 0; ix <= NX; ix++) {
        const a = pageAngle(ix / NX, v, t)
        pos.setXYZ(iy * (NX + 1) + ix, x, v * height - height / 2, z + 0.5)
        x += (pw / NX) * Math.cos(a)
        z += (pw / NX) * Math.sin(a)
      }
    }
    pos.needsUpdate = true
    page.geometry.computeVertexNormals()
    const u = page.material.uniforms
    u.opacity.value = pageOpacity(t)
    u.fillX.value = fillX
  }

  const painter: Painter = {
    setLevel: model.setLevel,
    step: model.step,
    drifts: model.drifts,
    shown: model.shown,
    settled: model.settled,
    render(renderer: WebGLRenderer, w, h) {
      width = w
      height = h
      camera.fov = (2 * Math.atan(h / 2 / D) * 180) / Math.PI
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      shapeHalves()
      const f = model.frame(w, h)
      for (const half of halves) half.material.uniforms.depth.value = spineShade(f.turned, mode)
      fill.scale.set(w, h, 1)
      fill.position.z = -1
      fillUniforms.uSize.value.set(w, h)
      fillUniforms.uFill.value = f.fillPx >= w ? w + BOOK.feather : f.fillPx
      // The model's pages come and go; their meshes follow.
      for (const [id, page] of meshes) {
        if (f.pages.some((turning) => turning.id === id)) continue
        dropPage(page)
        meshes.delete(id)
      }
      for (const { id, t } of f.pages) {
        let page = meshes.get(id)
        if (!page) meshes.set(id, (page = addPage(id)))
        bend(page, t, f.fillPx - w / 2)
      }
      renderer.render(scene, camera)
    },
    setPalette(p) {
      mode = p.mode
      fillUniforms.uMid.value.set(...p.mid)
      front.set(...p.mid)
      back.set(...p.edge)
    },
    dispose() {
      meshes.forEach(dropPage)
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
