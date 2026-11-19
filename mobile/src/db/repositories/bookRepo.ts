import { SETTING_KEYS } from '@logic/settingKeys'
import { picturePath } from '../../files/pictures'
import type { FileStore } from '../../files/store'
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
 * (src/db/repositories/bookRepo.ts).
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

  /** Deletes a book (no longer the current one if it was), then its cover file. Pages already logged still count. */
  async remove(id: number, store: FileStore): Promise<void> {
    const coverFile = await transaction(async (db) => {
      const book = await getRow(db, 'books', id)
      await db.runAsync('DELETE FROM books WHERE id = ?', [id])
      const current = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [SETTING_KEYS.currentBookId])
      if (current && JSON.parse(current.value) === id) {
        await db.runAsync('UPDATE settings SET value = ? WHERE key = ?', ['null', SETTING_KEYS.currentBookId])
      }
      return book?.coverFile
    })
    if (coverFile) {
      try {
        store.deleteFile(picturePath('covers', coverFile))
      } catch (error) {
        console.error(error)
      }
    }
  },
}
