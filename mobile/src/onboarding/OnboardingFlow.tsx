import { LONG_STEPS, onboardingSteps, resumeStep, SIGNED_BEAT_MS, STEP_MOODS, type OnboardingMode, type OnboardingStep } from '@logic/onboarding'
import { defaultStartChoice, SAVE_FAILED_LINE } from '@logic/onboardingCopy'
import type { OnboardingDraft } from '@logic/onboardingDraft'
import { isValidName, isValidWhy } from '@logic/profile'
import type { ChallengeVariant } from '@logic/rulesets'
import * as Haptics from 'expo-haptics'
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react'
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Mascot } from '../components/mascot/Mascot'
import { profileRepo } from '../db/repositories/profileRepo'
import { useNowMinutes } from '../hooks/useNowMinutes'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useTheme } from '../theme/ThemeProvider'
import { clearDraft, saveDraft } from './draftStore'
import { DuckGlow, TopBar } from './parts'
import { useStartChoice } from './StartDateChoice'
import { BedtimeStep, ChallengeFooter, ChallengeStep, NameStep, ReadyStep, StartStep, WelcomeStep, WhyStep } from './steps'

interface OnboardingFlowProps {
  mode: OnboardingMode
  today: string
  /** The answers saved before the app was last closed, if any. */
  draft: OnboardingDraft | null
  /** Minutes since midnight. The clock's, except in tests. */
  nowMin?: number
}

/**
 * The welcome flow: one question per screen, shown until the player has a
 * profile. A new player also picks the challenge and its start, and a drawn
 * checkmark signs the deal: the duck has a moment, then attempt #1 is created
 * with the profile (profileRepo.completeOnboarding). The answers so far are
 * kept on the phone, so reopening the app comes back to the same step, or to
 * the first one whose answer no longer holds. The web's OnboardingFlow.
 */
