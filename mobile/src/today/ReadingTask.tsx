import { validateBook, type BookErrors } from '@logic/books'
import type { Ruleset } from '@logic/rulesets'
import { SETTING_KEYS } from '@logic/settingKeys'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Button } from '../components/ui/Button'
import { Stepper } from '../components/ui/controls'
import { bookRepo } from '../db/repositories/bookRepo'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import { settingsRepo } from '../db/repositories/settingsRepo'
import type { DayEntry } from '../db/types'
import { useAnnounceChanges } from '../hooks/useAnnounce'
import { useTheme } from '../theme/ThemeProvider'
import { withAlpha } from '../theme/tokens'
import { useCurrentBook } from './hooks'

// The reading sheet, as on the web (src/screens/Today/ReadingTask.tsx).

/** The reading sheet's body: the book being read, and the pages. */
export function ReadingTask({ entry, rules }: { entry: DayEntry; rules: Ruleset }) {
  const { currentBook } = useCurrentBook()

  const stepPages = (delta: number) => {
    void dayEntryRepo.adjustPages(entry.id, delta)
    if (!currentBook) return
    void bookRepo.adjustCurrentPage(currentBook.id, delta)
    // The day remembers its book, for its card on the Journey: the last one read wins.
    if (entry.bookId !== currentBook.id) void dayEntryRepo.setBook(entry.id, currentBook.id)
  }
  const pagesLeft = Math.max(0, rules.pagesTarget - entry.pages_read)

  return (
    <View>
      <BookPicker />
      <View style={styles.pages}>
        <Stepper value={entry.pages_read} onStep={stepPages} step={1} min={0} max={999} unit="pages" />
        {/* One tap logs the rest of today's pages; the stepper fine-tunes. */}
        {pagesLeft > 0 && <Button label={`+ ${pagesLeft} pages`} variant="secondary" onPress={() => stepPages(pagesLeft)} style={styles.rest} />}
      </View>
    </View>
  )
}

/**
 * The book being read, and adding one: in the reading sheet, and before Day 1.
 * The web shows the books in a drop-down; here they are a short list to tap.
 */
export function BookPicker() {
  const { colors, fonts } = useTheme()
  const { books, currentBook } = useCurrentBook()
  const [showAddBook, setShowAddBook] = useState(false)
  const muted = { color: colors.inkMuted, fontFamily: fonts.rounded.regular }

  return (
    <View>
      {books.length > 0 ? (
        <>
          <View accessibilityRole="radiogroup" accessibilityLabel="Current book" style={styles.books}>
            {books.map((book) => {
              const selected = book.id === currentBook?.id
              return (
                <Pressable
                  key={book.id}
                  accessibilityRole="radio"
                  accessibilityLabel={book.finished ? `${book.title}, finished` : book.title}
                  accessibilityState={{ checked: selected }}
                  onPress={() => void settingsRepo.set(SETTING_KEYS.currentBookId, book.id)}
                  style={[
                    styles.book,
                    { backgroundColor: selected ? colors.worldSoft : colors.canvas, borderColor: selected ? colors.worldInk : 'transparent' },
                  ]}
                >
                  <Text numberOfLines={1} style={[styles.bookTitle, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>
                    {book.title} {book.finished ? '✓' : ''}
                  </Text>
                  <Text style={[styles.small, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}>
                    {book.currentPage}/{book.totalPages}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          {!currentBook && <Text style={[styles.tiny, styles.gapSmall, muted]}>Pick the book you&apos;re reading, and the pages you log move its bookmark.</Text>}
        </>
      ) : (
        <Text style={[styles.small, muted]}>No books yet — add one below.</Text>
      )}

      {showAddBook ? (
        <AddBookForm onDone={() => setShowAddBook(false)} />
      ) : (
        <Button label="+ Add book" variant="secondary" onPress={() => setShowAddBook(true)} style={styles.gapSmall} />
      )}
    </View>
  )
}

function AddBookForm({ onDone }: { onDone: () => void }) {
  const { colors, fonts } = useTheme()
  const [title, setTitle] = useState('')
  // Kept as typed, so the field can be cleared and retyped; validated on save.
  const [totalPages, setTotalPages] = useState('200')
  const [errors, setErrors] = useState<BookErrors>({})
  useAnnounceChanges([errors.title, errors.totalPages].filter((line) => line !== undefined).join(' '))

  const submit = async () => {
    const result = validateBook({ title, totalPages, currentPage: '' })
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    const id = await bookRepo.add(result.value)
    await settingsRepo.set(SETTING_KEYS.currentBookId, id)
    onDone()
  }

  const field = { backgroundColor: colors.surface, color: colors.ink, fontFamily: fonts.rounded.regular, borderColor: withAlpha(colors.ink, 0.15) }
  const alert = { color: colors.dangerInk, fontFamily: fonts.rounded.semibold }

  return (
    <View style={[styles.form, { backgroundColor: colors.canvas }]}>
      <TextInput
        accessibilityLabel="Book title"
        value={title}
        onChangeText={setTitle}
        placeholder="Book title"
        placeholderTextColor={colors.inkMuted}
        style={[styles.field, field]}
      />
      {errors.title !== undefined && (
        <Text accessibilityRole="alert" style={[styles.small, alert]}>
          {errors.title}
        </Text>
      )}
      <View style={styles.total}>
        <Text style={[styles.small, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}>Total pages</Text>
        <TextInput
          accessibilityLabel="Total pages"
          value={totalPages}
          onChangeText={setTotalPages}
          keyboardType="number-pad"
          autoComplete="off"
          style={[styles.field, styles.number, field]}
        />
      </View>
      {errors.totalPages !== undefined && (
        <Text accessibilityRole="alert" style={[styles.small, alert]}>
          {errors.totalPages}
        </Text>
      )}
      <View style={styles.actions}>
        <Button label="Save" onPress={() => void submit()} style={styles.action} />
        <Button label="Cancel" variant="secondary" onPress={onDone} style={styles.action} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  pages: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 12 },
  rest: { paddingHorizontal: 16 },
  books: { gap: 6 },
  book: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 12, borderWidth: 2, paddingHorizontal: 12 },
  bookTitle: { flex: 1, fontSize: 16 },
  small: { fontSize: 14 },
  tiny: { fontSize: 12 },
  gapSmall: { marginTop: 8 },
  form: { marginTop: 8, gap: 8, borderRadius: 16, padding: 12 },
  field: { minHeight: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, fontSize: 16 },
  number: { width: 96, textAlign: 'right' },
  total: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
})
