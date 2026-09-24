import { AnimatePresence, motion } from 'framer-motion'
import { BlobImage } from '../../components/BlobImage'
import type { GalleryEntry } from '../../hooks/useGalleryPhotos'
import { formatDisplayDate } from '../../lib/dates'

interface PhotoLightboxProps {
  entries: GalleryEntry[]
  index: number | null
  onClose: () => void
  onNavigate: (index: number) => void
}

export function PhotoLightbox({ entries, index, onClose, onNavigate }: PhotoLightboxProps) {
  const entry = index !== null ? entries[index] : undefined

  return (
    <AnimatePresence>
      {entry && index !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/90 p-4"
          onClick={onClose}
        >
          <BlobImage
            blob={entry.photo.blob}
            alt={`Day ${entry.dayNumber} progress`}
            className="max-h-[70dvh] max-w-full rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="font-rounded font-bold text-white">
            Attempt #{entry.attemptNumber} — Day {entry.dayNumber} · {formatDisplayDate(entry.date)}
          </p>

          <div className="flex gap-4" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              disabled={index >= entries.length - 1}
              onClick={() => onNavigate(index + 1)}
              className="min-h-touch min-w-touch rounded-full bg-white/10 px-4 font-rounded font-bold text-white disabled:opacity-30"
            >
              ← Older
            </button>
            <button
              type="button"
              disabled={index <= 0}
              onClick={() => onNavigate(index - 1)}
              className="min-h-touch min-w-touch rounded-full bg-white/10 px-4 font-rounded font-bold text-white disabled:opacity-30"
            >
              Newer →
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-xl text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
