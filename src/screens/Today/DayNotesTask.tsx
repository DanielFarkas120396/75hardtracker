import { useEffect, useId, useRef, useState } from 'react'
import { MoodPicker } from '../../components/MoodPicker'
import type { Mood } from '../../content/moods'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import type { DayEntry } from '../../db/types'

/** How long typing has to pause before notes are saved. */
const NOTES_SAVE_DELAY_MS = 600

interface DayNotesTaskProps {
  entry: DayEntry
}

/** The mood sheet's body: the five moods and the notes. Neither counts toward completing the day. */
export function DayNotesTask({ entry }: DayNotesTaskProps) {
  const setMood = (mood: Mood) => {
    void dayEntryRepo.update(entry.id, { mood: entry.mood === mood ? undefined : mood })
  }

  return (
    <div>
      <MoodPicker label="Mood" value={entry.mood} onPick={setMood} selectedClassName="bg-yellow-light ring-2 ring-yellow-ink" />

      {/* Keyed by entry so the text resets on a new day. */}
      <NotesField key={entry.id} entry={entry} />
    </div>
  )
}

/** Blank notes are stored as "no notes". */
const toNotes = (value: string) => (value.trim() === '' ? undefined : value)

/** Notes are saved once typing pauses, on blur, and — if still pending — when the sheet closes. */
function NotesField({ entry }: { entry: DayEntry }) {
  const fieldId = useId()
  const [text, setText] = useState(entry.notes ?? '')
  const [saved, setSaved] = useState(true)
  const pendingText = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // This field is keyed by entry, so entry.id never changes here.
  const entryId = entry.id

  const flush = () => {
    clearTimeout(timer.current)
    if (pendingText.current === null) return
    void dayEntryRepo.update(entryId, { notes: toNotes(pendingText.current) }).then(() => setSaved(true))
    pendingText.current = null
  }

  // Save anything still pending when the field unmounts (closing the sheet mid-sentence).
  useEffect(() => {
    const timerRef = timer
    const pendingRef = pendingText
    return () => {
      clearTimeout(timerRef.current)
      if (pendingRef.current !== null) void dayEntryRepo.update(entryId, { notes: toNotes(pendingRef.current) })
    }
  }, [entryId])

  const onChange = (value: string) => {
    setText(value)
    setSaved(false)
    pendingText.current = value
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, NOTES_SAVE_DELAY_MS)
  }

  // The save status sits outside the label so it doesn't become part of the field's name.
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between text-sm font-semibold text-ink-muted">
        <label htmlFor={fieldId}>Notes</label>
        <span className="text-xs font-normal" aria-live="polite">
          {saved ? (text ? 'Saved' : '') : 'Saving…'}
        </span>
      </div>
      <textarea
        id={fieldId}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onBlur={flush}
        rows={3}
        placeholder="What went well? What was hard?"
        className="mt-1 w-full resize-y rounded-xl bg-canvas px-3 py-2 font-rounded text-ink"
      />
    </div>
  )
}
