import { TASK_PAINTER } from '@logic/fillKinds'
import type { Ruleset } from '@logic/rulesets'
import { countedData, spoken, TASK_TITLES, taskFill, taskProgress, taskStatusLine, type BoardTask } from '@logic/taskStatus'
import type { DayTaskData, TaskId } from '@logic/types'
import { useEffect, useState, type ReactNode } from 'react'
import { Animated as NativeAnimated, Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type LayoutRectangle } from 'react-native'
import Animated, { Easing, FadeOut, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated'
import { Icon } from '../components/icons/Icon'
import type { IconName } from '../components/icons/icons'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useTheme } from '../theme/ThemeProvider'
import { withAlpha } from '../theme/tokens'
import { canAnimate } from './boardSettle'
import { TileFill, useBoardFills } from './fills/TileFill'

/** Each task's icon (the web's TASK_ICONS, src/screens/Today/taskTones.ts). */
export const TASK_ICONS: Record<BoardTask, IconName> = {
  workouts: 'workout',
  diet: 'diet',
  water: 'water',
  reading: 'reading',
  photo: 'photo',
  notes: 'notes',
}

/** The glow of a full tile, before it goes (the web's HOLD_MS). */
export const HOLD_MS = 380

/** A one-tap shortcut on a tile, next to opening its sheet ("+250 ml", the camera). */
export interface QuickAction {
  /** Said by VoiceOver ("Add 250 ml"). */
  label: string
  /** None for a text-only chip, e.g. the reading tile's "+10 pages", which must stay clear of the title on a narrow phone. */
  icon?: IconName
  text?: string
  onPress: () => void
}

/** How finely a tile's status counts up with its fill: water in 50 ml, pages one by one. */
function countSteps(task: TaskId, rules: Ruleset): number | undefined {
  if (task === 'water') return Math.round(rules.waterTargetMl / 50)
  if (task === 'reading') return rules.pagesTarget
  return undefined
}

interface TaskTileProps {
  task: TaskId
  data: DayTaskData
  rules: Ruleset
  complete: boolean
  bookTitle?: string
  /** Late in the evening: 'late' when it no longer fits before the deadline (a red edge), 'open' otherwise (a stronger edge). */
  urgency: 'none' | 'open' | 'late'
  /** One shortcut, or several stacked in the corner ("+1 page" over "+10 pages"). */
  quick?: QuickAction | QuickAction[]
  /** Controls on the tile's right (the diet switches); they report their box, which the fill starts from. */
  controls?: (onLayout: (event: LayoutChangeEvent) => void) => ReactNode
  /** The day's photo, for the iris. */
  imageUri?: string
  /** Full: the fill is complete, the tile glows once before it goes. */
  glowing?: boolean
  onSettledAt: (level: number | null) => void
  onOpen: () => void
}

/**
 * An open task: a tile that fills as the task progresses, opening its sheet on tap. The web's TaskTile
 * (src/screens/Today/TaskTile.tsx). Without a fill (a phone that can't draw one) a thin bar along the bottom shows
 * how far a measurable task is.
 */
