import { CHALLENGE_LENGTH } from '@logic/constants'
import { dateForDayNumber, formatShortDay } from '@logic/dates'
import { DEFAULT_BEDTIME, EARLIEST_BEDTIME, isValidBedtime, LATEST_BEDTIME } from '@logic/menace'
import { LONG_REASON_FROM, WHY_COUNTER_FROM, type OnboardingMode } from '@logic/onboarding'
import { finishLine, lateStartHint, startsInLine, WHY_IDEAS } from '@logic/onboardingCopy'
import { cleanText, isValidName, isValidWhy, NAME_MAX_LENGTH, WHY_MAX_LENGTH } from '@logic/profile'
import { RULESETS, type ChallengeVariant } from '@logic/rulesets'
import { SETTING_KEYS } from '@logic/settingKeys'
import { dailyRuleLines, NO_REMINDERS_LINE, stakesLine, VARIANT_NAMES } from '@logic/variantsCopy'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, Pressable, StyleSheet, Text, TextInput, View, type LayoutChangeEvent, type ViewStyle } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { ImportBackup } from '../backup/ImportBackupFlow'
import { Button } from '../components/ui/Button'
import { DrawCheckPad } from '../components/ui/DrawCheckPad'
import { TimeField } from '../components/ui/PickerField'
import { settingsRepo } from '../db/repositories/settingsRepo'
import { useLiveQuery } from '../db/useLiveQuery'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useTheme } from '../theme/ThemeProvider'
import { withAlpha } from '../theme/tokens'
import { Alert, Lead, MissingHint, StepTitle, useFieldStyle } from './parts'
import { StartDateChoice, type StartDateChoiceState } from './StartDateChoice'
import { VariantPicker } from './VariantPicker'

// The web flow's steps (src/screens/Onboarding/OnboardingSteps.tsx), with the same wording.

/** The first screen. "Restore it" brings back a backup made by the web app. */
export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <>
      <StepTitle size="lg">75 days. 5 tasks. One duck with a knife.</StepTitle>
      <Lead style={styles.gapSmall}>
        Workouts, diet, water, reading and a progress photo, every single day. I&apos;ll be watching.
      </Lead>
      <Button label="Get started" onPress={onNext} style={styles.buttonFar} />
      <View style={styles.gap}>
        <ImportBackup look="link" label="Already have a backup? Restore it" />
      </View>
    </>
  )
}

interface NameStepProps {
  name: string
  onChange: (name: string) => void
  onNext: () => void
}

export function NameStep({ name, onChange, onNext }: NameStepProps) {
  const { colors } = useTheme()
  const field = useFieldStyle()
  const valid = isValidName(name)
  return (
    <>
      <StepTitle>What should the duck call you?</StepTitle>
      <TextInput
        accessibilityLabel="What should the duck call you?"
        value={name}
        onChangeText={onChange}
        onSubmitEditing={() => valid && onNext()}
        placeholder="Your name"
        placeholderTextColor={colors.inkMuted}
        maxLength={NAME_MAX_LENGTH}
        autoCapitalize="words"
        autoCorrect={false}
        textContentType="givenName"
        returnKeyType="next"
        style={[field, styles.fieldCentred]}
      />
      <MissingHint>
        {valid ? `Up to ${NAME_MAX_LENGTH} characters.` : `Type a name to continue. Up to ${NAME_MAX_LENGTH} characters.`}
      </MissingHint>
      <Button label="Continue" onPress={onNext} disabled={!valid} style={styles.button} />
    </>
  )
}

interface ChallengeStepProps {
  /** null until the player taps a card: none is preselected. */
  variant: ChallengeVariant | null
  onChange: (variant: ChallengeVariant) => void
}

/** The cards only: the flow pins Continue under them, so four cards never push it off a small screen. */
export function ChallengeStep({ variant, onChange }: ChallengeStepProps) {
  return (
    <>
      <StepTitle>Pick your challenge</StepTitle>
      <Lead>Tap one. You can switch until the end of Day&nbsp;1.</Lead>
      <View style={styles.gap}>
        <VariantPicker value={variant} onChange={onChange} />
      </View>
    </>
  )
}

export function ChallengeFooter({ variant, onNext }: { variant: ChallengeVariant | null; onNext: () => void }) {
  return (
    <>
      <Button label="Continue" onPress={onNext} disabled={variant === null} />
      {variant === null && <MissingHint>Pick a challenge to continue.</MissingHint>}
    </>
  )
}

interface WhyStepProps {
  why: string
  onChange: (why: string) => void
  onNext: () => void
}

