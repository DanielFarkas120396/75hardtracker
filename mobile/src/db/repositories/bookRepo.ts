import { getDb, transaction } from '../open'
import { allRows, getRow, insertRow, updateRow } from '../table'
import type { Book } from '../types'

type NewBook = Omit<Book, 'id' | 'finished' | 'finishedAt'>

/**
 * The book with its page inside the book, and `finished`/`finishedAt` in step
 * with it: stamped when the book is first finished, cleared if it drops back.
 */
function settled<T extends Omit<Book, 'id'>>(book: T, now: string): T {
  const currentPage = Math.min(book.totalPages, Math.max(0, book.currentPage))
  const finished = book.totalPages > 0 && currentPage >= book.totalPages
  return { ...book, currentPage, finished, finishedAt: finished ? (book.finished ? book.finishedAt : now) : undefined }
}

/**
 * The books. Same calls and behaviour as the web app's bookRepo
 * (src/db/repositories/bookRepo.ts). `remove` arrives with the Stats screen:
 * it has a cover file to delete too.
 */
export const bookRepo = {
  async getAll(): Promise<Book[]> {
    return allRows(getDb(), 'books')
  },

  async getById(id: number): Promise<Book | undefined> {
    return getRow(getDb(), 'books', id)
  },

  /** Adds a book; `finished` (and `finishedAt`) follow from its page counts. */
  async add(book: NewBook): Promise<number> {
    const row = settled({ ...book, finished: false }, new Date().toISOString())
    return transaction((db) => insertRow(db, 'books', row))
  },

  /** Updates a book; `finished` and `finishedAt` are recomputed from the page counts. */
  async update(id: number, changes: Partial<NewBook>): Promise<void> {
    const now = new Date().toISOString()
    await transaction(async (db) => {
      const book = await getRow(db, 'books', id)
      if (book) await updateRow(db, 'books', id, settled({ ...book, ...changes }, now))
    })
  },

  /** Moves the bookmark by a signed number of pages, kept within the book; stamps finishedAt when it reaches the end. */
  async adjustCurrentPage(id: number, deltaPages: number): Promise<void> {
    const now = new Date().toISOString()
    await transaction(async (db) => {
      const book = await getRow(db, 'books', id)
      if (book) await updateRow(db, 'books', id, settled({ ...book, currentPage: book.currentPage + deltaPages }, now))
    })
  },
}
