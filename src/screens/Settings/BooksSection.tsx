import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { bookRepo } from '../../db/repositories/bookRepo'
import type { Book } from '../../db/types'
import { validateBook, type BookErrors } from '../../logic/books'

/** Your books: tap one to edit its title or pages; deleting asks first. */
export function BooksSection() {
  const books = useLiveQuery(() => bookRepo.getAll(), []) ?? []
  const [editing, setEditing] = useState<Book | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<Book | null>(null)

  const openForm = (book: Book | null) => {
    setEditing(book)
    setFormOpen(true)
  }

  return (
    <section className="rounded-card bg-surface p-4 shadow-sm">
      <h2 className="font-rounded text-lg font-extrabold text-ink">📚 Books</h2>

      {books.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {books.map((book) => (
            <li key={book.id} className="flex items-center gap-2 rounded-2xl bg-canvas py-1 pr-1 pl-3">
              <button
                type="button"
                onClick={() => openForm(book)}
                className="min-h-touch flex-1 text-left"
                aria-label={`Edit ${book.title}`}
              >
                <span className="block font-rounded font-bold text-ink">
                  {book.title} {book.finished && '✓'}
                </span>
                <span className="block text-xs text-ink-muted">
                  {book.currentPage} / {book.totalPages} pages
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDeleting(book)}
                aria-label={`Delete ${book.title}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink-muted"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">No books added yet.</p>
      )}

      <Button variant="secondary" className="mt-3 w-full" onClick={() => openForm(null)}>
        + Add book
      </Button>

      <Modal open={formOpen} onClose={() => setFormOpen(false)}>
        {/* Keyed so each open starts from the book being edited (or a blank form). */}
        <BookForm key={editing?.id ?? 'new'} book={editing} onDone={() => setFormOpen(false)} />
      </Modal>

      <Modal open={deleting !== null} onClose={() => setDeleting(null)}>
        <h3 className="font-rounded text-lg font-extrabold text-ink">Delete this book?</h3>
        <p className="mt-2 text-sm text-ink-muted">
          {deleting && `“${deleting.title}” and its bookmark will be removed. Pages you've already logged still count.`}
        </p>
        <div className="mt-4 flex gap-2">
          <Button
            variant="danger"
            className="flex-1"
            onClick={() => {
              if (deleting) void bookRepo.remove(deleting.id)
              setDeleting(null)
            }}
          >
            Delete
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </section>
  )
}

/** Add or edit a book: title, total pages, and the page you're on. */
function BookForm({ book, onDone }: { book: Book | null; onDone: () => void }) {
  const [title, setTitle] = useState(book?.title ?? '')
  const [totalPages, setTotalPages] = useState(book ? String(book.totalPages) : '')
  const [currentPage, setCurrentPage] = useState(book ? String(book.currentPage) : '')
  const [errors, setErrors] = useState<BookErrors>({})
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const result = validateBook({ title, totalPages, currentPage })
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setSaving(true)
    try {
      if (book) await bookRepo.update(book.id, result.value)
      else await bookRepo.add(result.value)
      onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
      noValidate
    >
      <h3 className="font-rounded text-lg font-extrabold text-ink">{book ? 'Edit book' : 'Add a book'}</h3>

      <Field label="Title" error={errors.title}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoComplete="off"
          className="min-h-touch w-full rounded-xl bg-canvas px-3 font-rounded font-bold text-ink"
        />
      </Field>

      <div className="grid grid-cols-2 gap-x-3">
        <Field label="Total pages" error={errors.totalPages}>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="240"
            value={totalPages}
            onChange={(e) => setTotalPages(e.target.value)}
            className="min-h-touch w-full rounded-xl bg-canvas px-3 font-rounded font-bold text-ink"
          />
        </Field>
        <Field label="On page" error={errors.currentPage}>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={currentPage}
            onChange={(e) => setCurrentPage(e.target.value)}
            className="min-h-touch w-full rounded-xl bg-canvas px-3 font-rounded font-bold text-ink"
          />
        </Field>
      </div>

      <div className="mt-5 flex gap-2">
        <Button type="submit" variant="primary" className="flex-1" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="secondary" className="flex-1" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
