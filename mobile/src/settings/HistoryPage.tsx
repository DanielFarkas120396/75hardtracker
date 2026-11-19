import { attemptDayRows, type AttemptDayRow, type AttemptSummary } from '@logic/attempts'
import { dateForDayNumber, formatDisplayDate } from '@logic/dates'
import { TASK_NAMES } from '@logic/microcopy'
import { rulesFor } from '@logic/rulesets'
import type { ChallengeStatus } from '@schema'
import { useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { Icon } from '../components/icons/Icon'
import { Overlay } from '../gallery/parts'
import { PhotoLightbox } from '../gallery/PhotoLightbox'
import { useGalleryPhotos } from '../gallery/useGalleryPhotos'
import { useTheme, type Theme } from '../theme/ThemeProvider'
import { withAlpha } from '../theme/tokens'
import { Card, CardTitle, Muted } from './rows'
import { useAttemptSummaries, type AttemptRecord } from './useAttemptSummaries'

function progressLabel(status: ChallengeStatus, summary: AttemptSummary): string {
  if (status !== 'active') return `Reached Day ${summary.reachedDay}`
  return summary.reachedDay >= 1 ? `On Day ${summary.reachedDay}` : 'Not started yet'
}

function dateRangeLabel(summary: AttemptSummary): string {
  const start = formatDisplayDate(summary.startDate)
  if (summary.endDate) return `${start} – ${formatDisplayDate(summary.endDate)}`
  return summary.reachedDay >= 1 ? `Since ${start}` : `Starts ${start}`
}

function statusColors(status: ChallengeStatus, colors: Theme['colors']): { fill: string; ink: string } {
  if (status === 'active') return { fill: colors.greenLight, ink: colors.greenInk }
  if (status === 'completed') return { fill: colors.yellowLight, ink: colors.yellowInk }
  if (status === 'failed') return { fill: withAlpha(colors.danger, 0.1), ink: colors.dangerInk }
  return { fill: withAlpha(colors.ink, 0.1), ink: colors.ink }
}

function StatusChip({ status }: { status: ChallengeStatus }) {
  const { colors, fonts } = useTheme()
  const tone = statusColors(status, colors)
  return (
    <Text style={[styles.chip, { backgroundColor: tone.fill, color: tone.ink, fontFamily: fonts.rounded.bold }]}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Text>
  )
}

/**
 * Every attempt with how far it got; tapping one opens its days and photos, as a page of its own (the web opens a
 * dialog: here its photos can then open the lightbox, the one Modal). The web's AttemptHistorySection.
 */
export function HistoryPage({ today }: { today: string }) {
  const { colors, fonts } = useTheme()
  const attempts = useAttemptSummaries(today)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const selected = attempts?.find((a) => a.challenge.id === selectedId)

  if (selected) return <AttemptDetail key={selected.challenge.id} attempt={selected} onBack={() => setSelectedId(null)} />

  return (
    <Card>
      <CardTitle>Attempt history</CardTitle>
      <Muted>Tap an attempt to see its days and photos.</Muted>
      <View style={styles.list}>
        {(attempts ?? []).map(({ challenge, summary }) => (
          <Pressable
            key={challenge.id}
            accessibilityRole="button"
            onPress={() => setSelectedId(challenge.id)}
            style={[styles.attempt, { backgroundColor: colors.canvas }]}
          >
            <View style={styles.flex}>
              <Text style={[styles.attemptTitle, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>
                Attempt #{challenge.attemptNumber} · {progressLabel(challenge.status, summary)}
              </Text>
              <Muted size={12} top={0}>
                {dateRangeLabel(summary)}
              </Muted>
            </View>
            <StatusChip status={challenge.status} />
          </Pressable>
        ))}
      </View>
    </Card>
  )
}

/** One attempt's days (✓ runs, and what each other day missed) and its photos. */
function AttemptDetail({ attempt, onBack }: { attempt: AttemptRecord; onBack: () => void }) {
  const { colors, fonts } = useTheme()
  const { challenge, summary, days, entries } = attempt
  const photos = useGalleryPhotos(entries, challenge.attemptNumber)
  const [photoIndex, setPhotoIndex] = useState<number | null>(null)
  const rows = attemptDayRows(days, summary.reachedDay, rulesFor(challenge), challenge.restoredDays)

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Attempt history" onPress={onBack} style={styles.back}>
        <View style={styles.flip}>
          <Icon name="chevron" size={18} color={colors.worldInk} />
        </View>
        <Text style={[styles.backLabel, { color: colors.worldInk, fontFamily: fonts.rounded.bold }]}>Attempt history</Text>
      </Pressable>
      <Card>
        <View style={styles.detailHead}>
          <View style={styles.flex}>
            <CardTitle>Attempt #{challenge.attemptNumber}</CardTitle>
            <Muted top={0}>{dateRangeLabel(summary)}</Muted>
          </View>
          <StatusChip status={challenge.status} />
        </View>
        <Text style={[styles.progress, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>
          {progressLabel(challenge.status, summary)} · {summary.completedDays} perfect {summary.completedDays === 1 ? 'day' : 'days'}
        </Text>

        <Text accessibilityRole="header" style={[styles.subhead, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>
          Days
        </Text>
        {rows.length === 0 ? (
          <Muted>Nothing to show until Day 1.</Muted>
        ) : (
          <View style={styles.rows}>
            {rows.map((row) => (
              <DayRow
                key={row.kind === 'complete' ? row.fromDay : row.dayNumber}
                row={row}
                startDate={challenge.startDate}
                // The running attempt's current day isn't missed yet — it's in progress.
                inProgress={challenge.status === 'active' && row.kind === 'incomplete' && row.dayNumber === summary.reachedDay}
                // A given-up attempt's last day wasn't missed either: it's the day it ended.
                givenUp={challenge.status === 'abandoned' && row.kind === 'incomplete' && row.dayNumber === summary.reachedDay}
              />
            ))}
          </View>
        )}

        <Text accessibilityRole="header" style={[styles.subhead, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>
          Photos
        </Text>
        {photos && photos.length > 0 ? (
          <View style={styles.grid}>
            {photos.map((entry, i) => (
              <Pressable
                key={entry.photo.id}
                accessibilityRole="button"
                accessibilityLabel={`Day ${entry.dayNumber} progress`}
                onPress={() => setPhotoIndex(i)}
                style={[styles.thumb, { backgroundColor: colors.worldSoft }]}
              >
                <Image source={{ uri: entry.photo.uri }} style={StyleSheet.absoluteFill} />
              </Pressable>
            ))}
          </View>
        ) : (
          photos && <Muted>No photos in this attempt.</Muted>
        )}
      </Card>

      <Overlay open={photoIndex !== null} onClose={() => setPhotoIndex(null)}>
        {photoIndex !== null && photos && (
          <PhotoLightbox entries={photos} index={photoIndex} onClose={() => setPhotoIndex(null)} onNavigate={setPhotoIndex} />
        )}
      </Overlay>
    </>
  )
}

function DayRow({ row, startDate, inProgress, givenUp }: { row: AttemptDayRow; startDate: string; inProgress: boolean; givenUp: boolean }) {
  const { colors, fonts } = useTheme()
  const dateOf = (dayNumber: number) => formatDisplayDate(dateForDayNumber(startDate, dayNumber))
  const line = (mark: string, markColor: string | undefined, title: string, rest: string) => (
    <View style={styles.dayRow}>
      <Text accessibilityElementsHidden importantForAccessibility="no" style={[styles.mark, { color: markColor, fontFamily: fonts.rounded.bold }]}>
        {mark}
      </Text>
      <Text style={[styles.dayText, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>
        <Text style={{ color: colors.ink, fontFamily: fonts.rounded.bold }}>{title}</Text>
        {rest}
      </Text>
    </View>
  )

  if (row.kind === 'complete') {
    const single = row.fromDay === row.toDay
    return line(
      '✓',
      colors.greenInk,
      single ? `Day ${row.fromDay}` : `Days ${row.fromDay}–${row.toDay}`,
      ` · ${single ? dateOf(row.fromDay) : `${dateOf(row.fromDay)} – ${dateOf(row.toDay)}`} · all done`,
    )
  }
  if (givenUp) return line('🏳️', undefined, `Day ${row.dayNumber}`, ` · ${dateOf(row.dayNumber)} · gave up`)
  const missed = row.missing.map((task) => TASK_NAMES[task]).join(', ')
  return line(
    inProgress ? '…' : '✗',
    inProgress ? colors.inkMuted : colors.dangerInk,
    `Day ${row.dayNumber}`,
    ` · ${dateOf(row.dayNumber)} ${inProgress ? `(today) · to go: ${missed}` : `· missed ${missed}`}`,
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { marginTop: 12, gap: 8 },
  attempt: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  attemptTitle: { fontSize: 16 },
  chip: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, fontSize: 12 },
  back: { minHeight: 48, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: -8, paddingHorizontal: 8 },
  flip: { transform: [{ rotate: '180deg' }] },
  backLabel: { fontSize: 16 },
  detailHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  progress: { marginTop: 12, fontSize: 16 },
  subhead: { marginTop: 16, fontSize: 16 },
  rows: { marginTop: 8, gap: 6 },
  dayRow: { flexDirection: 'row', gap: 8 },
  mark: { width: 20, fontSize: 14, lineHeight: 20 },
  dayText: { flex: 1, fontSize: 14, lineHeight: 20 },
  grid: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: '31%', aspectRatio: 1, overflow: 'hidden', borderRadius: 12 },
})
