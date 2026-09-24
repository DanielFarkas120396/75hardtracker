import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { bookRepo } from '../../db/repositories/bookRepo'

export function BooksSection() {
  const books = useLiveQuery(() => bookRepo.getAll(), []) ?? []
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState('')
  const [totalPages, setTotalPages] = useState(200)

  const addBook = async () => {
    if (!title.trim()) return
    await bookRepo.add({ title: title.trim(), totalPages, currentPage: 0, finished: false })
    setTitle('')
    setTotalPages(200)
    setShowAdd(false)
  }

  return (
    <section className="rounded-card bg-surface p-4 shadow-sm">
      <h2 className="font-rounded text-lg font-extrabold text-ink">📚 Books</h2>

      <div className="mt-3 flex flex-col gap-2">
        {books.map((book) => (
          <div key={book.id} className="flex items-center justify-between gap-2 rounded-2xl bg-canvas px-3 py-2">
            <div>
              <p className="font-rounded font-bold text-ink">
                {book.title} {book.finished && '✓'}
              </p>
              <p className="text-xs text-ink-muted">
                {book.currentPage} / {book.totalPages} pages
              </p>
            </div>
            <button
              type="button"
              onClick={() => void bookRepo.remove(book.id)}
              aria-label={`Remove ${book.title}`}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-muted"
            >
              ✕
            </button>
          </div>
        ))}
        {books.length === 0 && <p className="text-sm text-ink-muted">No books added yet.</p>}
      </div>

      {showAdd ? (
        <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-canvas p-3">
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
            <Button variant="primary" className="flex-1" onClick={() => void addBook()}>
              Save
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" className="mt-3 w-full" onClick={() => setShowAdd(true)}>
          + Add book
        </Button>
      )}
    </section>
  )
}
