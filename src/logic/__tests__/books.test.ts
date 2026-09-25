import { describe, expect, it } from 'vitest'
import { validateBook } from '../books'

describe('validateBook', () => {
  it('accepts a book, trimming the title; an empty current page means not started', () => {
    expect(validateBook({ title: '  Atomic Habits ', totalPages: '320', currentPage: '' })).toEqual({
      ok: true,
      value: { title: 'Atomic Habits', totalPages: 320, currentPage: 0 },
    })
  })

  it('accepts a current page on the last page (a finished book)', () => {
    expect(validateBook({ title: 'Deep Work', totalPages: '296', currentPage: '296' })).toMatchObject({ ok: true })
  })

  it('requires a title and a page count', () => {
    const result = validateBook({ title: '   ', totalPages: '', currentPage: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['title', 'totalPages'])
  })

  it('rejects page counts that are not whole numbers in range', () => {
    for (const totalPages of ['0', '12.5', 'abc', '-3', '20000']) {
      const result = validateBook({ title: 'Book', totalPages, currentPage: '0' })
      expect(result.ok, totalPages).toBe(false)
      if (!result.ok) expect(result.errors.totalPages, totalPages).toBeDefined()
    }
  })

  it('rejects a current page past the end, or one that is not a whole number', () => {
    const pastEnd = validateBook({ title: 'Book', totalPages: '200', currentPage: '201' })
    expect(pastEnd).toEqual({ ok: false, errors: { currentPage: 'The book ends at page 200.' } })

    const notANumber = validateBook({ title: 'Book', totalPages: '200', currentPage: 'ten' })
    expect(notANumber.ok).toBe(false)
    if (!notANumber.ok) expect(notANumber.errors.currentPage).toBeDefined()
  })
})
