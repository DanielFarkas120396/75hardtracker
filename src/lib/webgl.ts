/** Whether this browser can draw with WebGL. The test context is given back at once (phones allow only a few). */
export function supportsWebGL(): boolean {
  // jsdom (tests) has no WebGL at all; asking it for a context prints an error.
  if (typeof WebGLRenderingContext === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return gl !== null
  } catch {
    return false
  }
}
