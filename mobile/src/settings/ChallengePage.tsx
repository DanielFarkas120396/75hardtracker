import { addDaysISO, formatDisplayDate, formatShortDay, isValidISODate } from '@logic/dates'
import { daysUntilStart, isChallengeDay } from '@logic/days'
import { variantOf, type ChallengeVariant } from '@logic/rulesets'
import { START_MAX_DAYS_AHEAD } from '@logic/startChoice'
import { isStartDateEditable, validateStartDateChange, type StartDateChangeResult } from '@logic/startDate'
import { VARIANT_NAMES } from '@logic/variantsCopy'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Button } from '../components/ui/Button'
import { DateField } from '../components/ui/PickerField'
import { Sheet } from '../components/ui/Sheet'
import { challengeRepo } from '../db/repositories/challengeRepo'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import type { Challenge } from '../db/types'
import { useLiveQuery } from '../db/useLiveQuery'
import { expoStore } from '../files/store'
import { VariantPicker } from '../onboarding/VariantPicker'
import { useTheme } from '../theme/ThemeProvider'
import { Card, CardTitle, Confirm, Muted, StatusLine, settingsStyles } from './rows'

type Rejection = Extract<StartDateChangeResult, { ok: false }>['reason']

const REJECTION_MESSAGES: Record<Rejection, string> = {
  empty: 'Pick a date first.',
  invalid: "That isn't a valid date.",
  past: "The start date can't be in the past — earlier days can't be backfilled.",
  locked: 'The start date is locked once your attempt is past Day 1.',
}

function statusLine(challenge: Challenge, todayDayNumber: number): string {
  const days = daysUntilStart(todayDayNumber)
  if (days > 0) return `Starts ${days === 1 ? 'tomorrow' : `in ${days} days`} — ${formatDisplayDate(challenge.startDate)}.`
  if (todayDayNumber === 1) return `Day 1 is today — ${formatDisplayDate(challenge.startDate)}.`
  if (isChallengeDay(todayDayNumber)) return `Day 1 was ${formatDisplayDate(challenge.startDate)}.`
  return "Your start date isn't valid — pick a new one."
}

/** When the challenge and start date stop being editable, in words. */
function lockDeadline(challenge: Challenge, todayDayNumber: number): string {
  if (todayDayNumber === 1) return 'midnight tonight, the end of Day 1'
  if (isValidISODate(challenge.startDate)) return `the end of Day 1 (${formatShortDay(challenge.startDate)})`
  return 'the end of Day 1'
}

type Question = { kind: 'variant'; variant: ChallengeVariant } | { kind: 'move'; date: string }

interface ChallengePageProps {
  challenge: Challenge
  today: string
  todayDayNumber: number
}

/**
 * The active attempt's challenge and start date, both editable only before or on Day 1. Switching re-judges what
 * was logged and moving the start clears Day 1's logs, so both ask first when there are logs; the question comes up
 * in one sheet. The web's StartDateSection.
 */
