import { comparePair, frameMs, frameMsToSpeed, speedToFrameMs } from '@logic/photoCompare'
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { Image, PanResponder, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type GestureResponderEvent } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { RangeSlider } from '../components/ui/RangeSlider'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useTheme } from '../theme/ThemeProvider'
import { CloseButton, PillButton } from './parts'
import type { GalleryEntry } from './useGalleryPhotos'

interface PhotoCompareProps {
  /** This attempt's photos, oldest first: at least two. */
  entries: readonly GalleryEntry[]
  onClose: () => void
}

type Side = 'earlier' | 'later'

/** The time-lapse plays after this long even if some pictures haven't loaded (the web's DECODE_WAIT_MS). */
export const PRELOAD_WAIT_MS = 3000

/**
 * This attempt's photos side by side in time: a slider over two of them, or a time-lapse of them all. The web's
 * PhotoCompare (src/screens/Gallery/PhotoCompare.tsx). Drawn inside the Gallery's one overlay.
 */
export function PhotoCompare({ entries, onClose }: PhotoCompareProps) {
  const [mode, setMode] = useState<'slider' | 'timelapse'>('slider')
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  // Close to the camera's frame (2:3): no taller than 70% of the screen, and clear of Close above it (with room for the
  // strip and the pills below).
  const room = Math.min(height * 0.7, height - 2 * (Math.max(16, insets.top) + 56) - 120)
  const frameWidth = Math.min(width - 32, room * (2 / 3))
  return (
    <View accessibilityLabel="Compare photos" style={styles.view}>
      <Pressable testID="compare-backdrop" accessible={false} onPress={onClose} style={StyleSheet.absoluteFill} />
      <View pointerEvents="box-none" style={styles.centre}>
        <View style={[styles.column, { width: frameWidth }]}>
          {mode === 'slider' ? <Slider entries={entries} frameWidth={frameWidth} /> : <TimeLapse entries={entries} frameWidth={frameWidth} />}
          <View style={styles.row}>
            <PillButton label="Slider" selected={mode === 'slider'} onPress={() => setMode('slider')} />
            <PillButton label="Time-lapse" selected={mode === 'timelapse'} onPress={() => setMode('timelapse')} />
          </View>
        </View>
      </View>
      <CloseButton onPress={onClose} />
    </View>
  )
}

function Slider({ entries, frameWidth }: { entries: readonly GalleryEntry[]; frameWidth: number }) {
  const { colors, fonts } = useTheme()
  const [picked, setPicked] = useState<Partial<Record<Side, number>>>({})
  const [split, setSplit] = useState(50)
  const [picking, setPicking] = useState<Side | null>(null)
  const [earlier, later] = comparePair(entries, picked.earlier, picked.later)
  const shown: Record<Side, GalleryEntry> = { earlier, later }
  const days = later.dayNumber - earlier.dayNumber

  // The line follows a finger put down anywhere on the photos (whose box is the frame's, so locationX is the frame's).
  // A touch that starts on a side's label stays the label's: the frame never takes it over mid-way.
  const drag = useMemo(() => {
    const follow = (event: GestureResponderEvent) => setSplit(Math.round(Math.min(100, Math.max(0, (event.nativeEvent.locationX / frameWidth) * 100))))
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => false,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: follow,
      onPanResponderMove: follow,
    })
  }, [frameWidth])

  const pick = (side: Side, id: number) => {
    setPicked({ earlier: earlier.photo.id, later: later.photo.id, [side]: id })
    setPicking(null)
  }
  const cut = (frameWidth * split) / 100

  return (
    <>
      <View testID="compare-frame" style={[styles.frame, { width: frameWidth, height: frameWidth * 1.5 }]} {...drag.panHandlers}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`Compare Day ${earlier.dayNumber} and Day ${later.dayNumber}`}
          accessibilityValue={{ text: `${split}%` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => setSplit(Math.min(100, Math.max(0, split + (event.nativeEvent.actionName === 'increment' ? 10 : -10))))}
          style={StyleSheet.absoluteFill}
        >
          <Image source={{ uri: earlier.photo.uri }} accessibilityLabel={`Day ${earlier.dayNumber} progress`} style={StyleSheet.absoluteFill} />
          <View testID="compare-later" style={[styles.later, { left: cut }]}>
            <Image source={{ uri: later.photo.uri }} accessibilityLabel={`Day ${later.dayNumber} progress`} style={[styles.laterPhoto, { width: frameWidth, left: -cut }]} />
          </View>
        </View>
        <View pointerEvents="none" style={[styles.line, { left: cut - 1, backgroundColor: colors.world }]}>
          <View style={[styles.knob, { borderColor: colors.world }]} />
        </View>
        {(['earlier', 'later'] as const).map((side) => (
          <Pressable
            key={side}
            accessibilityRole="button"
            accessibilityLabel={`Change the ${side} day, Day ${shown[side].dayNumber}`}
            accessibilityState={{ expanded: picking === side }}
            onPress={() => setPicking(picking === side ? null : side)}
            style={[styles.sideLabel, side === 'earlier' ? { left: 8 } : { right: 8 }, { backgroundColor: picking === side ? colors.world : 'rgba(0, 0, 0, 0.6)' }]}
          >
            <Text style={[styles.sideText, { color: picking === side ? colors.onWorld : '#ffffff', fontFamily: fonts.rounded.bold }]}>Day {shown[side].dayNumber}</Text>
          </Pressable>
        ))}
      </View>

      {picking ? (
        <DayStrip width={frameWidth} entries={entries} current={shown[picking]} other={shown[picking === 'earlier' ? 'later' : 'earlier']} onPick={(id) => pick(picking, id)} />
      ) : (
        <Text style={[styles.summary, { fontFamily: fonts.rounded.bold }]}>
          Day {earlier.dayNumber} → Day {later.dayNumber} · {days} {days === 1 ? 'day' : 'days'}
        </Text>
      )}
    </>
  )
}

