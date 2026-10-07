import { useState } from 'react'
import { Icon } from '../../components/icons/Icon'
import { Mascot } from '../../components/mascot/Mascot'
import { Button } from '../../components/ui/Button'
import { useGalleryPhotos } from '../../hooks/useGalleryPhotos'
import { groupByWorld } from './groups'
import { PhotoLightbox } from './PhotoLightbox'
import { PhotoThumbnail } from './PhotoThumbnail'

interface GalleryScreenProps {
  /** Goes to Today with its camera open (from the empty state). */
  onTakePhoto: () => void
}

/** Every progress photo, grouped by the Journey world of its day, each group in that world's colours. */
export function GalleryScreen({ onTakePhoto }: GalleryScreenProps) {
  const entries = useGalleryPhotos()
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const groups = groupByWorld(entries ?? [])
  const attempts = new Set(groups.map((g) => g.attemptNumber)).size

  return (
    <div className="min-h-dvh bg-canvas pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      <header className="px-4 pt-6 pb-4">
        <h1 className="flex items-center gap-2 font-display text-2xl tracking-wide text-ink">
          <Icon name="gallery" className="text-world-ink" />
          Gallery
        </h1>
        <p className="font-rounded text-sm text-ink-muted">Every progress photo, across every attempt.</p>
      </header>

      <main className="flex flex-col gap-5 px-4">
        {!entries ? (
          <p className="font-rounded text-ink-muted">Loading…</p>
        ) : entries.length === 0 ? (
          <section className="flex flex-col items-center gap-3 rounded-card bg-world-soft px-6 py-8 text-center">
            <div className="relative">
              <Mascot mood="content" size={120} decorative />
              <span className="absolute -right-2 bottom-2 flex h-11 w-11 items-center justify-center rounded-full bg-surface text-world-ink shadow-sm">
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
          groups.map((group) => (
            <section key={group.key} data-world={group.world.id} aria-label={group.world.name}>
              <h2 className="mb-2 flex items-center gap-2">
                <span className="rounded-full bg-world-soft px-3 py-1 font-rounded text-sm font-bold text-world-ink">
                  {group.world.name}
                </span>
                {attempts > 1 && (
                  <span className="font-rounded text-xs font-bold text-ink-muted">Attempt #{group.attemptNumber}</span>
                )}
                <span className="ml-auto font-rounded text-xs font-bold text-ink-muted">
                  {group.items.length} {group.items.length === 1 ? 'photo' : 'photos'}
                </span>
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {group.items.map(({ entry, index }) => (
                  <PhotoThumbnail key={entry.photo.id} entry={entry} onClick={() => setOpenIndex(index)} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      <PhotoLightbox
        entries={entries ?? []}
        index={openIndex}
        onClose={() => setOpenIndex(null)}
        onNavigate={setOpenIndex}
      />
    </div>
  )
}
