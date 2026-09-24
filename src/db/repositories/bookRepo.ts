import { db } from '../db'
import type { Book } from '../types'

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

  async update(id: number, changes: Partial<Book>): Promise<void> {
    await db.books.update(id, changes)
  },

  /** Atomically adjusts currentPage by a signed delta, clamped to [0, totalPages]; marks finished at the end. */
  async adjustCurrentPage(id: number, deltaPages: number): Promise<void> {
    await db.books.where('id').equals(id).modify((book) => {
      book.currentPage = Math.min(book.totalPages, Math.max(0, book.currentPage + deltaPages))
      book.finished = book.currentPage >= book.totalPages
    })
  },

  async remove(id: number): Promise<void> {
    await db.books.delete(id)
  },
}
