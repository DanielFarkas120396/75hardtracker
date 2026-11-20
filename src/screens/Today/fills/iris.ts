import {
  AmbientLight,
  DirectionalLight,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  Vector2,
  Vector3,
  type WebGLRenderer,
} from 'three'
import { coverRepeat, createIrisModel, IRIS } from '../../../logic/fillIris'
import { mix, type FillPalette } from './palette'
import type { Painter } from './painter'

export { coverRepeat } from '../../../logic/fillIris'

const D = 900

const PHOTO_FRAG = /* glsl */ `
  uniform sampler2D uPhoto;
  uniform float uHasPhoto, uColour, uA;
  uniform vec2 uRep;
  uniform vec3 uShadow, uLight, uMid;
  varying vec2 vUv;
  void main() {
    vec3 c = uHasPhoto > 0.5 ? texture2D(uPhoto, (vUv - 0.5) * uRep + 0.5).rgb : uMid;
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    gl_FragColor = vec4(mix(mix(uShadow, uLight, l), c, uColour), uA);
  }
`

/** Photo: a camera iris shuts, a flash fires as it closes, and its blades swirl open on the day's photo in the world's colour. */
export function createIris(palette: FillPalette): Painter {
  const scene = new Scene()
  const camera = new PerspectiveCamera(10, 1, 100, 2000)
  camera.position.set(0, 0, D)
  scene.add(new AmbientLight(0xffffff, 0.5 * Math.PI))
  const sun = new DirectionalLight(0xffffff, 0.9 * Math.PI)
  sun.position.copy(new Vector3(-200, 250, 600).normalize().multiplyScalar(1000))
  scene.add(sun)

  const pu = {
    uPhoto: { value: null as Texture | null },
    uHasPhoto: { value: 0 },
    uColour: { value: IRIS.colour },
    uA: { value: 0 },
    uRep: { value: new Vector2(1, 1) },
    uShadow: { value: new Vector3() },
    uLight: { value: new Vector3() },
    uMid: { value: new Vector3() },
  }
  const photoMaterial = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: pu,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: PHOTO_FRAG,
  })
  const photo = new Mesh(new PlaneGeometry(1, 1), photoMaterial)
  scene.add(photo)

  // Each blade is a big plate whose inner edge sits at distance r from the centre: together they leave a polygon of inradius r open.
  const bladeGeometry = new PlaneGeometry(800, 500)
  bladeGeometry.translate(0, 250, 0)
  const edgeGeometry = new PlaneGeometry(800, 1.6)
  edgeGeometry.translate(0, 0.8, 0)
  const bladeMaterial = new MeshStandardMaterial({ metalness: 0.35, roughness: 0.38, side: DoubleSide })
  const edgeMaterial = new MeshBasicMaterial({ transparent: true, opacity: 0.55 })
  const iris = new Group()
  scene.add(iris)
  const blades = Array.from({ length: IRIS.blades }, (_, i) => {
    const blade = new Mesh(bladeGeometry, bladeMaterial)
    blade.add(new Mesh(edgeGeometry, edgeMaterial))
    blade.position.z = 2 + i * 0.6
    blade.rotation.x = 0.04
    iris.add(blade)
    return blade
  })
  const flashMaterial = new MeshBasicMaterial({ color: 0xf6fff4, transparent: true, opacity: 0, depthTest: false })
  const flash = new Mesh(new PlaneGeometry(1, 1), flashMaterial)
  flash.position.z = 40
  flash.renderOrder = 9
  scene.add(flash)

  const model = createIrisModel()
  let image: ImageBitmap | null = null
  let texture: Texture | null = null

  const painter: Painter = {
    setLevel: model.setLevel,
    step: model.step,
    drifts: model.drifts,
    shown: model.shown,
    settled: model.settled,
    setImage(next) {
      image = next
      model.setHasImage(next !== null)
      texture?.dispose()
      texture = next ? new Texture(next) : null
      if (texture) texture.needsUpdate = true
      pu.uPhoto.value = texture
      pu.uHasPhoto.value = texture ? 1 : 0
    },
    render(renderer: WebGLRenderer, w, h) {
      camera.fov = (2 * Math.atan(h / 2 / D) * 180) / Math.PI
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      photo.scale.set(w, h, 1)
      flash.scale.set(w, h, 1)
      if (image) pu.uRep.value.set(...coverRepeat(image.width / image.height, w / h))
      const f = model.frame(w, h)
      pu.uA.value = f.photo
      flashMaterial.opacity = f.flash
      blades.forEach((blade, n) => {
        const phi = (n / blades.length) * Math.PI * 2 + f.twist
        blade.position.x = Math.cos(phi) * f.r
        blade.position.y = Math.sin(phi) * f.r
        blade.rotation.z = phi - Math.PI / 2
        blade.visible = f.r < f.rmax
      })
      renderer.render(scene, camera)
    },
    setPalette(p) {
      const shadow = mix(p.deep, [0, 0, 0], 0.6)
      pu.uShadow.value.set(...shadow)
      pu.uLight.value.set(...p.light)
      pu.uMid.value.set(...p.mid)
      const blade = mix(p.deep, [0, 0, 0], 0.25)
      bladeMaterial.color.setRGB(blade[0], blade[1], blade[2], SRGBColorSpace)
      edgeMaterial.color.setRGB(p.ink[0], p.ink[1], p.ink[2], SRGBColorSpace)
    },
    dispose() {
      texture?.dispose()
      photo.geometry.dispose()
      photoMaterial.dispose()
      bladeGeometry.dispose()
      edgeGeometry.dispose()
      bladeMaterial.dispose()
      edgeMaterial.dispose()
      flash.geometry.dispose()
      flashMaterial.dispose()
    },
  }
  painter.setPalette(palette)
  return painter
}
