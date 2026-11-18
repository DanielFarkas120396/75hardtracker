import type { DuckMood, DuckReaction } from '@logic/duckRig'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, AppState, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Mascot } from '../components/mascot/Mascot'
import { useAnnounceChanges } from '../hooks/useAnnounce'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useHideTabBar } from '../hooks/useTabBar'
import { useTheme } from '../theme/ThemeProvider'
import { prepareShot } from './photo'

type Phase = 'starting' | 'live' | 'countdown' | 'review' | 'saving' | 'saved'
export type CameraFacing = 'back' | 'front'

const TIMER_STEPS = [0, 3, 10] as const
type TimerSeconds = (typeof TIMER_STEPS)[number]

const MOOD_BY_PHASE: Record<Phase, DuckMood> = {
  starting: 'watching',
  live: 'watching',
  countdown: 'tapping',
  review: 'judging',
  saving: 'celebrating',
  saved: 'celebrating',
}

/** How long the duck celebrates a saved photo before the sheet slides away. */
export const SAVED_LINGER_MS = 1200
/** The sheet covers this much of the screen's height, from the bottom. Never the whole screen. */
export const CAMERA_SHEET_SHARE = 0.65

interface CameraSheetProps {
  /** The most recent earlier photo, shown faintly to line up the pose. */
  ghostUri?: string
  /** The camera the sheet opens on: the one used last on this phone. */
  initialFacing: CameraFacing
  onFacingChange: (facing: CameraFacing) => void
  /** Saves the shot (a file's address); a rejection keeps the review open with an error. */
  onCapture: (uri: string) => Promise<unknown>
  onClose: () => void
  /** The camera couldn't start (not allowed, or in use). */
  onUnavailable: () => void
}

/** A dark, see-through round button that floats on the camera picture. */
function GlassButton({ label, pressed, disabled, onPress, children }: { label: string; pressed?: boolean; disabled?: boolean; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: pressed }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.glass, pressed === false ? styles.glassOff : styles.glassOn, disabled && styles.faded]}
    >
      {children}
    </Pressable>
  )
}

/**
 * The progress-photo camera: a panel that slides up over the bottom 65% of
 * the screen, with the controls floating on the picture and the duck perched
 * on the panel's top edge. The page above stays visible and scrollable. The
 * camera stops whenever the sheet closes or the app goes to the background.
 * The web's CameraSheet (src/screens/Today/CameraSheet.tsx).
 */
