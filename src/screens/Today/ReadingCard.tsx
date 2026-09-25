import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Stepper } from '../../components/ui/Stepper'
import { bookRepo } from '../../db/repositories/bookRepo'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import { SETTING_KEYS, settingsRepo } from '../../db/repositories/settingsRepo'
import type { DayEntry } from '../../db/types'
import { PAGES_TARGET } from '../../logic/constants'

interface ReadingCardProps {
  entry: DayEntry
  complete: boolean
  cheer: string
}

export function ReadingCard({ entry, complete, cheer }: ReadingCardProps) {
  const books = useLiveQuery(() => bookRepo.getAll(), []) ?? []
  const currentBookId = useLiveQuery(() => settingsRepo.get<number | null>(SETTING_KEYS.currentBookId, null), [])
  const currentBook = books.find((b) => b.id === currentBookId)

  const [showAddBook, setShowAddBook] = useState(false)

  const stepPages = (delta: number) => {
    void dayEntryRepo.adjustPages(entry.id, delta)
    if (currentBook) void bookRepo.adjustCurrentPage(currentBook.id, delta)
  }
  const pagesLeft = Math.max(0, PAGES_TARGET - entry.pages_read)

  return (
    <Card complete={complete} cheer={cheer}>
      <h2 className="font-rounded text-lg font-extrabold text-ink">📖 Reading</h2>
      <p className="mt-1 text-sm text-ink-muted">{PAGES_TARGET} pages of non-fiction a day.</p>

      <div className="mt-4">
        {books.length > 0 ? (
          <>
            {/* A current book that no longer exists falls back to "Pick a book…". */}
            <select
              value={currentBook?.id ?? ''}
              onChange={(e) => void settingsRepo.set(SETTING_KEYS.currentBookId, Number(e.target.value))}
              aria-label="Current book"
              className="min-h-touch w-full rounded-xl bg-canvas px-3 font-rounded font-bold text-ink"
            >
              <option value="" disabled>
                Pick a book…
              </option>
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title} {book.finished ? '✓' : ''}
                </option>
              ))}
            </select>
            {!currentBook && (
              <p className="mt-1 text-xs text-ink-muted">
                Pick the book you're reading, and the pages you log move its bookmark.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-ink-muted">No books yet — add one below.</p>
        )}

        {showAddBook ? (
          <AddBookForm onDone={() => setShowAddBook(false)} />
        ) : (
          <Button variant="secondary" className="mt-2 w-full" onClick={() => setShowAddBook(true)}>
            + Add book
          </Button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <Stepper value={entry.pages_read} onStep={stepPages} step={1} min={0} max={999} unit="pages" />
        {/* One tap logs the rest of today's pages; the stepper fine-tunes. */}
        {pagesLeft > 0 && (
          <Button variant="secondary" className="px-4 py-2" onClick={() => stepPages(pagesLeft)}>
            + {pagesLeft} pages
          </Button>
        )}
      </div>
    </Card>
  )
}

function AddBookForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState('')
  const [totalPages, setTotalPages] = useState(200)

  const submit = async () => {
    if (!title.trim()) return
    const id = await bookRepo.add({ title: title.trim(), totalPages, currentPage: 0 })
    await settingsRepo.set(SETTING_KEYS.currentBookId, id)
    onDone()
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-2xl bg-canvas p-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Book title"
        className="min-h-touch rounded-xl bg-surface px-3 font-rounded text-ink"
      />
      <label className="flex items-center justify-between text-sm font-semibold text-ink-muted">
        Total pages
        <input
          type="number"
          value={totalPages}
          onChange={(e) => setTotalPages(Math.max(1, Number(e.target.value)))}
          className="min-h-touch w-24 rounded-xl bg-surface px-3 text-right font-rounded text-ink"
        />
      </label>
      <div className="flex gap-2">
        <Button variant="primary" className="flex-1" onClick={submit}>
          Save
        </Button>
        <Button variant="secondary" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
