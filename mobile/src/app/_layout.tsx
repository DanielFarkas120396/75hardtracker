import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { AppGate } from '../components/AppGate'
import { OnboardingGate } from '../onboarding/OnboardingGate'

// Stays up until AppGate has the database and the fonts.
void SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  return (
    <AppGate>
      <OnboardingGate>
        <Stack screenOptions={{ headerShown: false }} />
      </OnboardingGate>
    </AppGate>
  )
}
