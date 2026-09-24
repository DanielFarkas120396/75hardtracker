import { useState } from 'react'
import { useGalleryPhotos } from '../../hooks/useGalleryPhotos'
import { PhotoLightbox } from './PhotoLightbox'
import { PhotoThumbnail } from './PhotoThumbnail'

export function GalleryScreen() {
  const entries = useGalleryPhotos()
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <header className="px-4 pt-6 pb-4">
        <h1 className="font-rounded text-2xl font-extrabold text-ink">📸 Gallery</h1>
        <p className="font-rounded text-sm text-ink-muted">Every progress photo, across every attempt.</p>
      </header>

      <main className="px-4">
        {!entries ? (
          <p className="font-rounded text-ink-muted">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="font-rounded text-ink-muted">No photos yet — take today's on the Today tab.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {entries.map((entry, i) => (
              <PhotoThumbnail key={entry.photo.id} entry={entry} onClick={() => setOpenIndex(i)} />
            ))}
          </div>
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
