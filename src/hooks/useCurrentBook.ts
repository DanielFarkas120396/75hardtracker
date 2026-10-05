import { useLiveQuery } from 'dexie-react-hooks'
import { bookRepo } from '../db/repositories/bookRepo'
import { SETTING_KEYS, settingsRepo } from '../db/repositories/settingsRepo'

/** Every book, and the one being read (the pages logged move its bookmark). A current book that no longer exists is simply none. */
export function useCurrentBook() {
  const books = useLiveQuery(() => bookRepo.getAll(), []) ?? []
  const currentBookId = useLiveQuery(() => settingsRepo.get<number | null>(SETTING_KEYS.currentBookId, null), [])
  return { books, currentBook: books.find((b) => b.id === currentBookId) }
}