export function OnboardingFlow({ mode, today, draft, nowMin: nowMinProp }: OnboardingFlowProps) {
  const { colors, fonts } = useTheme()
  const steps = onboardingSteps(mode)
  const clockMin = useNowMinutes()
  const nowMin = nowMinProp ?? clockMin
  // Decided once, when the flow opens: the choice must not jump under the player's finger at 18:00.
  const [defaultChoice] = useState(() => defaultStartChoice(nowMin))
  const start = useStartChoice(today, draft ? { choice: draft.startChoice, pickedDate: draft.pickedDate } : undefined, defaultChoice)
  const [index, setIndex] = useState(() =>
    draft
      ? resumeStep(steps, draft.step, {
          name: isValidName(draft.name),
          challenge: draft.variant !== null,
          why: isValidWhy(draft.why),
          start: start.dateError === null,
        })
      : 0,
  )
  const [name, setName] = useState(draft?.name ?? '')
  const [variant, setVariant] = useState<ChallengeVariant | null>(draft?.variant ?? null)
  const [why, setWhy] = useState(draft?.why ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signed, setSigned] = useState(false)
  const beat = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (beat.current) clearTimeout(beat.current)
    },
    [],
  )

  const clamp = (i: number) => Math.min(i, steps.length - 1)
  const step = steps[clamp(index)]
  // Moving is tied to the step that asks for it: a second tap while that step is still leaving does nothing.
  const next = (from: OnboardingStep) => setIndex((i) => (steps[clamp(i)] === from ? clamp(i) + 1 : clamp(i)))
  const back = (from: OnboardingStep) => setIndex((i) => (steps[clamp(i)] === from ? Math.max(clamp(i) - 1, 0) : clamp(i)))

  const { choice: startChoice, pickedDate } = start
  useEffect(() => {
    // Losing a draft only costs retyping: never let it break the flow.
    saveDraft({ step, name, variant, why, startChoice, pickedDate }).catch((failure: unknown) => console.error(failure))
  }, [step, name, variant, why, startChoice, pickedDate])

  const finish = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await profileRepo.completeOnboarding(
        { name, why },
        mode === 'new' && variant ? { startDate: start.startDate, variant } : undefined,
      )
      // On success the profile appears, and the app takes over from this flow.
      if (result.ok) {
        await clearDraft().catch((failure: unknown) => console.error(failure))
        return
      }
    } catch {
      // Same as a refused save, below.
    }
    setError(SAVE_FAILED_LINE)
    setBusy(false)
    setSigned(false)
  }

  // The deal is signed: the duck takes the signature, then the save runs and the app takes over.
  const sign = () => {
    setSigned(true)
    setError(null)
    // A light tap under the thumb. Not every phone can; the deal doesn't depend on it.
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
    beat.current = setTimeout(() => {
      beat.current = null
      void finish()
    }, SIGNED_BEAT_MS)
  }

  // "Sign below": the deal card fills the phone, so a pill says there is more until the signature is in view.
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null)
  const [viewHeight, setViewHeight] = useState(0)
  // Each step has its own scroll view, opening at its top: how far another step was scrolled says nothing here.
  const [scrolled, setScrolled] = useState({ step, offset: 0 })
  if (scrolled.step !== step) setScrolled({ step, offset: 0 })
  const view = { height: viewHeight, offset: scrolled.offset }
  // A finger is on the signature pad: the page must not scroll under it.
  const [drawing, setDrawing] = useState(false)
  const [signing, setSigning] = useState<{ y: number; height: number } | null>(null)
  const [stepTop, setStepTop] = useState(0)
  const signingVisible =
    signing === null ||
    view.height === 0 ||
    Math.min(view.offset + view.height, stepTop + signing.y + signing.height) - Math.max(view.offset, stepTop + signing.y) >=
      signing.height * 0.3

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <View style={styles.bar}>
          <TopBar index={clamp(index)} total={steps.length} onBack={() => back(step)} hideBack={signed} />
        </View>
        <ScrollView
          key={step}
          ref={scroll}
          testID="flow-scroll"
          scrollEnabled={!drawing}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          scrollEventThrottle={32}
          onLayout={(event) => setViewHeight(event.nativeEvent.layout.height)}
          onScroll={(event) => setScrolled({ step, offset: event.nativeEvent.contentOffset.y })}
        >
          <StepTransition>
            <View
              style={styles.step}
              onLayout={(event) => {
                setStepTop(event.nativeEvent.layout.y)
              }}
            >
              <View style={styles.duck}>
                <DuckGlow />
                <Mascot mood={signed ? 'triumphant' : STEP_MOODS[step]} size={LONG_STEPS.has(step) ? 64 : 96} />
              </View>
              {step === 'welcome' && <WelcomeStep onNext={() => next('welcome')} />}
              {step === 'name' && <NameStep name={name} onChange={setName} onNext={() => next('name')} />}
              {step === 'challenge' && <ChallengeStep variant={variant} onChange={setVariant} />}
              {step === 'why' && <WhyStep why={why} onChange={setWhy} onNext={() => next('why')} />}
              {step === 'bedtime' && <BedtimeStep onNext={() => next('bedtime')} />}
              {step === 'start' && variant && (
                <StartStep start={start} today={today} variant={variant} nowMin={nowMin} onNext={() => next('start')} />
              )}
              {step === 'ready' && (
                <ReadyStep
                  mode={mode}
                  name={name}
                  why={why}
                  variant={variant}
                  startDate={start.startDate}
                  today={today}
                  dateError={mode === 'new' ? start.dateError : null}
                  busy={busy}
                  error={error}
                  signed={signed}
                  onSign={sign}
                  onChangeStart={() => setIndex(Math.max(steps.indexOf('start'), 0))}
                  onFinish={() => void finish()}
                  onDrawingChange={setDrawing}
                  onSigningLayout={(event) => {
                    const { y, height } = event.nativeEvent.layout
                    setSigning({ y, height })
                  }}
                />
              )}
            </View>
          </StepTransition>
        </ScrollView>
        {step === 'challenge' && (
          <View style={[styles.footer, { backgroundColor: colors.canvas }]}>
            <ChallengeFooter variant={variant} onNext={() => next('challenge')} />
          </View>
        )}
        {step === 'ready' && mode === 'new' && !signed && !signingVisible && signing !== null && (
          <Pressable
            accessibilityRole="button"
            onPress={() => scroll.current?.scrollTo({ y: Math.max(stepTop + signing.y - 80, 0), animated: true })}
            style={[styles.pill, { backgroundColor: colors.ink }]}
          >
            <Text style={[styles.pillLabel, { color: colors.surface, fontFamily: fonts.rounded.bold }]}>Sign below ↓</Text>
          </Pressable>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

/** A step arrives with a short fade and slide. Under reduce motion it is simply there. */
function StepTransition({ children }: { children: ReactNode }) {
  const reduceMotion = useReduceMotion()
  const shown = useState(() => new Animated.Value(0))[0]
  useEffect(() => {
    Animated.timing(shown, { toValue: 1, duration: 200, useNativeDriver: true }).start()
  }, [shown])
  if (reduceMotion) return <>{children}</>
  const slide = shown.interpolate({ inputRange: [0, 1], outputRange: [24, 0] })
  return <Animated.View style={{ opacity: shown, transform: [{ translateX: slide }] }}>{children}</Animated.View>
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1 },
  bar: { paddingHorizontal: 24, paddingTop: 24 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 },
  step: { alignItems: 'center' },
  duck: { alignItems: 'center' },
  footer: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16 },
  pill: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 20,
  },
  pillLabel: { fontSize: 14 },
})
