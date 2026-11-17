import { useMemo, useState } from 'react'
import { BlobImage } from '../../components/BlobImage'
import { Icon } from '../../components/icons/Icon'
import { Mascot } from '../../components/mascot/Mascot'
import { Button } from '../../components/ui/Button'
import { useGalleryPhotos } from '../../hooks/useGalleryPhotos'
import { PhotoCompare } from './PhotoCompare'
import { PhotoLightbox } from './PhotoLightbox'
import { PhotoThumbnail } from './PhotoThumbnail'

interface GalleryScreenProps {
  /** The current attempt: the Gallery shows its photos only. */
  challengeId: number
  /** Goes to Today with its camera open (from the empty state). */
  onTakePhoto: () => void
}

/** This attempt's progress photos in one grid, newest first, with Compare on top. */
export function GalleryScreen({ challengeId, onTakePhoto }: GalleryScreenProps) {
  const entries = useGalleryPhotos(challengeId)
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [comparing, setComparing] = useState(false)
  // Newest first in the gallery; oldest first for Compare.
  const oldestFirst = useMemo(() => (entries ?? []).toReversed(), [entries])
  const first = oldestFirst[0]
  const latest = oldestFirst.at(-1)

  return (
    <div className="min-h-dvh bg-canvas pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      <header className="px-4 pt-6 pb-4">
        <h1 className="flex items-center gap-2 font-display text-2xl tracking-wide text-ink">
          <Icon name="gallery" className="text-world-ink" />
          Gallery
        </h1>
        <p className="font-rounded text-sm text-ink-muted">This attempt's progress photos.</p>
      </header>

      <main className="flex flex-col gap-5 px-4">
        {!entries ? (
          <p className="font-rounded text-ink-muted">Loading…</p>
        ) : entries.length === 0 ? (
          <section className="flex flex-col items-center gap-3 rounded-card bg-world-soft px-6 py-8 text-center">
            <div className="relative">
              <Mascot mood="content" size={120} decorative />
              <span className="absolute -right-2 bottom-2 flex h-11 w-11 items-center justify-center rounded-full bg-surface text-world-ink">
                <Icon name="photo" size={26} />
              </span>
            </div>
            <h2 className="font-display text-xl tracking-wide text-ink">No photos yet</h2>
            <p className="max-w-xs font-rounded text-sm text-ink-muted">
              One photo a day, and in 75 days you'll see how far you climbed.
            </p>
            <Button onClick={onTakePhoto}>Take today's photo</Button>
          </section>
        ) : (
          <>
            {first && latest && first !== latest && (
              <button
                type="button"
                onClick={() => setComparing(true)}
                className="flex min-h-touch items-center gap-3 self-center rounded-full bg-world-soft py-1.5 pr-5 pl-1.5 text-left ring-[1.5px] ring-world-edge ring-inset motion-safe:transition-transform active:scale-[0.97]"
              >
                <span aria-hidden="true" className="flex">
                  {[first, latest].map((entry, i) => (
                    <BlobImage
                      key={entry.photo.id}
                      blob={entry.photo.blob}
                      alt=""
                      className={`h-9 w-9 rounded-full object-cover ring-2 ring-world-soft ${i ? '-ml-2.5' : ''}`}
                    />
                  ))}
                </span>
                <span className="font-rounded leading-tight">
                  <span className="block font-bold text-world-ink">Compare</span>
                  <span className="block text-xs text-ink-muted">
                    Day {first.dayNumber} → Day {latest.dayNumber}
                  </span>
                </span>
              </button>
            )}
            <div className="grid grid-cols-3 gap-2">
              {entries.map((entry, index) => (
                <PhotoThumbnail key={entry.photo.id} entry={entry} onClick={() => setOpenIndex(index)} />
              ))}
            </div>
          </>
        )}
      </main>

      <PhotoLightbox
        entries={entries ?? []}
        index={openIndex}
        onClose={() => setOpenIndex(null)}
        onNavigate={setOpenIndex}
      />
      <PhotoCompare entries={oldestFirst} open={comparing} onClose={() => setComparing(false)} />
    </div>
  )
}