interface DayStripProps {
  /** The strip's width: the frame's, known before anything is laid out. */
  width: number
  entries: readonly GalleryEntry[]
  /** The side's day, marked. */
  current: GalleryEntry
  /** The other side's day, which can't be picked. */
  other: GalleryEntry
  onPick: (photoId: number) => void
}

function DayStrip({ width, entries, current, other, onPick }: DayStripProps) {
  const { colors, fonts } = useTheme()
  const strip = useRef<ComponentRef<typeof ScrollView>>(null)
  return (
    <ScrollView ref={strip} horizontal showsHorizontalScrollIndicator={false} style={{ width }} contentContainerStyle={styles.strip}>
      {entries.map((entry) => {
        const marked = entry === current
        return (
          <Pressable
            key={entry.photo.id}
            accessibilityRole="button"
            accessibilityLabel={`Day ${entry.dayNumber}`}
            accessibilityState={{ selected: marked, disabled: entry === other }}
            disabled={entry === other}
            onPress={() => onPick(entry.photo.id)}
            // Opens with the side's day in the middle, not at the start of a long attempt.
            onLayout={marked ? (e) => strip.current?.scrollTo({ x: Math.max(0, e.nativeEvent.layout.x - (width - e.nativeEvent.layout.width) / 2), animated: false }) : undefined}
            style={[styles.stripDay, { borderColor: marked ? colors.world : 'transparent', opacity: entry === other ? 0.3 : 1 }]}
          >
            <Image source={{ uri: entry.photo.uri }} style={StyleSheet.absoluteFill} />
            <Text style={[styles.stripNumber, { fontFamily: fonts.rounded.bold }]}>{entry.dayNumber}</Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

function TimeLapse({ entries, frameWidth }: { entries: readonly GalleryEntry[]; frameWidth: number }) {
  const { fonts } = useTheme()
  const reduceMotion = useReduceMotion()
  const last = entries.length - 1
  const ready = usePreloaded(entries)
  const [index, setIndex] = useState(reduceMotion ? last : 0)
  const [playing, setPlaying] = useState(!reduceMotion)
  const [ms, setMs] = useState(() => frameMs(entries.length))
  const at = Math.min(index, last)
  const running = playing && at < last
  const entry = entries[at]

  useEffect(() => {
    if (!ready || !running) return
    const timer = setTimeout(() => setIndex(at + 1), ms)
    return () => clearTimeout(timer)
  }, [ready, running, at, ms])

  return (
    <>
      <View style={[styles.frame, { width: frameWidth, height: frameWidth * 1.5 }]}>
        {ready ? (
          <Image source={{ uri: entry.photo.uri }} accessible accessibilityLabel={`Day ${entry.dayNumber} progress`} style={StyleSheet.absoluteFill} />
        ) : (
          <Text style={[styles.loading, { fontFamily: fonts.rounded.regular }]}>Loading…</Text>
        )}
        <Text accessibilityElementsHidden importantForAccessibility="no" style={[styles.bigDay, { fontFamily: fonts.display.semibold }]}>
          Day {entry.dayNumber}
        </Text>
      </View>

      <View style={styles.row}>
        <RangeSlider
          value={at}
          min={0}
          max={last}
          label="Day"
          valueText={`Day ${entry.dayNumber}`}
          onChange={(value) => {
            setPlaying(false)
            setIndex(value)
          }}
        />
        {!running && !reduceMotion && (
          <PillButton
            label="Replay"
            onPress={() => {
              setIndex(0)
              setPlaying(true)
            }}
          />
        )}
      </View>

      {!reduceMotion && (
        <View style={styles.row}>
          <Text style={[styles.speedEnd, { fontFamily: fonts.rounded.bold }]}>Slow</Text>
          <RangeSlider
            value={frameMsToSpeed(ms)}
            min={0}
            max={100}
            step={10}
            label="Speed"
            valueText={`${(ms / 1000).toFixed(2)} seconds per photo`}
            onChange={(value) => setMs(speedToFrameMs(value))}
          />
          <Text style={[styles.speedEnd, { fontFamily: fonts.rounded.bold }]}>Fast</Text>
        </View>
      )}
    </>
  )
}

/** Whether every picture is loaded, so the time-lapse doesn't stutter on its first run; true after PRELOAD_WAIT_MS anyway. */
function usePreloaded(entries: readonly GalleryEntry[]): boolean {
  // Keyed by the pictures, not the array: the live read hands a new array after every write.
  const key = entries.map((e) => e.photo.uri).join('|')
  const [loaded, setLoaded] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    const wait = new Promise<void>((resolve) => setTimeout(resolve, PRELOAD_WAIT_MS))
    const all = Promise.all(key.split('|').map((uri) => Promise.resolve(Image.prefetch(uri)).catch(() => false)))
    void Promise.race([all, wait]).then(() => {
      if (live) setLoaded(key)
    })
    return () => {
      live = false
    }
  }, [key])
  return loaded === key
}

const styles = StyleSheet.create({
  view: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.95)' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  column: { alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', justifyContent: 'center' },
  frame: { overflow: 'hidden', borderRadius: 16, backgroundColor: '#000000', justifyContent: 'center' },
  later: { position: 'absolute', top: 0, bottom: 0, right: 0, overflow: 'hidden' },
  laterPhoto: { position: 'absolute', top: 0, bottom: 0 },
  line: { position: 'absolute', top: 0, bottom: 0, width: 2, alignItems: 'center', justifyContent: 'center' },
  knob: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  sideLabel: { position: 'absolute', top: 8, minHeight: 48, justifyContent: 'center', borderRadius: 999, paddingHorizontal: 12 },
  sideText: { fontSize: 14 },
  summary: { color: '#ffffff', fontSize: 16 },
  strip: { gap: 8, paddingVertical: 4 },
  stripDay: { width: 44, height: 64, overflow: 'hidden', borderRadius: 8, borderWidth: 2, justifyContent: 'flex-end' },
  stripNumber: { backgroundColor: 'rgba(0, 0, 0, 0.6)', color: '#ffffff', fontSize: 11, textAlign: 'center' },
  speedEnd: { color: 'rgba(255, 255, 255, 0.7)', fontSize: 14 },
  loading: { color: 'rgba(255, 255, 255, 0.7)', textAlign: 'center' },
  bigDay: { position: 'absolute', top: 12, left: 12, overflow: 'hidden', borderRadius: 12, backgroundColor: 'rgba(0, 0, 0, 0.6)', paddingHorizontal: 12, paddingVertical: 4, color: '#ffffff', fontSize: 30, letterSpacing: 0.75 },
})
