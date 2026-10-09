import { Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, type IUniform } from 'three'

/** Hands each fragment its position in CSS px from the tile's centre, y up. */
export const QUAD_VERT = /* glsl */ `
  varying vec2 vP;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vP = world.xy;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

/** A tile-sized quad drawn by one fragment shader, and the camera that maps it 1:1 onto CSS px. */
export function shaderQuad(fragmentShader: string, uniforms: Record<string, IUniform>) {
  const material = new ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, vertexShader: QUAD_VERT, fragmentShader, uniforms })
  const mesh = new Mesh(new PlaneGeometry(1, 1), material)
  const scene = new Scene()
  scene.add(mesh)
  const camera = new OrthographicCamera(-0.5, 0.5, 0.5, -0.5, -1, 1)
  return {
    scene,
    camera,
    /** Sizes the quad and the camera to the tile. */
    fit(width: number, height: number) {
      mesh.scale.set(width, height, 1)
      camera.left = -width / 2
      camera.right = width / 2
      camera.top = height / 2
      camera.bottom = -height / 2
      camera.updateProjectionMatrix()
    },
    dispose() {
      mesh.geometry.dispose()
      material.dispose()
    },
  }
}
