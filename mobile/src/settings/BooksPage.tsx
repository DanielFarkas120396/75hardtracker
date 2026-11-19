import { validateBook, type BookErrors } from '@logic/books'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Sheet } from '../components/ui/Sheet'
import { bookRepo } from '../db/repositories/bookRepo'
import type { Book } from '../db/types'
import { useLiveQuery } from '../db/useLiveQuery'
import { expoStore } from '../files/store'
import { useTheme } from '../theme/ThemeProvider'
import { Card, CardTitle, Confirm, Input, Muted, settingsStyles } from './rows'

type Open = { kind: 'form'; book: Book | null } | { kind: 'delete'; book: Book }

/** Your books: tap one to edit its title or pages; deleting asks first. The form and the question share one sheet. */
export function BooksPage() {
  const { colors, fonts } = useTheme()
  const books = useLiveQuery(() => bookRepo.getAll(), []) ?? []
  const [open, setOpen] = useState<Open | null>(null)
  const close = () => setOpen(null)

  return (
    <Card>
      <CardTitle>Books</CardTitle>
      {books.length > 0 ? (
        <View style={styles.list}>
          {books.map((book) => (
            <View key={book.id} style={[styles.item, { backgroundColor: colors.canvas }]}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${book.title}`} onPress={() => setOpen({ kind: 'form', book })} style={styles.itemText}>
                <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>
                  {book.title} {book.finished && '✓'}
                </Text>
                <Muted size={12} top={0}>
                  {book.currentPage} / {book.totalPages} pages
                </Muted>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${book.title}`} onPress={() => setOpen({ kind: 'delete', book })} style={styles.remove}>
                <Text style={[styles.cross, { color: colors.inkMuted }]}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Muted top={12}>No books added yet.</Muted>
      )}
      <Button variant="secondary" label="+ Add book" onPress={() => setOpen({ kind: 'form', book: null })} style={settingsStyles.top} />

      <Sheet open={open !== null} onClose={close} label={open?.kind === 'delete' ? 'Delete this book?' : open?.book ? 'Edit book' : 'Add a book'}>
        {open?.kind === 'form' && <BookForm key={open.book?.id ?? 'new'} book={open.book} onDone={close} />}
        {open?.kind === 'delete' && (
          <Confirm title="Delete this book?" body={`“${open.book.title}” and its bookmark will be removed. Pages you've already logged still count.`}>
            <Button
              variant="danger"
              label="Delete"
              style={settingsStyles.flex}
              onPress={() => {
                void bookRepo.remove(open.book.id, expoStore)
                close()
              }}
            />
            <Button variant="secondary" label="Cancel" style={settingsStyles.flex} onPress={close} />
          </Confirm>
        )}
      </Sheet>
    </Card>
  )
}

/** Add or edit a book: title, total pages, and the page you're on. */
function BookForm({ book, onDone }: { book: Book | null; onDone: () => void }) {
  const [title, setTitle] = useState(book?.title ?? '')
  const [totalPages, setTotalPages] = useState(book ? String(book.totalPages) : '')
  const [currentPage, setCurrentPage] = useState(book ? String(book.currentPage) : '')
  const [errors, setErrors] = useState<BookErrors>({})
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const result = validateBook({ title, totalPages, currentPage })
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setSaving(true)
    try {
      if (book) await bookRepo.update(book.id, result.value)
      else await bookRepo.add(result.value)
      onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <View>
      <CardTitle>{book ? 'Edit book' : 'Add a book'}</CardTitle>
      <Field label="Title" error={errors.title}>
        <Input accessibilityLabel="Title" value={title} onChangeText={setTitle} autoComplete="off" />
      </Field>
      <View style={styles.pair}>
        <View style={settingsStyles.flex}>
          <Field label="Total pages" error={errors.totalPages}>
            <Input accessibilityLabel="Total pages" keyboardType="number-pad" placeholder="240" value={totalPages} onChangeText={setTotalPages} />
          </Field>
        </View>
        <View style={settingsStyles.flex}>
          <Field label="On page" error={errors.currentPage}>
            <Input accessibilityLabel="On page" keyboardType="number-pad" placeholder="0" value={currentPage} onChangeText={setCurrentPage} />
          </Field>
        </View>
      </View>
      <View style={styles.buttons}>
        <Button label={saving ? 'Saving…' : 'Save'} disabled={saving} style={settingsStyles.flex} onPress={() => void save()} />
        <Button variant="secondary" label="Cancel" disabled={saving} style={settingsStyles.flex} onPress={onDone} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  list: { marginTop: 12, gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, paddingVertical: 4, paddingLeft: 12, paddingRight: 4 },
  itemText: { flex: 1, minHeight: 48, justifyContent: 'center' },
  title: { fontSize: 16 },
  remove: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  cross: { fontSize: 16 },
  pair: { flexDirection: 'row', gap: 12 },
  buttons: { marginTop: 20, flexDirection: 'row', gap: 8 },
})