export function CameraSheet({ ghostUri, initialFacing, onFacingChange, onCapture, onClose, onUnavailable }: CameraSheetProps) {
  const { colors, fonts } = useTheme()
  const reduceMotion = useReduceMotion()
  const { height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const camera = useRef<CameraView>(null)
  const [permission, requestPermission] = useCameraPermissions()
  const [facing, setFacing] = useState<CameraFacing>(initialFacing)
  const [phase, setPhase] = useState<Phase>('starting')
  const [ghostOn, setGhostOn] = useState(true)
  const [timer, setTimer] = useState<TimerSeconds>(0)
  const [count, setCount] = useState(0)
  const [shot, setShot] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reaction, setReaction] = useState<{ kind: DuckReaction; id: number }>()
  // The picture's shape on screen: a capture is cropped to it.
  const [aspect, setAspect] = useState<number>()
  const shown = useState(() => new Animated.Value(0))[0]

  useHideTabBar(true)
  const react = (kind: DuckReaction) => setReaction((previous) => ({ kind, id: (previous?.id ?? 0) + 1 }))

  useEffect(() => {
    const opening = reduceMotion
      ? Animated.timing(shown, { toValue: 1, duration: 150, useNativeDriver: true })
      : Animated.spring(shown, { toValue: 1, stiffness: 260, damping: 30, mass: 1, useNativeDriver: true })
    opening.start()
    return () => opening.stop()
  }, [shown, reduceMotion])

  /** Slides away, then closes. */
  const leave = () => Animated.timing(shown, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => onClose())

  // Not allowed yet: ask once. Refused (now or before): the photo sheet explains.
  const granted = permission?.granted
  const canAsk = permission?.canAskAgain
  useEffect(() => {
    if (granted === undefined || granted) return
    if (!canAsk) return onUnavailable()
    let gone = false
    requestPermission().then(
      (answer) => {
        if (!gone && !answer.granted) onUnavailable()
      },
      () => {
        if (!gone) onUnavailable()
      },
    )
    return () => {
      gone = true
    }
    // Asked once per answer from the phone; the callbacks are the screen's own.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [granted, canAsk])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') onClose()
    })
    return () => subscription.remove()
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const capture = async () => {
    try {
      const picture = await camera.current?.takePictureAsync({ quality: 0.92 })
      if (!picture) throw new Error('No camera')
      setShot(await prepareShot(picture, aspect))
      setPhase('review')
    } catch {
      setError("Couldn't take the photo — try again.")
      setPhase('live')
    }
  }

  useEffect(() => {
    if (phase !== 'countdown') return
    if (count === 0) {
      void capture()
      return
    }
    const id = setTimeout(() => setCount((c) => c - 1), 1000)
    return () => clearTimeout(id)
    // The countdown's own tick; `capture` reads the latest state when it fires.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, count])

  useEffect(() => {
    if (phase !== 'saved') return
    const id = setTimeout(leave, SAVED_LINGER_MS)
    return () => clearTimeout(id)
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const onShutter = () => {
    setError(null)
    if (timer === 0) return void capture()
    setCount(timer)
    setPhase('countdown')
  }

  const onFlip = () => {
    const next: CameraFacing = facing === 'front' ? 'back' : 'front'
    onFacingChange(next)
    setPhase('starting')
    setFacing(next)
  }

  const onRetake = () => {
    setShot(null)
    setError(null)
    setPhase('live')
    react('glare')
  }

  const onUse = async () => {
    if (!shot) return
    setPhase('saving')
    setError(null)
    react('approve')
    try {
      await onCapture(shot)
      setPhase('saved')
    } catch {
      setError("Couldn't save that photo — try again.")
      setPhase('review')
    }
  }

  const reviewing = phase === 'review' || phase === 'saving' || phase === 'saved'
  useAnnounceChanges(phase === 'countdown' && count > 0 ? String(count) : (error ?? ''))
  const slide = reduceMotion ? 0 : shown.interpolate({ inputRange: [0, 1], outputRange: [height * CAMERA_SHEET_SHARE, 0] })
  const white = { color: '#ffffff', fontFamily: fonts.rounded.bold }

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {/* A light tint that lets touches through, so the Today screen stays scrollable behind the sheet. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tint, { opacity: shown }]} />
      <Animated.View
        accessibilityViewIsModal
        accessibilityLabel="Camera"
        style={[
          styles.panel,
          {
            height: height * CAMERA_SHEET_SHARE,
            backgroundColor: colors.surface,
            paddingBottom: Math.max(12, insets.bottom),
            opacity: reduceMotion ? shown : 1,
            transform: [{ translateY: slide }],
          },
        ]}
      >
        <View pointerEvents="none" style={styles.duck}>
          <Mascot mood={MOOD_BY_PHASE[phase]} reaction={reaction} size={120} decorative />
        </View>

        <View
          testID="viewfinder"
          style={styles.picture}
          onLayout={(event) => {
            const { width, height: tall } = event.nativeEvent.layout
            if (width > 0 && tall > 0) setAspect(width / tall)
          }}
        >
          {granted && (
            <CameraView
              ref={camera}
              testID="camera-preview"
              style={StyleSheet.absoluteFill}
              facing={facing}
              // The front camera shows a mirror, and the saved photo is what was on screen.
              mirror={facing === 'front'}
              onCameraReady={() => setPhase((current) => (current === 'starting' ? 'live' : current))}
              onMountError={onUnavailable}
            />
          )}
          {ghostUri !== undefined && ghostOn && !reviewing && (
            <Image testID="camera-ghost" source={{ uri: ghostUri }} pointerEvents="none" style={[StyleSheet.absoluteFill, styles.ghost]} />
          )}
          {shot !== null && reviewing && <Image source={{ uri: shot }} accessibilityLabel="Your new photo" style={StyleSheet.absoluteFill} />}
          {phase === 'starting' && (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.centre]}>
              <Text style={[styles.starting, { fontFamily: fonts.rounded.semibold }]}>Starting camera…</Text>
            </View>
          )}
          {phase === 'countdown' && count > 0 && (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.centre]}>
              <Text style={[styles.count, white]}>{count}</Text>
            </View>
          )}

          {!reviewing && (
            <View style={styles.top}>
              <GlassButton
                label={`Timer: ${timer === 0 ? 'off' : `${timer} seconds`}`}
                onPress={() => setTimer(TIMER_STEPS[(TIMER_STEPS.indexOf(timer) + 1) % TIMER_STEPS.length])}
                disabled={phase === 'countdown'}
              >
                <Text style={[styles.glyph, white]}>
                  ⏱{timer === 0 ? '' : <Text style={styles.seconds}> {timer}s</Text>}
                </Text>
              </GlassButton>
              {ghostUri !== undefined && (
                <GlassButton label="Show last photo as a guide" pressed={ghostOn} onPress={() => setGhostOn((on) => !on)}>
                  <Text style={styles.glyph}>👻</Text>
                </GlassButton>
              )}
            </View>
          )}

          {error !== null && (
            <View style={styles.error}>
              <Text accessibilityRole="alert" style={[styles.errorText, { fontFamily: fonts.rounded.semibold }]}>
                {error}
              </Text>
            </View>
          )}

          {reviewing ? (
            <View style={[styles.bottom, styles.reviewRow]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retake"
                accessibilityState={{ disabled: phase !== 'review' }}
                disabled={phase !== 'review'}
                onPress={onRetake}
                style={[styles.review, styles.glassOn, phase !== 'review' && styles.faded]}
              >
                <Text style={[styles.reviewText, white]}>Retake</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: phase !== 'review' }}
                disabled={phase !== 'review'}
                onPress={() => void onUse()}
                style={[styles.review, styles.use, phase !== 'review' && styles.almost]}
              >
                <Text style={[styles.reviewText, { color: '#000000', fontFamily: fonts.rounded.bold }]}>
                  {phase === 'review' ? 'Use photo' : phase === 'saving' ? 'Saving…' : 'Saved!'}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.bottom, styles.liveRow]}>
              <GlassButton label="Close camera" onPress={leave}>
                <Text style={[styles.glyph, white]}>‹</Text>
              </GlassButton>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={phase === 'countdown' ? 'Cancel timer' : 'Take photo'}
                accessibilityState={{ disabled: phase === 'starting' }}
                disabled={phase === 'starting'}
                onPress={phase === 'countdown' ? () => setPhase('live') : onShutter}
                style={({ pressed }) => [styles.shutter, phase === 'starting' && styles.faded, pressed && styles.pressed]}
              >
                <Text style={styles.stop}>{phase === 'countdown' ? '■' : ''}</Text>
              </Pressable>
              <GlassButton label="Switch camera" onPress={onFlip} disabled={phase !== 'live'}>
                <Text style={[styles.glyph, white]}>⟲</Text>
              </GlassButton>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  tint: { backgroundColor: 'rgba(0, 0, 0, 0.25)' },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -8 },
  },
  duck: { position: 'absolute', top: -106, left: 20, zIndex: 1 },
  picture: { flex: 1, overflow: 'hidden', borderRadius: 32, backgroundColor: '#000000' },
  ghost: { opacity: 0.3 },
  centre: { alignItems: 'center', justifyContent: 'center' },
  starting: { fontSize: 14, color: 'rgba(255, 255, 255, 0.8)' },
  count: { fontSize: 128 },
  top: { position: 'absolute', top: 16, right: 16, flexDirection: 'row', gap: 8 },
  glass: { height: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, paddingHorizontal: 12 },
  glassOn: { backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  glassOff: { backgroundColor: 'rgba(0, 0, 0, 0.25)', opacity: 0.6 },
  faded: { opacity: 0.4 },
  almost: { opacity: 0.8 },
  glyph: { fontSize: 18 },
  seconds: { fontSize: 14 },
  error: { position: 'absolute', left: 16, right: 16, bottom: 128, borderRadius: 16, backgroundColor: 'rgba(0, 0, 0, 0.6)', paddingHorizontal: 16, paddingVertical: 8 },
  errorText: { fontSize: 14, textAlign: 'center', color: '#ffffff' },
  bottom: { position: 'absolute', left: 16, right: 16, bottom: 24 },
  reviewRow: { flexDirection: 'row', gap: 12 },
  liveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  review: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  use: { backgroundColor: '#ffffff' },
  reviewText: { fontSize: 16 },
  shutter: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 40,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    backgroundColor: '#ffffff',
  },
  pressed: { transform: [{ scale: 0.9 }] },
  stop: { fontSize: 24, color: '#000000' },
})
