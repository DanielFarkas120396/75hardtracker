import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed'
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans'
import { Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces'
import { useFonts } from 'expo-font'

/**
 * The web app's three typefaces and the weights it loads (src/styles/index.css):
 * DM Sans for text (--font-rounded), Barlow Condensed for titles and numbers
 * (--font-display), Fraunces italic for quotes (--font-quote). On the phone each
 * weight is its own font family, so pick the weight here, never with fontWeight.
 */
export const FONTS = {
  rounded: {
    regular: 'DMSans_400Regular',
    medium: 'DMSans_500Medium',
    semibold: 'DMSans_600SemiBold',
    bold: 'DMSans_700Bold',
  },
  display: {
    semibold: 'BarlowCondensed_600SemiBold',
    bold: 'BarlowCondensed_700Bold',
  },
  quote: 'Fraunces_400Regular_Italic',
} as const

export interface AppFonts {
  rounded: { regular?: string; medium?: string; semibold?: string; bold?: string }
  display: { semibold?: string; bold?: string }
  quote?: string
}

/** No family at all: React Native then uses the system font. For when the fonts can't be loaded. */
export const SYSTEM_FONTS: AppFonts = { rounded: {}, display: {} }

export type FontStatus = 'loading' | 'ready' | 'failed'

export function useAppFonts(): FontStatus {
  const [loaded, error] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    Fraunces_400Regular_Italic,
  })
  if (error) return 'failed'
  return loaded ? 'ready' : 'loading'
}
