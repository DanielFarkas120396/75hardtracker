import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { AppGate } from '../components/AppGate'

// Stays up until AppGate has the database and the fonts.
void SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  return (
    <AppGate>
      <Stack screenOptions={{ headerShown: false }} />
    </AppGate>
  )
}
