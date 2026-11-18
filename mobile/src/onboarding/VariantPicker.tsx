import { RULESETS, VARIANTS, type ChallengeVariant } from '@logic/rulesets'
import { JOKER_DEFINITION, VARIANT_NAMES, VARIANT_SUMMARIES, VARIANT_TAGLINES, variantHighlights } from '@logic/variantsCopy'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { withAlpha } from '../theme/tokens'

interface VariantPickerProps {
  /** null: nothing picked yet. */
  value: ChallengeVariant | null
  onChange: (variant: ChallengeVariant) => void
  disabled?: boolean
}

/**
 * The four challenges as a radio group: a card per variant, with its name, a
 * tagline and the same three chips (workouts, weekly allowance, jokers). The
 * selected card also shows its full rules. The web's VariantPicker.
 */
export function VariantPicker({ value, onChange, disabled = false }: VariantPickerProps) {
  const { colors, fonts } = useTheme()
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Challenge" style={styles.group}>
      {VARIANTS.map((variant) => {
        const checked = variant === value
        const rules = RULESETS[variant]
        return (
          <Pressable
            key={variant}
            accessibilityRole="radio"
            accessibilityLabel={`${VARIANT_NAMES[variant]}. ${VARIANT_TAGLINES[variant]}`}
            accessibilityState={{ checked, disabled }}
            disabled={disabled}
            onPress={() => onChange(variant)}
            style={[
              styles.card,
              checked
                ? { borderColor: colors.worldEdge, backgroundColor: colors.worldSoft, borderWidth: 2 }
                : { borderColor: withAlpha(colors.ink, 0.15), backgroundColor: colors.canvas },
              disabled && styles.disabled,
            ]}
          >
            <Text style={[styles.name, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>{VARIANT_NAMES[variant]}</Text>
            <Text style={[styles.tagline, { color: checked ? colors.worldInk : colors.inkMuted, fontFamily: fonts.rounded.bold }]}>
              {VARIANT_TAGLINES[variant]}
            </Text>
            <View style={styles.chips}>
              {variantHighlights(rules).map((highlight) => (
                <Text
                  key={highlight}
                  style={[styles.chip, { backgroundColor: colors.surface, color: colors.ink, fontFamily: fonts.rounded.bold }]}
                >
                  {highlight}
                </Text>
              ))}
            </View>
            {checked && (
              <Text style={[styles.summary, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>
                {rules.jokers > 0 ? `${JOKER_DEFINITION} ` : ''}
                {VARIANT_SUMMARIES[variant]}
              </Text>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  group: { alignSelf: 'stretch', gap: 8 },
  card: { minHeight: 48, borderRadius: 16, borderWidth: 1, padding: 12 },
  disabled: { opacity: 0.5 },
  name: { fontSize: 18 },
  tagline: { fontSize: 14 },
  chips: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, fontSize: 12 },
  summary: { marginTop: 8, fontSize: 12, lineHeight: 17 },
})
