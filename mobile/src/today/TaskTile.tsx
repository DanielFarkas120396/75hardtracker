import type { Ruleset } from '@logic/rulesets'
import { spoken, TASK_TITLES, taskProgress, taskStatusLine, type BoardTask } from '@logic/taskStatus'
import type { DayTaskData, TaskId } from '@logic/types'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Icon } from '../components/icons/Icon'
import type { IconName } from '../components/icons/icons'
import { useTheme } from '../theme/ThemeProvider'
import { withAlpha } from '../theme/tokens'

/** Each task's icon (the web's TASK_ICONS, src/screens/Today/taskTones.ts). */
export const TASK_ICONS: Record<BoardTask, IconName> = {
  workouts: 'workout',
  diet: 'diet',
  water: 'water',
  reading: 'reading',
  photo: 'photo',
  notes: 'notes',
}

/** A one-tap shortcut on a tile, next to opening its sheet ("+250 ml", the camera). */
export interface QuickAction {
  /** Said by VoiceOver ("Add 250 ml"). */
  label: string
  /** None for a text-only chip, e.g. the reading tile's "+10 pages", which must stay clear of the title on a narrow phone. */
  icon?: IconName
  text?: string
  onPress: () => void
}

interface TaskTileProps {
  task: TaskId
  data: DayTaskData
  rules: Ruleset
  bookTitle?: string
  /** Late in the evening: 'late' when it no longer fits before the deadline (a red edge), 'open' otherwise (a stronger edge). */
  urgency: 'none' | 'open' | 'late'
  /** One shortcut, or several stacked in the corner ("+1 page" over "+10 pages"). */
  quick?: QuickAction | QuickAction[]
  /** Controls on the tile's right (the diet switches). */
  controls?: ReactNode
  onOpen: () => void
}

/**
 * An open task: a tile that opens its sheet on tap. The web's TaskTile
 * (src/screens/Today/TaskTile.tsx) as it looks without its fill: a thin bar
 * along the bottom shows how far a measurable task is. The fills come with part 4c.
 */
export function TaskTile({ task, data, rules, bookTitle, urgency, quick, controls, onOpen }: TaskTileProps) {
  const { colors, fonts, mode } = useTheme()
  const status = taskStatusLine(task, data, rules, false, bookTitle)
  const progress = taskProgress(task, data, rules)
  const edge =
    urgency === 'late'
      ? { borderWidth: 2, borderColor: colors.dangerInk }
      : urgency === 'open'
        ? { borderWidth: 2, borderColor: withAlpha(colors.ink, 0.3) }
        : { borderWidth: 1, borderColor: mode === 'light' ? withAlpha(colors.ink, 0.1) : 'transparent' }

  return (
    <View style={[styles.tile, { backgroundColor: colors.surface }, edge]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${TASK_TITLES[task]}, ${spoken(status)}`}
        onPress={onOpen}
        style={styles.body}
      >
        <View style={[styles.well, { backgroundColor: colors.worldSoft }]}>
          <Icon name={TASK_ICONS[task]} size={20} color={colors.worldInk} />
        </View>
        <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>{TASK_TITLES[task]}</Text>
        <Text
          style={[
            styles.status,
            urgency === 'none'
              ? { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }
              : { color: colors.ink, fontFamily: fonts.rounded.bold },
          ]}
        >
          {status}
        </Text>
      </Pressable>
      {controls}
      {/* A full 48-point touch target around a small chip, so the shortcut never outshines the tile's title. */}
      <View style={styles.quick}>
        {(quick ? [quick].flat() : []).map((action) => (
          <Pressable key={action.label} accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} style={styles.quickTouch}>
            {({ pressed }) => (
              <View
                style={[
                  styles.chip,
                  { borderColor: withAlpha(colors.ink, 0.15), backgroundColor: colors.surface },
                  pressed && styles.pressed,
                ]}
              >
                {action.icon && <Icon name={action.icon} size={14} color={colors.ink} />}
                {action.text !== undefined && <Text style={[styles.chipText, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>{action.text}</Text>}
              </View>
            )}
          </Pressable>
        ))}
      </View>
      {progress !== null && (
        <View pointerEvents="none" style={[styles.bar, { backgroundColor: mode === 'light' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)' }]}>
          <View testID={`progress-${task}`} style={[styles.barFill, { backgroundColor: colors.world, width: `${Math.round(progress * 100)}%` }]} />
        </View>
      )}
    </View>
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
})
