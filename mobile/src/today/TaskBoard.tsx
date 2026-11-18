import { TASK_IDS } from '@logic/dayCompletion'
import { minutesToFinish } from '@logic/menace'
import type { Ruleset } from '@logic/rulesets'
import { spoken, TASK_TITLES, taskStatusLine, type BoardTask } from '@logic/taskStatus'
import type { DayTaskData, TaskId } from '@logic/types'
import { dietToggleLabel } from '@logic/variantsCopy'
import * as Haptics from 'expo-haptics'
import { useEffect, useRef } from 'react'
import { AccessibilityInfo, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { Icon } from '../components/icons/Icon'
import { Track } from '../components/ui/controls'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import type { DayEntry } from '../db/types'
import { useTheme } from '../theme/ThemeProvider'
import { withAlpha } from '../theme/tokens'
import { TASK_ICONS, TaskTile, type QuickAction } from './TaskTile'

export type { QuickAction } from './TaskTile'

interface TaskBoardProps {
  entry: DayEntry
  data: DayTaskData
  completion: Record<TaskId, boolean>
  rules: Ruleset
  /** The book being read, for the done reading chip. */
  bookTitle?: string
  /** The day's photo, as an address an image can load: the done photo chip's thumbnail. */
  photoUri?: string
  /** Shortcuts on the tiles that have one. */
  quickActions?: Partial<Record<BoardTask, QuickAction | QuickAction[]>>
  /** A declared social occasion today: the diet tile shows a glass instead of the alcohol switch. */
  socialToday?: boolean
  /** Late in the evening with tasks left (the duck tapping or hunting): the open tiles get an edge. */
  urgent?: boolean
  /** Minutes until the evening's deadline (bedtime, then midnight), when urgent: a task that no longer fits gets a red edge. */
  minutesLeft?: number
  onOpen: (task: BoardTask) => void
}

/** A day with nothing logged: the tiles sort by what a task takes in full, so they never move as it progresses. */
const FRESH_DAY: DayTaskData = { water_ml: 0, pages_read: 0, dietFollowed: false, noAlcohol: false, hasPhoto: false, workouts: [] }

/**
 * The five tasks of a day (mood and notes live outside the board: they're
 * optional and never "done"). The open ones are tiles, the quickest kind
 * first, each opening its sheet on tap; the done ones are chips above them.
 * The web's TaskBoard (src/screens/Today/TaskBoard.tsx) on its path without
 * animation: a done task is a chip at once. Its tile filling up, glowing and
 * shrinking into the chip comes with part 4c.
 */
export function TaskBoard(props: TaskBoardProps) {
  const { entry, data, completion, rules, bookTitle, photoUri, quickActions, socialToday = false, urgent = false, minutesLeft, onOpen } = props
  const { colors, fonts, mode } = useTheme()

  // A task done from the board itself (a switch, a shortcut): its tile leaves for a chip, so it is said, and felt.
  const doneNow = TASK_IDS.filter((task) => completion[task]).join()
  const doneBefore = useRef(doneNow)
  useEffect(() => {
    const before = doneBefore.current.split(',')
    doneBefore.current = doneNow
    const done = TASK_IDS.find((task) => doneNow.split(',').includes(task) && !before.includes(task))
    if (!done) return
    AccessibilityInfo.announceForAccessibility(`${TASK_TITLES[done]} done.`)
    // Not every phone can; the day doesn't depend on it.
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
  }, [doneNow])

  const byTime = (a: TaskId, b: TaskId) => minutesToFinish(a, FRESH_DAY, rules) - minutesToFinish(b, FRESH_DAY, rules)
  const open = TASK_IDS.filter((task) => !completion[task]).sort(byTime)
  const chips = TASK_IDS.filter((task) => completion[task])
  const wontFit = (task: TaskId) => minutesLeft !== undefined && minutesToFinish(task, data, rules) > minutesLeft
  const statusOf = (task: TaskId) => taskStatusLine(task, data, rules, completion[task], bookTitle)

  return (
    <View accessibilityLabel="Tasks">
      {chips.length > 0 && (
        <View style={styles.chips}>
          {chips.map((task) => (
            <Pressable
              key={task}
              accessibilityRole="button"
              accessibilityLabel={`${TASK_TITLES[task]}, ${spoken(statusOf(task))}, done`}
              onPress={() => onOpen(task)}
              style={[
                styles.chip,
                { backgroundColor: colors.surface, borderColor: mode === 'light' ? withAlpha(colors.ink, 0.1) : 'transparent' },
              ]}
            >
              {task === 'photo' && photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.thumb} />
              ) : (
                <Icon name={TASK_ICONS[task]} size={16} color={colors.inkMuted} />
              )}
              <Text style={[styles.chipLabel, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}>{TASK_TITLES[task]}</Text>
              <Text style={[styles.chipLabel, { color: colors.greenInk, fontFamily: fonts.rounded.semibold }]}>✓</Text>
            </Pressable>
          ))}
        </View>
      )}
      {open.length > 0 && (
        <View style={styles.grid}>
          {/* Two to a row; the odd tile out at the end takes the whole row. */}
          {open.map((task) => (
            <View key={task} style={styles.cell}>
              <TaskTile
                task={task}
                data={data}
                rules={rules}
                bookTitle={bookTitle}
                urgency={!urgent ? 'none' : wontFit(task) ? 'late' : 'open'}
                quick={quickActions?.[task]}
                controls={task === 'diet' ? <DietSwitches entry={entry} rules={rules} socialToday={socialToday} /> : undefined}
                onOpen={() => onOpen(task)}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

interface DietSwitchesProps {
  entry: DayEntry
  rules: Ruleset
  /** A declared social occasion: the plain glass takes the alcohol switch's place. */
  socialToday: boolean
}

/** The diet tile's two switches, stacked on its right with a gap, so a near-miss doesn't open the sheet. Each has a short visible label. */
function DietSwitches({ entry, rules, socialToday }: DietSwitchesProps) {
  const { colors } = useTheme()
  return (
    <View style={styles.switches}>
      <MiniSwitch
        label={dietToggleLabel(rules)}
        text="Diet"
        checked={entry.dietFollowed}
        onChange={(checked) => void dayEntryRepo.update(entry.id, { dietFollowed: checked })}
      />
      {socialToday ? (
        <View style={styles.glass}>
          <Icon name="drink" size={22} color={colors.ink} label="Social night today — a drink is allowed" />
        </View>
      ) : (
        <MiniSwitch
          label="No alcohol"
          text="No drink"
          checked={entry.noAlcohol}
          onChange={(checked) => void dayEntryRepo.update(entry.id, { noAlcohol: checked })}
        />
      )}
    </View>
  )
}

interface MiniSwitchProps {
  /** The switch's name for VoiceOver ("No alcohol"). */
  label: string
  /** The short label shown beside the track ("No drink"). */
  text: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function MiniSwitch({ label, text, checked, onChange }: MiniSwitchProps) {
  const { colors, fonts } = useTheme()
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={styles.mini}
    >
      <Text style={[styles.miniText, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>{text}</Text>
      <Track checked={checked} on={colors.greenInk} width={32} height={20} thumb={16} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chips: { marginBottom: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 24, borderWidth: 1, paddingHorizontal: 12 },
  chipLabel: { fontSize: 14 },
  thumb: { width: 24, height: 24, borderRadius: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { flexBasis: '40%', flexGrow: 1 },
  switches: { position: 'absolute', top: 0, bottom: 0, right: 8, alignItems: 'flex-end', justifyContent: 'center', gap: 2 },
  mini: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6, paddingRight: 4 },
  miniText: { fontSize: 12 },
  glass: { height: 48, width: 36, alignItems: 'center', justifyContent: 'center', paddingRight: 4 },
})