export function ChallengePage({ challenge, today, todayDayNumber }: ChallengePageProps) {
  const { colors, fonts } = useTheme()
  const [draft, setDraft] = useState(challenge.startDate)
  const [error, setError] = useState<string | null>(null)
  const [question, setQuestion] = useState<Question | null>(null)
  const [busy, setBusy] = useState(false)
  const loggedProgress = useLiveQuery(() => dayEntryRepo.hasLoggedProgress(challenge.id), [challenge.id])
  const editable = isStartDateEditable(todayDayNumber)
  const variant = variantOf(challenge)

  const run = async (change: () => Promise<StartDateChangeResult | { ok: true } | { ok: false; reason: 'locked' }>) => {
    setBusy(true)
    try {
      const result = await change()
      setError(result.ok ? null : REJECTION_MESSAGES[result.reason])
    } finally {
      setBusy(false)
      setQuestion(null)
    }
  }
  const switchVariant = (next: ChallengeVariant) => run(() => challengeRepo.changeVariant(challenge.id, next, today))
  const move = (date: string) => run(() => challengeRepo.changeStartDate(challenge.id, date, today, expoStore))

  // Logs stay but are re-judged under the new rules, so a done day can reopen: ask first (also while still checking).
  const changeVariant = (next: ChallengeVariant) => {
    if (next === variant) return
    if (loggedProgress !== false) setQuestion({ kind: 'variant', variant: next })
    else void switchVariant(next)
  }

  const save = () => {
    const result = validateStartDateChange({ proposed: draft, today, todayDayNumber })
    if (!result.ok) {
      setError(REJECTION_MESSAGES[result.reason])
      return
    }
    setError(null)
    if (draft === challenge.startDate) return
    if (loggedProgress ?? false) setQuestion({ kind: 'move', date: draft })
    else void move(draft)
  }

  return (
    <Card>
      <CardTitle>Challenge</CardTitle>
      <Muted>{statusLine(challenge, todayDayNumber)}</Muted>

      {editable ? (
        <>
          <Text style={[styles.note, { backgroundColor: colors.yellowLight, color: colors.yellowInk, fontFamily: fonts.rounded.semibold }]}>
            ⏳ You can change your challenge and start date until {lockDeadline(challenge, todayDayNumber)}. After that, both are locked for this attempt.
          </Text>
          <View style={settingsStyles.top}>
            <VariantPicker value={variant} onChange={changeVariant} disabled={busy} />
          </View>
          <View style={styles.dateRow}>
            <View style={settingsStyles.flex}>
              <DateField
                label="Start date"
                value={draft}
                min={today}
                max={addDaysISO(today, START_MAX_DAYS_AHEAD)}
                onChange={(date) => {
                  setDraft(date)
                  setError(null)
                }}
              />
            </View>
            <Button variant="secondary" label={busy && question === null ? 'Saving…' : 'Save'} disabled={busy || draft === challenge.startDate} onPress={save} />
          </View>
          <Muted size={12} top={8}>
            Today or later.
          </Muted>
        </>
      ) : (
        <View style={[styles.locked, { backgroundColor: colors.canvas }]}>
          <Text style={[styles.lockedTitle, { color: colors.ink, fontFamily: fonts.rounded.semibold }]}>🔒 {VARIANT_NAMES[variant]} — locked for this attempt.</Text>
          <Muted>
            The challenge and start date can only be changed until the end of Day 1
            {isValidISODate(challenge.startDate) ? ` (${formatShortDay(challenge.startDate)})` : ''}. To switch now, give up this attempt (Danger zone, below) and start a new
            one.
          </Muted>
        </View>
      )}

      {error !== null && <StatusLine error>{error}</StatusLine>}

      <Sheet open={question !== null} onClose={() => setQuestion(null)} label={question?.kind === 'move' ? 'Move the start date?' : 'Switch challenge?'}>
        {question?.kind === 'variant' && (
          <Confirm
            title={`Switch to ${VARIANT_NAMES[question.variant]}?`}
            body="What you've logged stays, but it's checked against the new rules, so a finished day can open up again."
          >
            <Button label={busy ? 'Switching…' : 'Switch'} disabled={busy} style={settingsStyles.flex} onPress={() => void switchVariant(question.variant)} />
            <Button variant="secondary" label="Cancel" disabled={busy} style={settingsStyles.flex} onPress={() => setQuestion(null)} />
          </Confirm>
        )}
        {question?.kind === 'move' && (
          <Confirm
            title="Move the start date?"
            body={`You've already logged progress for Day 1. Moving the start to ${formatDisplayDate(question.date)} clears it — workouts, water, pages, diet, the photo and any badges earned so far.`}
          >
            <Button variant="danger" label={busy ? 'Moving…' : 'Clear & move'} disabled={busy} style={settingsStyles.flex} onPress={() => void move(question.date)} />
            <Button variant="secondary" label="Cancel" disabled={busy} style={settingsStyles.flex} onPress={() => setQuestion(null)} />
          </Confirm>
        )}
      </Sheet>
    </Card>
  )
}

const styles = StyleSheet.create({
  note: { marginTop: 12, overflow: 'hidden', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, lineHeight: 20 },
  dateRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  locked: { marginTop: 12, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  lockedTitle: { fontSize: 14 },
})
