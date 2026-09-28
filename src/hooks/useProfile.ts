import { createContext, useContext } from 'react'
import type { Profile } from '../logic/profile'

/** The player's profile, provided around the main app once the welcome flow is done (see OnboardingGate). */
export const ProfileContext = createContext<Profile | undefined>(undefined)

/** The player's profile, or undefined where none is provided (a screen's own tests). */
export function useProfile(): Profile | undefined {
  return useContext(ProfileContext)
}
