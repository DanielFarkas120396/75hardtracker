import type { ExpoConfig } from 'expo/config'

// "Companion" is a placeholder until the owner picks the app's name ("75 Hard" is a trademark and
// must not appear here). The bundle ID is permanent once the first build exists, so it stays
// neutral: it never contains the app's name.
const config: ExpoConfig = {
  name: 'Companion',
  slug: 'companion',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'companion',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.danielfarkas.companion',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      // Dark Hell's canvas (WORLD_COLORS.hell.dark.canvas), the app's first colour.
      { backgroundColor: '#16110e', image: './assets/images/splash-icon.png', imageWidth: 76 },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
}

export default config
