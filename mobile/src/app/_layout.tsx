import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { AppGate } from '../components/AppGate'
import { setSaveFailureListener } from '../db/open'
import { AppLock } from '../lock/useAppLock'
import { OnboardingGate } from '../onboarding/OnboardingGate'
import { noteSaveFailure } from '../toasts/store'
import { ToastStack } from '../toasts/ToastStack'

// Stays up until AppGate has the database and the fonts.
void SplashScreen.preventAutoHideAsync()
// A write the database refuses shows "Couldn't save that".
setSaveFailureListener(noteSaveFailure)

export default function RootLayout() {
  return (
    <AppGate>
      {/* The lock covers the welcome flow too, as on the web; the toasts sit above it. */}
      <AppLock>
        <OnboardingGate>
          <Stack screenOptions={{ headerShown: false }} />
        </OnboardingGate>
      </AppLock>
      <ToastStack />
    </AppGate>
  )
}
