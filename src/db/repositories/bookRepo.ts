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

  async remove(id: number): Promise<void> {
    await db.books.delete(id)
  },
}
