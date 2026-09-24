import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

/** Solid, warm background behind the mascot for icons that can't be transparent (Android maskable, iOS). */
const ICON_BACKGROUND = '#fff6dd'

// Regenerate the icons in public/ with `npm run generate-pwa-assets` after changing public/mascot.svg.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0.3, resizeOptions: { background: ICON_BACKGROUND } },
    apple: { ...minimal2023Preset.apple, padding: 0.3, resizeOptions: { background: ICON_BACKGROUND } },
  },
  images: ['public/mascot.svg'],
})
