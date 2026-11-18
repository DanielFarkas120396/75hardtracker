import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native'
import { useTheme } from '../../theme/ThemeProvider'
import { withAlpha } from '../../theme/tokens'

export type ButtonVariant = 'primary' | 'soft' | 'streak' | 'danger' | 'secondary'

interface ButtonProps {
  label: string
  onPress: () => void
  variant?: ButtonVariant
  disabled?: boolean
  /** A decoration before the label. */
  icon?: ReactNode
  /** What VoiceOver says, when the label alone isn't enough ("Add" → "Add 330 ml"). */
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}

/** A flat pill that sinks slightly on tap. The web app's Button (src/components/ui/Button.tsx), with its five looks. */
export function Button({ label, onPress, variant = 'primary', disabled = false, icon, accessibilityLabel, style }: ButtonProps) {
  const { colors, fonts } = useTheme()
  const looks: Record<ButtonVariant, { fill: string; ink: string }> = {
    primary: { fill: colors.world, ink: colors.onWorld },
    // A quieter world-coloured action beside a primary one.
    soft: { fill: colors.worldSoft, ink: colors.worldInk },
    streak: { fill: colors.orange, ink: colors.onAccent },
    danger: { fill: colors.dangerDark, ink: '#ffffff' },
    secondary: { fill: withAlpha(colors.ink, 0.08), ink: colors.ink },
  }
  const look = disabled ? { fill: withAlpha(colors.ink, 0.1), ink: colors.inkMuted } : looks[variant]

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, { backgroundColor: look.fill }, pressed && styles.pressed, style]}
    >
      {icon}
      <Text style={[styles.label, { color: look.ink, fontFamily: fonts.rounded.semibold }]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 48,
    minWidth: 48,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  pressed: { transform: [{ scale: 0.97 }] },
  label: { fontSize: 16, textAlign: 'center' },
})
