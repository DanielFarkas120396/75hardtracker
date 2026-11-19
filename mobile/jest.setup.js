/* global jest */
// Jest has no UI thread and no GPU: Reanimated runs through its own stand-in, and Skia's components draw nothing.
// The fills' shaders are compiled and drawn for real in src/today/fills/__tests__/shaders.test.ts.
// As the web's tests set MotionGlobalConfig.skipAnimations: a done task is a chip at once, the gauge shows its end
// state. The tests of the choreography itself turn it off.
globalThis.__SKIP_ANIMATIONS__ = true

jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'))
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))
jest.mock('@shopify/react-native-skia', () => {
  const { View } = require('react-native')
  const nothing = () => null
  return {
    Canvas: View,
    Fill: nothing,
    Group: nothing,
    Shader: nothing,
    ImageShader: nothing,
    ColorShader: nothing,
    ColorMatrix: nothing,
    Image: nothing,
    Paint: nothing,
    Skottie: nothing,
    Skia: { RuntimeEffect: { Make: () => null } },
    useImage: () => null,
  }
})
