/** How many pages a book can have. */
export const BOOK_PAGES_RANGE = { min: 1, max: 10_000 } as const

export interface BookInput {
  title: string
  totalPages: string
  currentPage: string
}

export interface ValidBook {
  title: string
  totalPages: number
  currentPage: number
}

export type BookErrors = Partial<Record<keyof BookInput, string>>

/** A whole number as typed. Empty input is `undefined`; anything else unparseable is NaN. */
function parseWholeNumber(input: string): number | undefined {
  const trimmed = input.trim()
  if (trimmed === '') return undefined
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN
}

/**
 * Validates a book: a title, its page count (a whole number, 1–10,000) and
 * the page you're on, from 0 up to the last page. An empty current page
 * means you haven't started (0).
 */
export function validateBook(input: BookInput): { ok: true; value: ValidBook } | { ok: false; errors: BookErrors } {
  const errors: BookErrors = {}

  const title = input.title.trim()
  if (title === '') errors.title = 'Enter a title.'

  const totalPages = parseWholeNumber(input.totalPages)
  if (totalPages === undefined) errors.totalPages = 'Enter how many pages it has.'
  else if (Number.isNaN(totalPages)) errors.totalPages = 'Enter a whole number, like 240.'
  else if (totalPages < BOOK_PAGES_RANGE.min || totalPages > BOOK_PAGES_RANGE.max) {
    errors.totalPages = `Between ${BOOK_PAGES_RANGE.min} and ${BOOK_PAGES_RANGE.max.toLocaleString('en-US')} pages.`
  }

  const currentPage = parseWholeNumber(input.currentPage) ?? 0
  if (Number.isNaN(currentPage)) errors.currentPage = 'Enter a whole number, like 35.'
  else if (errors.totalPages === undefined && currentPage > totalPages!) {
    errors.currentPage = `The book ends at page ${totalPages}.`
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, value: { title, totalPages: totalPages!, currentPage } }
}
