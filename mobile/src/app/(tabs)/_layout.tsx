import { NativeTabs } from 'expo-router/native-tabs'
import { useTheme } from '../../theme/ThemeProvider'

// The web app's five tabs, in its order (src/components/ui/BottomNav.tsx). The icons are
// Apple's symbols for now; the app's own icons come with the real screens.
const TABS = [
  { name: 'index', label: 'Today', sf: 'sun.max.fill' },
  { name: 'journey', label: 'Journey', sf: 'mountain.2.fill' },
  { name: 'stats', label: 'Stats', sf: 'chart.bar.fill' },
  { name: 'gallery', label: 'Gallery', sf: 'photo.on.rectangle' },
  { name: 'settings', label: 'Settings', sf: 'gearshape.fill' },
] as const

export default function TabsLayout() {
  const { colors } = useTheme()
  return (
    <NativeTabs backgroundColor={colors.surface} tintColor={colors.worldInk} iconColor={colors.inkMuted}>
      {TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={tab.sf} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  )
}