export function TaskTile({ task, data, rules, complete, bookTitle, urgency, quick, controls, imageUri, glowing = false, onSettledAt, onOpen }: TaskTileProps) {
  const { colors, fonts, mode } = useTheme()
  const engine = useBoardFills()
  const kind = TASK_PAINTER[task]
  const hasFill = engine?.supports(kind) ?? false
  const level = taskFill(task, data, rules)
  const [shown, setShown] = useState<number | null>(null)
  const [settledAt, setSettledAt] = useState<number | null>(null)
  const [tile, setTile] = useState<LayoutRectangle>()
  const [corner, setCorner] = useState<LayoutRectangle>()
  const [control, setControl] = useState<LayoutRectangle>()

  // While the fill moves, water and pages count up with it; at rest the line tells the day as it is.
  // The engine reports a new level a frame late: until it has settled at this one, the line keeps counting.
  const counting = hasFill && shown !== null && settledAt !== level
  const status = taskStatusLine(task, counting ? countedData(task, data, rules, shown) : data, rules, complete && !counting, bookTitle)
  // The line that needs no slide-in: the first one, and the one a count-up lands on.
  const [quiet, setQuiet] = useState(status)
  const [wasCounting, setWasCounting] = useState(counting)
  if (counting !== wasCounting) {
    setWasCounting(counting)
    if (!counting) setQuiet(status)
  }
  const progress = taskProgress(task, data, rules)
  // Over a fill (a draining one too) the muted grey would drop under 4.5:1: the line takes the ink colour.
  // The book draws its open pages and their shaded gutter at 0 too, so its line is always over a fill.
  const overFill = hasFill && (kind === 'book' || level > 0 || (shown ?? 0) > 0)
  const edge =
    urgency === 'late'
      ? { borderWidth: 2, borderColor: colors.dangerInk }
      : urgency === 'open'
        ? { borderWidth: 2, borderColor: withAlpha(colors.ink, 0.3) }
        : { borderWidth: 1, borderColor: mode === 'light' ? withAlpha(colors.ink, 0.1) : 'transparent' }
  const shadow = hasFill ? { textShadowColor: colors.canvas, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 } : null
  const statusStyle = [
    styles.status,
    shadow,
    urgency !== 'none'
      ? { color: colors.ink, fontFamily: fonts.rounded.bold }
      : { color: overFill ? colors.ink : colors.inkMuted, fontFamily: fonts.rounded.semibold },
  ]

  // The control the fill starts from (the first chip in the corner, or the switches): points from the tile's right edge and from its top.
  const from = control ?? corner
  const anchor = tile && from ? { right: tile.width - (from.x + from.width / 2), top: control ? from.y + from.height / 2 : from.y + 24 } : undefined

  return (
    <Glow on={glowing} style={[styles.tile, { backgroundColor: colors.surface }, edge]} onLayout={(event) => setTile(event.nativeEvent.layout)}>
      {hasFill && (
        <TileFill
          kind={kind}
          level={level}
          steps={countSteps(task, rules)}
          imageUri={imageUri}
          anchor={anchor}
          onShown={setShown}
          onSettledAt={(at) => {
            setSettledAt(at)
            onSettledAt(at)
          }}
        />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${TASK_TITLES[task]}, ${spoken(taskStatusLine(task, data, rules, complete, bookTitle))}`}
        onPress={onOpen}
        style={styles.body}
      >
        <View style={[styles.well, { backgroundColor: colors.worldSoft }]}>
          <Icon name={TASK_ICONS[task]} size={20} color={colors.worldInk} />
        </View>
        <Text style={[styles.title, shadow, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>{TASK_TITLES[task]}</Text>
        {/* A change slides in; a count-up just ticks. */}
        {counting ? (
          <Text style={statusStyle}>{status}</Text>
        ) : (
          <SlideIn key={status} slide={status !== quiet}>
            <Text style={statusStyle}>{status}</Text>
          </SlideIn>
        )}
      </Pressable>
      {controls?.((event) => setControl(event.nativeEvent.layout))}
      {/* A full 48-point touch target around a small chip, so the shortcut never outshines the tile's title. A shortcut no longer needed fades away. */}
      <View style={styles.quick} onLayout={(event) => setCorner(event.nativeEvent.layout)}>
        {(quick ? [quick].flat() : []).map((action) => (
          <Animated.View key={action.label} exiting={FadeOut.duration(200)}>
            <Pressable accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} style={styles.quickTouch}>
              {({ pressed }) => (
                <View style={[styles.chip, { borderColor: withAlpha(colors.ink, 0.15), backgroundColor: colors.surface }, pressed && styles.pressed]}>
                  {action.icon && <Icon name={action.icon} size={14} color={colors.ink} />}
                  {action.text !== undefined && <Text style={[styles.chipText, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>{action.text}</Text>}
                </View>
              )}
            </Pressable>
          </Animated.View>
        ))}
      </View>
      {!hasFill && progress !== null && (
        <View pointerEvents="none" style={[styles.bar, { backgroundColor: mode === 'light' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)' }]}>
          <View testID={`progress-${task}`} style={[styles.barFill, { backgroundColor: colors.world, width: `${Math.round(progress * 100)}%` }]} />
        </View>
      )}
    </Glow>
  )
}

interface GlowProps {
  on: boolean
  style: object
  onLayout: (event: LayoutChangeEvent) => void
  children: ReactNode
}

/**
 * The tile, and the moment its fill is complete: a ring in the world's ink, a small swell and a brighter tile (the
 * web's `glow`, 500 ms with its peak at 45%). The web brightens the tile with a filter; here a veil of white does it.
 */
function Glow({ on, style, onLayout, children }: GlowProps) {
  const { colors } = useTheme()
  const reduceMotion = useReduceMotion()
  const peak = useSharedValue(0)
  useEffect(() => {
    if (!on || reduceMotion || !canAnimate()) return
    const ease = Easing.out(Easing.quad)
    peak.value = withSequence(withTiming(1, { duration: (HOLD_MS + 120) * 0.45, easing: ease }), withTiming(0, { duration: (HOLD_MS + 120) * 0.55, easing: ease }))
  }, [on, reduceMotion, peak])
  const swell = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.03 * peak.value }] }))
  const ring = useAnimatedStyle(() => ({ opacity: 0.8 * peak.value }))
  const veil = useAnimatedStyle(() => ({ opacity: 0.1 * peak.value }))
  return (
    <Animated.View style={[style, swell]} onLayout={onLayout}>
      {children}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.veil, veil]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.ring, { borderColor: colors.worldInk }, ring]} />
    </Animated.View>
  )
}

/** A status line that changed slides in (opacity 0.2 / 5 points lower, 240 ms); the first one, and the one a count-up lands on, don't. */
function SlideIn({ slide, children }: { slide: boolean; children: ReactNode }) {
  const reduceMotion = useReduceMotion()
  const moves = slide && !reduceMotion && canAnimate()
  const shown = useState(() => new NativeAnimated.Value(moves ? 0 : 1))[0]
  useEffect(() => {
    // In place at once, also when motion stops being allowed half way: never left faint.
    if (!moves) return shown.setValue(1)
    const sliding = NativeAnimated.timing(shown, { toValue: 1, duration: 240, useNativeDriver: true })
    sliding.start()
    return () => sliding.stop()
  }, [moves, shown])
  return (
    <NativeAnimated.View
      style={{
        opacity: shown.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }),
        transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) }],
      }}
    >
      {children}
    </NativeAnimated.View>
  )
}

const styles = StyleSheet.create({
  tile: { minHeight: 120, overflow: 'hidden', borderRadius: 20 },
  body: { flex: 1, minHeight: 120, alignItems: 'flex-start', padding: 12 },
  well: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  title: { marginTop: 'auto', paddingTop: 12, fontSize: 16, lineHeight: 20 },
  status: { marginTop: 2, fontSize: 12, lineHeight: 15 },
  quick: { position: 'absolute', top: 4, right: 4, alignItems: 'flex-end' },
  quickTouch: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  chip: { height: 32, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 16, borderWidth: 1, paddingHorizontal: 10 },
  chipText: { fontSize: 12 },
  pressed: { transform: [{ scale: 0.9 }] },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4 },
  barFill: { height: '100%' },
  veil: { backgroundColor: '#ffffff' },
  ring: { borderWidth: 2, borderRadius: 20 },
})
