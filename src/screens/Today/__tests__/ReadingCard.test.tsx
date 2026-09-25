import { fireEvent, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../db/db'
import { freshDatabase } from '../../../db/__tests__/fixtures'
import type { DayEntry } from '../../../db/types'
import { ReadingCard } from '../ReadingCard'

const entry: DayEntry = {
  id: 1,
  challengeId: 1,
  date: '2026-09-25',
  dayNumber: 1,
  water_ml: 0,
  pages_read: 0,
  dietFollowed: false,
  noAlcohol: false,
  completed: false,
}

/** Types like a keyboard: each key is appended to what the field shows at that moment. */
function typeKeys(input: HTMLElement, text: string) {
  for (const key of text) fireEvent.change(input, { target: { value: (input as HTMLInputElement).value + key } })
}

function openAddBookForm() {
  render(<ReadingCard entry={entry} complete={false} cheer="" />)
  fireEvent.click(screen.getByRole('button', { name: '+ Add book' }))
  typeKeys(screen.getByPlaceholderText('Book title'), 'Atomic Habits')
  const pages = screen.getByLabelText('Total pages')
  fireEvent.change(pages, { target: { value: '' } })
  return pages
}

describe('ReadingCard: adding a book', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it('saves the page count typed after clearing the field', async () => {
    typeKeys(openAddBookForm(), '320')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByRole('button', { name: '+ Add book' }) // the form closes once saved
    expect(await db.books.toArray()).toEqual([expect.objectContaining({ title: 'Atomic Habits', totalPages: 320 })])
  })

  it('refuses to save a book whose page count was cleared', async () => {
    openAddBookForm()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(await db.books.count()).toBe(0)
  })
})
