import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../../theme/ThemeProvider'

interface FieldProps {
  label: string
  unit?: string
  error?: string
  children: ReactNode
}

/** A labelled form field, with an optional unit after the label and an error message under the input. */
export function Field({ label, unit, error, children }: FieldProps) {
  const { colors, fonts } = useTheme()
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}>
        {unit ? `${label} (${unit})` : label}
      </Text>
      {children}
      {error !== undefined && (
        <Text accessibilityRole="alert" style={[styles.label, { color: colors.dangerInk, fontFamily: fonts.rounded.semibold }]}>
          {error}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  field: { marginTop: 12, gap: 4 },
  label: { fontSize: 14 },
})
