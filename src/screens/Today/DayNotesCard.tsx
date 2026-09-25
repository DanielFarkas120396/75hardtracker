import { useEffect, useId, useRef, useState } from 'react'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import type { DayEntry } from '../../db/types'

type Mood = NonNullable<DayEntry['mood']>

const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 1, emoji: '😫', label: 'Rough' },
  { value: 2, emoji: '😕', label: 'Meh' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
]

/** How long typing has to pause before notes are saved. */
const NOTES_SAVE_DELAY_MS = 600

interface DayNotesCardProps {
  entry: DayEntry
}

/** Optional mood and notes for the day. Neither counts toward completing it. */
export function DayNotesCard({ entry }: DayNotesCardProps) {
  const setMood = (mood: Mood) => {
    void dayEntryRepo.update(entry.id, { mood: entry.mood === mood ? undefined : mood })
  }

  return (
    <section className="rounded-card border-2 border-transparent bg-surface p-4 shadow-sm dark:border-white/5">
      <h2 className="font-rounded text-lg font-extrabold text-ink">📝 How was today?</h2>
      <p className="mt-1 text-sm text-ink-muted">Optional — just for you. It doesn't affect completing the day.</p>

      <div role="group" aria-label="Mood" className="mt-3 grid grid-cols-5 gap-1">
        {MOODS.map((mood) => {
          const selected = entry.mood === mood.value
          return (
            <button
              key={mood.value}
              type="button"
              aria-pressed={selected}
              onClick={() => setMood(mood.value)}
              className={`flex min-h-touch flex-col items-center justify-center rounded-2xl py-1 motion-safe:transition-transform ${
                selected ? 'scale-105 bg-yellow-light ring-2 ring-yellow-ink' : 'bg-canvas'
              }`}
            >
              <span className="text-2xl" aria-hidden="true">
                {mood.emoji}
              </span>
              <span className="text-[11px] font-bold text-ink-muted">{mood.label}</span>
            </button>
          )
        })}
      </div>

      {/* Keyed by entry so the text resets on a new day. */}
      <NotesField key={entry.id} entry={entry} />
    </section>
  )
}

/** Blank notes are stored as "no notes". */
const toNotes = (value: string) => (value.trim() === '' ? undefined : value)

/** Notes are saved once typing pauses, on blur, and — if still pending — when the card unmounts. */
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

  // Save anything still pending when the card unmounts (e.g. switching tabs mid-sentence).
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