export function WhyStep({ why, onChange, onNext }: WhyStepProps) {
  const { colors, fonts } = useTheme()
  const field = useFieldStyle()
  const valid = isValidWhy(why)
  const cleaned = cleanText(why)
  // The ideas only fill an empty field (or swap one idea for another): a tap never wipes the player's own words.
  const showIdeas = cleaned === '' || (WHY_IDEAS as readonly string[]).includes(cleaned)
  return (
    <>
      <StepTitle>Why are you doing this?</StepTitle>
      <Lead>I&apos;ll remind you when it gets hard.</Lead>
      <TextInput
        accessibilityLabel="Your why"
        value={why}
        onChangeText={onChange}
        // Return moves on when the answer is valid; it never inserts a new line.
        submitBehavior="blurAndSubmit"
        onSubmitEditing={() => valid && onNext()}
        placeholder="Because…"
        placeholderTextColor={colors.inkMuted}
        maxLength={WHY_MAX_LENGTH}
        multiline
        returnKeyType="next"
        style={[field, styles.fieldTall]}
      />
      {why.length >= WHY_COUNTER_FROM && (
        <Text style={[styles.counter, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>
          {why.length}/{WHY_MAX_LENGTH}
        </Text>
      )}
      {showIdeas && (
        <View style={styles.ideas}>
          {WHY_IDEAS.map((idea) => {
            const chosen = cleaned === idea
            return (
              <Pressable
                key={idea}
                accessibilityRole="button"
                accessibilityState={{ selected: chosen }}
                onPress={() => onChange(idea)}
                style={[
                  styles.idea,
                  chosen
                    ? { borderColor: colors.worldEdge, backgroundColor: colors.worldSoft }
                    : { borderColor: withAlpha(colors.ink, 0.15), backgroundColor: colors.canvas },
                ]}
              >
                <Text style={[styles.ideaLabel, { color: chosen ? colors.worldInk : colors.ink, fontFamily: fonts.rounded.bold }]}>
                  {idea}
                </Text>
              </Pressable>
            )
          })}
        </View>
      )}
      <Button label="Continue" onPress={onNext} disabled={!valid} style={styles.button} />
      {!valid && <MissingHint>Write a reason or tap an idea to continue.</MissingHint>}
    </>
  )
}

/**
 * The bedtime the duck counts down to, asked once so the first evening runs on
 * the player's own clock (Settings changes it later). Saved as it changes.
 */
export function BedtimeStep({ onNext }: { onNext: () => void }) {
  const { colors, fonts } = useTheme()
  const saved = useLiveQuery(() => settingsRepo.get(SETTING_KEYS.bedtime, DEFAULT_BEDTIME), [])
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? saved ?? DEFAULT_BEDTIME
  const valid = isValidBedtime(value)
  return (
    <>
      <StepTitle>When do you go to bed?</StepTitle>
      <Lead>I only come for you when what&apos;s left won&apos;t fit before then.</Lead>
      <View style={styles.gap}>
        <TimeField
          label="Bedtime"
          value={value}
          disabled={saved === undefined}
          onChange={(time) => {
            setDraft(time)
            if (isValidBedtime(time)) void settingsRepo.set(SETTING_KEYS.bedtime, time)
          }}
        />
      </View>
      <Button label="Continue" onPress={onNext} disabled={!valid} style={styles.button} />
      {!valid && (
        <MissingHint>
          Pick a time between {EARLIEST_BEDTIME} and {LATEST_BEDTIME}.
        </MissingHint>
      )}
      <Text style={[styles.note, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>
        You can change it later in Settings.
      </Text>
    </>
  )
}

interface StartStepProps {
  start: StartDateChoiceState
  today: string
  variant: ChallengeVariant
  /** Minutes since midnight, for the evening warning. */
  nowMin: number
  onNext: () => void
}

export function StartStep({ start, today, variant, nowMin, onNext }: StartStepProps) {
  const { colors, fonts } = useTheme()
  const lateHint = start.choice === 'today' ? lateStartHint(nowMin, RULESETS[variant]) : null
  return (
    <>
      <StepTitle>When do you start?</StepTitle>
      <Lead>Day&nbsp;1 is the date you pick. Every task is due by midnight.</Lead>
      <View style={styles.gap}>
        <StartDateChoice state={start} today={today} />
      </View>
      {start.dateError ? (
        <Alert>{start.dateError}</Alert>
      ) : (
        <Text accessibilityLiveRegion="polite" style={[styles.finish, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>
          {finishLine(start.startDate)}
        </Text>
      )}
      {lateHint && (
        <View
          accessible
          accessibilityLiveRegion="polite"
          style={[styles.warning, { borderColor: withAlpha(colors.dangerInk, 0.3), backgroundColor: colors.worldSoft }]}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.dangerInk} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M12 3.5l9 16H3z" />
            <Path d="M12 10v4.5M12 17.5h.01" />
          </Svg>
          <Text style={[styles.warningText, { color: colors.dangerInk, fontFamily: fonts.rounded.semibold }]}>{lateHint}</Text>
        </View>
      )}
      <Button label="Continue" onPress={onNext} disabled={start.dateError !== null} style={styles.button} />
    </>
  )
}

interface ReadyStepProps {
  mode: OnboardingMode
  name: string
  why: string
  /** The picked challenge (always set by the deal: the flow can't reach it without one). */
  variant: ChallengeVariant | null
  startDate: string
  today: string
  /** The start step's error when the chosen date can't be used any more (new mode only). */
  dateError: string | null
  busy: boolean
  error: string | null
  /** The deal is signed: the duck takes over for a moment before the app does. */
  signed: boolean
  onSign: () => void
  /** Back to the start step, when the date can't be used any more. */
  onChangeStart: () => void
  onFinish: () => void
  /** Where the signature block sits, so the flow can say "Sign below" while it is out of view. */
  onSigningLayout?: (event: LayoutChangeEvent) => void
}

/**
 * The last screen. A new player signs the deal: the rules, what a missed day
 * costs, the dates and their reason, with a checkmark drawn by hand. A
 * returning player just picks up where they were.
 */
export function ReadyStep(props: ReadyStepProps) {
  const { mode, name, why, variant, startDate, today, dateError, busy, error, signed, onSign, onChangeStart, onFinish } = props
  const { colors, fonts } = useTheme()
  const alert = dateError ?? error
  const valid = isValidName(name) && isValidWhy(why)
  const [checked, setChecked] = useState(false)

  if (mode === 'returning') {
    return (
      <>
        <StepTitle>Welcome back, {cleanText(name)}.</StepTitle>
        <Lead style={styles.gapSmall}>Your challenge is right where you left it.</Lead>
        <Reason
          why={why}
          style={[styles.reasonCard, { borderColor: withAlpha(colors.ink, 0.15), backgroundColor: colors.canvas }]}
        />
        {alert && <Alert>{alert}</Alert>}
        <Button label={busy ? 'Saving…' : "Let's go"} onPress={onFinish} disabled={busy || !valid} style={styles.button} />
      </>
    )
  }
  if (variant === null) return null // unreachable: the challenge step won't move on without a pick

  const rules = RULESETS[variant]
  const startsIn = dateError ? null : startsInLine(startDate, today)
  const muted = { color: colors.inkMuted, fontFamily: fonts.rounded.bold }
  let line = 0
  const next = () => line++

  return (
    <>
      <StepTitle>Deal, {cleanText(name)}.</StepTitle>
      <View
        accessibilityLabel="The deal"
        style={[styles.deal, { borderColor: withAlpha(colors.worldEdge, 0.4), backgroundColor: colors.worldSoft }]}
      >
        <DealLine index={next()}>
          <Text style={[styles.dealName, { color: colors.worldInk, fontFamily: fonts.display.semibold }]}>
            {VARIANT_NAMES[variant]}
          </Text>
        </DealLine>
        {!dateError && (
          <DealLine index={next()}>
            <Text style={[styles.dealDates, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>
              {formatShortDay(startDate)} → {formatShortDay(dateForDayNumber(startDate, CHALLENGE_LENGTH))}
            </Text>
            {startsIn && <Text style={[styles.small, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}>{startsIn}</Text>}
          </DealLine>
        )}
        <DealLine index={next()}>
          <Text style={[styles.small, styles.gap, muted]}>Every day, for {CHALLENGE_LENGTH} days</Text>
        </DealLine>
        {dailyRuleLines(rules).map((rule) => (
          <DealLine key={rule} index={next()}>
            <View style={styles.rule}>
              <Text style={[styles.ruleText, { color: colors.worldInk, fontFamily: fonts.rounded.bold }]}>•</Text>
              <Text style={[styles.ruleText, styles.ruleBody, { color: colors.ink, fontFamily: fonts.rounded.regular }]}>{rule}</Text>
            </View>
          </DealLine>
        ))}
        <DealLine index={next()}>
          <Text style={[styles.stakes, { color: colors.worldInk, fontFamily: fonts.rounded.bold }]}>{stakesLine(rules)}</Text>
        </DealLine>
        <DealLine index={next()}>
          <Text style={[styles.small, styles.gapSmall, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}>
            {NO_REMINDERS_LINE}
          </Text>
        </DealLine>
        <DealLine index={next()}>
          <Reason why={why} style={[styles.reasonInDeal, { borderTopColor: withAlpha(colors.worldEdge, 0.3) }]} />
        </DealLine>
      </View>
      {alert && <Alert>{alert}</Alert>}
      {dateError && <Button label="Change start date" variant="secondary" onPress={onChangeStart} style={styles.gapSmall} />}
      {/* After the whole card, not pinned over it: the player reads every rule before they reach the signature. */}
      <View onLayout={props.onSigningLayout} style={styles.signing}>
        {signed ? (
          <Text accessibilityLiveRegion="polite" style={[styles.watching, { color: colors.ink, fontFamily: fonts.display.semibold }]}>
            I&apos;m watching, {cleanText(name)}.
          </Text>
        ) : (
          <>
            <Text style={[styles.prompt, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>
              Sign the deal: draw a checkmark.
            </Text>
            <View style={styles.gapSmall}>
              <DrawCheckPad
                label="Sign the deal: draw a checkmark."
                onChange={setChecked}
                disabled={busy || dateError !== null || !valid}
              />
            </View>
            <Button
              label={busy ? 'Saving…' : 'I commit'}
              onPress={() => {
                setChecked(false) // the signature is spent: a failed save asks for a new one
                onSign()
              }}
              disabled={!checked || busy || dateError !== null || !valid}
              style={styles.gap}
            />
          </>
        )}
      </View>
    </>
  )
}

/** The deal appears line by line: each part fades up after the one before. Reduce motion keeps only the fade. */
function DealLine({ index, children }: { index: number; children: ReactNode }) {
  const reduceMotion = useReduceMotion()
  const shown = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(shown, { toValue: 1, duration: 250, delay: 150 + index * 80, useNativeDriver: true }).start()
  }, [shown, index])
  const lift = reduceMotion ? 0 : shown.interpolate({ inputRange: [0, 1], outputRange: [8, 0] })
  return <Animated.View style={{ opacity: shown, transform: [{ translateY: lift }] }}>{children}</Animated.View>
}

/** The player's reason, as they'll see it again at hard moments. */
function Reason({ why, style }: { why: string; style: ViewStyle | ViewStyle[] }) {
  const { colors, fonts } = useTheme()
  const reason = cleanText(why)
  return (
    <View style={style}>
      <Text style={[styles.small, { color: colors.inkMuted, fontFamily: fonts.rounded.bold }]}>Your reason</Text>
      <Text
        style={[
          styles.reason,
          reason.length > LONG_REASON_FROM && styles.reasonLong,
          { color: colors.ink, fontFamily: fonts.display.semibold },
        ]}
      >
        “{reason}”
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  gap: { marginTop: 16, alignSelf: 'stretch' },
  gapSmall: { marginTop: 12, alignSelf: 'stretch' },
  button: { marginTop: 24, alignSelf: 'stretch' },
  buttonFar: { marginTop: 32, alignSelf: 'stretch' },
  fieldCentred: { marginTop: 24, textAlign: 'center' },
  fieldTall: { marginTop: 16, minHeight: 104, padding: 16, textAlignVertical: 'top' },
  counter: { marginTop: 4, alignSelf: 'flex-end', fontSize: 14, fontVariant: ['tabular-nums'] },
  ideas: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  idea: { minHeight: 48, justifyContent: 'center', borderRadius: 999, borderWidth: 1, paddingHorizontal: 16 },
  ideaLabel: { fontSize: 14 },
  note: { marginTop: 12, fontSize: 14, textAlign: 'center' },
  finish: { marginTop: 12, fontSize: 16, textAlign: 'center' },
  warning: { marginTop: 12, alignSelf: 'stretch', flexDirection: 'row', gap: 8, borderRadius: 16, borderWidth: 1, padding: 12 },
  warningText: { flex: 1, fontSize: 14, lineHeight: 20 },
  deal: { marginTop: 20, alignSelf: 'stretch', borderRadius: 20, borderWidth: 1, padding: 20 },
  dealName: { fontSize: 30, letterSpacing: 0.75 },
  dealDates: { marginTop: 4, fontSize: 16 },
  small: { fontSize: 14 },
  rule: { marginTop: 4, flexDirection: 'row', gap: 8 },
  ruleText: { fontSize: 16, lineHeight: 22 },
  ruleBody: { flex: 1 },
  stakes: { marginTop: 16, fontSize: 16 },
  reasonCard: { marginTop: 20, alignSelf: 'stretch', borderRadius: 20, borderWidth: 1, padding: 20 },
  reasonInDeal: { marginTop: 16, borderTopWidth: 1, paddingTop: 16 },
  reason: { marginTop: 4, fontSize: 24, letterSpacing: 0.6 },
  reasonLong: { fontSize: 20 },
  signing: { marginTop: 24, alignSelf: 'stretch' },
  watching: { fontSize: 24, letterSpacing: 0.6, textAlign: 'center' },
  prompt: { fontSize: 18, textAlign: 'center' },
})
