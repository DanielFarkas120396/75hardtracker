import { useObjectUrl } from '../../hooks/useObjectUrl'
import type { GalleryEntry } from '../../hooks/useGalleryPhotos'

interface PhotoThumbnailProps {
  entry: GalleryEntry
  onClick: () => void
}

export function PhotoThumbnail({ entry, onClick }: PhotoThumbnailProps) {
  const url = useObjectUrl(entry.photo.blob)

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative aspect-square overflow-hidden rounded-2xl bg-canvas motion-safe:transition-transform active:scale-95"
    >
      {url && <img src={url} alt={`Day ${entry.dayNumber} progress`} className="h-full w-full object-cover" />}
      <span className="absolute bottom-1 left-1 rounded-lg bg-ink/60 px-2 py-0.5 font-rounded text-xs font-bold text-white">
        Day {entry.dayNumber}
      </span>
    </button>
  )
}
