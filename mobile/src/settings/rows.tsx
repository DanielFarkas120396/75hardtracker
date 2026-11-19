import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'
import { Icon } from '../components/icons/Icon'
import type { IconName } from '../components/icons/icons'
import { useTheme } from '../theme/ThemeProvider'
import { withAlpha } from '../theme/tokens'

// The web's Settings parts (src/screens/Settings/SettingsRows.tsx), and the small pieces every page shares.

/** A titled group of rows, like a section of iPhone Settings, with an optional note under it. */
export function SettingsGroup({ title, footer, children }: { title: string; footer?: string; children: ReactNode }) {
  const { colors, fonts } = useTheme()
  return (
    <View accessibilityLabel={title}>
      <Text accessibilityRole="header" style={[styles.groupTitle, { color: colors.inkMuted, fontFamily: fonts.rounded.bold }]}>
        {title.toUpperCase()}
      </Text>
      <View style={[styles.group, { backgroundColor: colors.surface, borderColor: withAlpha(colors.ink, 0.1) }]}>{children}</View>
      {footer !== undefined && <Text style={[styles.footer, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>{footer}</Text>}
    </View>
  )
}

interface SettingsRowProps {
  icon: IconName
  label: string
  /** The current value, shown muted before the chevron ("Dark", "22:30"). */
  value?: string
  onPress: () => void
  /** Red, for the danger zone; no chevron, since it opens a confirmation rather than a page. */
  danger?: boolean
}

/** A compact row: icon, label, current value and a chevron. Tapping it opens its page (or flow). */
export function SettingsRow({ icon, label, value, onPress, danger = false }: SettingsRowProps) {
  const { colors, fonts } = useTheme()
  const tone = danger ? colors.dangerInk : colors.ink
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { borderTopColor: withAlpha(colors.ink, 0.1) }, pressed && { backgroundColor: withAlpha(colors.ink, 0.05) }]}
    >
      <View style={[styles.well, { backgroundColor: danger ? withAlpha(colors.danger, 0.15) : colors.worldSoft }]}>
        <Icon name={icon} size={20} color={danger ? colors.dangerInk : colors.worldInk} />
      </View>
      <Text style={[styles.label, { color: tone, fontFamily: fonts.rounded.bold }]}>{label}</Text>
      {value !== undefined && (
        <Text numberOfLines={1} style={[styles.value, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}>
          {value}
        </Text>
      )}
      {!danger && <Icon name="chevron" size={18} color={colors.inkMuted} />}
    </Pressable>
  )
}

/** A settings page opened from a row: a back button, its title, then its controls. */
export function SettingsPage({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  const { colors, fonts } = useTheme()
  return (
    <>
      <View style={styles.pageHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={onBack} style={styles.back}>
          <View style={styles.flip}>
            <Icon name="chevron" size={18} color={colors.worldInk} />
          </View>
          <Text style={[styles.backLabel, { color: colors.worldInk, fontFamily: fonts.rounded.bold }]}>Settings</Text>
        </Pressable>
        <Text accessibilityRole="header" style={[styles.pageTitle, { color: colors.ink, fontFamily: fonts.display.semibold }]}>
          {title}
        </Text>
      </View>
      <View style={styles.pageBody}>{children}</View>
    </>
  )
}

/** A page's white card. */
export function Card({ children, gap = 0 }: { children: ReactNode; gap?: number }) {
  const { colors } = useTheme()
  return <View style={[styles.card, { gap, backgroundColor: colors.surface, borderColor: withAlpha(colors.ink, 0.1) }]}>{children}</View>
}

/** A card's heading. */
export function CardTitle({ children }: { children: ReactNode }) {
  const { colors, fonts } = useTheme()
  return (
    <Text accessibilityRole="header" style={[styles.cardTitle, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>
      {children}
    </Text>
  )
}

/** Muted body text; `size` 14 (the web's text-sm) or 12 (text-xs). */
export function Muted({ children, size = 14, top = 4 }: { children: ReactNode; size?: 12 | 14; top?: number }) {
  const { colors, fonts } = useTheme()
  return <Text style={{ marginTop: top, fontSize: size, lineHeight: size + 6, color: colors.inkMuted, fontFamily: fonts.rounded.regular }}>{children}</Text>
}

/** A line that says how a save went ("Saved.") or what is wrong, in red when `error`. */
export function StatusLine({ children, error = false }: { children: ReactNode; error?: boolean }) {
  const { colors, fonts } = useTheme()
  return (
    <Text
      accessibilityRole={error ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      style={[styles.status, { color: error ? colors.dangerInk : colors.inkMuted, fontFamily: fonts.rounded.semibold }]}
    >
      {children}
    </Text>
  )
}

/** A text field in the pages' look: 16 pt or more, so iOS doesn't zoom. */
export function Input(props: TextInputProps & { accessibilityLabel: string }) {
  const { colors, fonts } = useTheme()
  return (
    <TextInput
      placeholderTextColor={colors.inkMuted}
      {...props}
      style={[styles.input, props.multiline && styles.multiline, { backgroundColor: colors.canvas, color: colors.ink, fontFamily: fonts.rounded.bold }]}
    />
  )
}

/** A sheet's question and its two buttons, side by side (the web's confirmation dialogs). */
export function Confirm({ title, body, children }: { title: string; body?: string; children: ReactNode }) {
  const { colors, fonts } = useTheme()
  return (
    <View>
      <Text accessibilityRole="header" style={[styles.cardTitle, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>
        {title}
      </Text>
      {body !== undefined && <Muted top={8}>{body}</Muted>}
      <View style={styles.buttons}>{children}</View>
    </View>
  )
}

export const settingsStyles = StyleSheet.create({
  flex: { flex: 1 },
  top: { marginTop: 12 },
  stack: { marginTop: 12, gap: 8 },
})

const styles = StyleSheet.create({
  groupTitle: { marginBottom: 6, paddingHorizontal: 16, fontSize: 12, letterSpacing: 0.6 },
  group: { overflow: 'hidden', borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, marginTop: -StyleSheet.hairlineWidth },
  footer: { marginTop: 6, paddingHorizontal: 16, fontSize: 12, lineHeight: 17 },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  well: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  label: { flex: 1, fontSize: 16 },
  value: { maxWidth: '40%', fontSize: 14 },
  pageHeader: { paddingTop: 8, paddingBottom: 12 },
  back: { minHeight: 48, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: -8, paddingHorizontal: 8 },
  flip: { transform: [{ rotate: '180deg' }] },
  backLabel: { fontSize: 16 },
  pageTitle: { fontSize: 30 },
  pageBody: { gap: 16 },
  card: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  cardTitle: { fontSize: 18 },
  status: { marginTop: 8, fontSize: 14 },
  input: { minHeight: 48, borderRadius: 12, paddingHorizontal: 12, fontSize: 16 },
  multiline: { minHeight: 72, paddingTop: 12, textAlignVertical: 'top' },
  buttons: { marginTop: 16, flexDirection: 'row', gap: 8 },
})
