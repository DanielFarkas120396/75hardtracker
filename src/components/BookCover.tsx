import { bookRepo } from '../db/repositories/bookRepo'
import type { Book } from '../db/types'
import { shrinkImage } from '../lib/images'
import { BlobImage } from './BlobImage'
import { Icon } from './icons/Icon'

const SIZES = { sm: 'h-14 w-11', md: 'h-20 w-14' } as const

/** A book's cover; tapping it picks a new one from the photo library. Without one, a dashed "+" invites you to add it. */
export function BookCover({ book, size = 'md' }: { book: Book; size?: keyof typeof SIZES }) {
  const pick = async (input: HTMLInputElement) => {
    const file = input.files?.[0]
    input.value = ''
    if (file) await bookRepo.update(book.id, { cover: await shrinkImage(file) })
  }

  return (
    <label
      className={`relative flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md ${SIZES[size]} ${
        book.cover ? '' : 'border-2 border-dashed border-ink/25 text-world-ink'
      }`}
    >
      {book.cover ? <BlobImage blob={book.cover} alt="" className="h-full w-full object-cover" /> : <Icon name="plus" size={20} />}
      <input
        type="file"
        accept="image/*"
        aria-label={book.cover ? `Change the cover of ${book.title}` : `Add a cover for ${book.title}`}
        className="sr-only"
        onChange={(e) => void pick(e.target)}
      />
    </label>
  )
}
