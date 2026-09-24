import { db } from '../db'
import type { Book } from '../types'

/** Keeps `finished`/`finishedAt` in step with the page count: stamped when a book is first finished, cleared if it drops back. */
function applyFinishedState(book: Book, now: string): void {
  const finished = book.totalPages > 0 && book.currentPage >= book.totalPages
  if (finished && !book.finished) book.finishedAt = now
  if (!finished) delete book.finishedAt
  book.finished = finished
}

export const bookRepo = {
  async getAll(): Promise<Book[]> {
    return db.books.toArray()
  },

  async getById(id: number): Promise<Book | undefined> {
    return db.books.get(id)
  },

  async add(book: Omit<Book, 'id'>): Promise<number> {
    return db.books.add(book as Book)
  },

  /** Updates a book; if the title or page counts change, `finished` and `finishedAt` are recomputed. */
  async update(id: number, changes: Partial<Omit<Book, 'id' | 'finished' | 'finishedAt'>>): Promise<void> {
    const now = new Date().toISOString()
    await db.books
      .where('id')
      .equals(id)
      .modify((book) => {
        Object.assign(book, changes)
        book.currentPage = Math.min(book.totalPages, Math.max(0, book.currentPage))
        applyFinishedState(book, now)
      })
  },

  /** Atomically adjusts currentPage by a signed delta, clamped to [0, totalPages]; stamps finishedAt when it reaches the end. */
  async adjustCurrentPage(id: number, deltaPages: number): Promise<void> {
    const now = new Date().toISOString()
    await db.books
      .where('id')
      .equals(id)
      .modify((book) => {
        book.currentPage = Math.min(book.totalPages, Math.max(0, book.currentPage + deltaPages))
        applyFinishedState(book, now)
      })
  },

  async remove(id: number): Promise<void> {
    await db.books.delete(id)
  },
}
