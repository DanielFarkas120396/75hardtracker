import { useEffect, useEffectEvent } from 'react'
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeOutUp, SlideInUp, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Icon } from '../components/icons/Icon'
import { useCoverShown, useLockStatus } from '../lock/store'
import { useTheme } from '../theme/ThemeProvider'
import { withAlpha } from '../theme/tokens'
import { dismissBadge, dismissSaveFailure, useToastState } from './store'

export interface Toast {
  id: string
  title: string
  detail?: string
  /** A failure: drawn in the danger colour. */
  error?: boolean
  /** How long it stays in front before going away on its own. */
  durationMs: number
  /** Bumped when the same toast fires again, so its timer starts over. */
  stamp?: number
}

/** Quicker while others wait behind: an import or a catch-up can unlock many badges at once. */
const QUEUED_MAX_MS = 3000
/** The front toast and the ones peeking out behind it. */
const STACK_DEPTH = 3
/** How far each card behind sits below the one in front of it, and how much smaller it is. */
const PEEK = 9
const PEEK_SCALE = 0.05

const SAVE_ERROR_ID = 'save-error'
const BADGE_PREFIX = 'badge:'

/** The app's toasts in order (the first in front): a failed save, then the badges (hidden under the lock or while paused). */
export function useToasts(): Toast[] {
  const { badges, saveFailures, badgesPaused } = useToastState()
  const lock = useLockStatus()
  const covered = useCoverShown()
  return [
    ...(saveFailures > 0
      ? [{ id: SAVE_ERROR_ID, title: "Couldn't save that", detail: 'Try again. If it keeps happening, your phone may be full.', error: true, durationMs: 6000, stamp: saveFailures }]
      : []),
    ...(lock !== 'open' || covered || badgesPaused
      ? []
      : badges.map((badge) => ({ id: BADGE_PREFIX + badge.id, title: `Badge unlocked: ${badge.name}`, detail: badge.description, durationMs: 4500 }))),
  ]
}

function dismiss(id: string): void {
  if (id === SAVE_ERROR_ID) dismissSaveFailure()
  else dismissBadge(id.slice(BADGE_PREFIX.length))
}

/**
 * The app's toasts as one stack, pinned to the top below the Dynamic Island: the first in front, the next ones
 * peeking out behind it. Only the front one counts down; a tap sends it away early, and the next slides forward.
 * Drawn after the lock screen, so a failed save shows over it. The web's ToastStack.
 */
export function ToastStack() {
  const toasts = useToasts()
  const insets = useSafeAreaInsets()
  const front = toasts[0]
  const queued = toasts.length > 1
  const dismissFront = useEffectEvent((id: string) => dismiss(id))

  // One timer, for the front toast only; it restarts when a new toast comes forward (or the same one fires again).
  const frontId = front?.id
  const frontStamp = front?.stamp
  const frontMs = front ? (queued ? Math.min(front.durationMs, QUEUED_MAX_MS) : front.durationMs) : 0
  const frontLine = front ? `${front.title}${front.detail ? `. ${front.detail}` : ''}` : ''
  useEffect(() => {
    if (!frontId) return
    const timer = setTimeout(() => dismissFront(frontId), frontMs)
    return () => clearTimeout(timer)
  }, [frontId, frontStamp, frontMs])
  // The iPhone has no live regions: the toast coming forward is said aloud.
  useEffect(() => {
    if (frontLine !== '') AccessibilityInfo.announceForAccessibility(frontLine)
  }, [frontLine, frontStamp])

  return (
    <View pointerEvents="box-none" style={[styles.layer, { top: insets.top + 16 }]}>
      <View pointerEvents="box-none" style={styles.column}>
        {toasts
          .slice(0, STACK_DEPTH)
          .map((toast, depth) => ({ toast, depth }))
          // The front card last, so it is drawn on top.
          .reverse()
          .map(({ toast, depth }) => (
            <ToastCard key={toast.id} toast={toast} depth={depth} />
          ))}
      </View>
    </View>
  )
}

function ToastCard({ toast, depth }: { toast: Toast; depth: number }) {
  const { colors, fonts } = useTheme()
  const placed = useAnimatedStyle(() => ({
    opacity: withSpring(depth === 0 ? 1 : 0.75 - (depth - 1) * 0.25),
    transform: [{ translateY: withSpring(depth * PEEK, { stiffness: 300, damping: 26 }) }, { scale: withSpring(1 - depth * PEEK_SCALE) }],
  }))
  const tone = toast.error ? colors.dangerInk : colors.worldInk
  const line = `${toast.title}${toast.detail ? `. ${toast.detail}` : ''}`
  return (
    <Animated.View
      entering={SlideInUp.springify().damping(26).stiffness(300)}
      exiting={FadeOutUp.duration(200)}
      style={[styles.card, depth > 0 && styles.behind, { backgroundColor: colors.surface, borderColor: toast.error ? colors.dangerInk : withAlpha(colors.world, 0.3) }, placed]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={depth === 0 ? `${line} Tap to dismiss.` : undefined}
        accessibilityElementsHidden={depth > 0}
        importantForAccessibility={depth > 0 ? 'no-hide-descendants' : 'auto'}
        disabled={depth > 0}
        onPress={() => dismiss(toast.id)}
        style={styles.press}
      >
        {/* The cards behind are empty: only their edges peek out. */}
        <View style={[styles.row, depth > 0 && styles.hidden]}>
          <View style={[styles.well, { backgroundColor: toast.error ? withAlpha(colors.danger, 0.1) : colors.worldSoft }]}>
            <Icon name={toast.error ? 'warning' : 'badge'} size={20} color={tone} />
          </View>
          <View style={styles.text}>
            <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>{toast.title}</Text>
            {toast.detail !== undefined && <Text style={[styles.detail, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}>{toast.detail}</Text>}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  column: { width: '100%', maxWidth: 320 },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    transformOrigin: 'top',
  },
  // Behind the front card: in the same place and stretched to its height, so every edge peeks out the same.
  behind: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  press: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hidden: { opacity: 0 },
  well: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  text: { flex: 1 },
  title: { fontSize: 14 },
  detail: { fontSize: 12 },
})
