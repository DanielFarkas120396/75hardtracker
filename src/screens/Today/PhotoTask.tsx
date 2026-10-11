import { BlobImage } from '../../components/BlobImage'
import { Icon } from '../../components/icons/Icon'
import { Button } from '../../components/ui/Button'
import { usePhotoCapture } from './photoCaptureContext'

const ICON_BUTTON = 'flex items-center justify-center gap-2'

/** The photo sheet's body: the day's photo, and the ways to take or pick one. */
export function PhotoTask() {
  const { photo, busy, error, cameraFailed, libraryOnly, takePhoto, chooseFromLibrary } = usePhotoCapture()

  return (
    <div>
      {photo ? (
        <BlobImage blob={photo.blob} alt="Today's progress" className="w-full rounded-2xl object-cover" />
      ) : (
        <div className="flex h-40 items-center justify-center rounded-2xl bg-canvas text-ink-muted">No photo yet</div>
      )}

      {cameraFailed && (
        <p className="mt-2 text-sm text-ink-muted">
          The in-app camera isn't available, so Take photo opens your phone's camera instead.
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {!libraryOnly && (
          <Button variant="secondary" className={ICON_BUTTON} onClick={takePhoto} disabled={busy}>
            {busy ? (
              'Saving…'
            ) : (
              <>
                <Icon name="photo" size={18} className="text-world-ink in-disabled:text-ink-muted" />
                {photo ? 'Retake photo' : 'Take photo'}
              </>
            )}
          </Button>
        )}
        <Button variant="secondary" className={ICON_BUTTON} onClick={chooseFromLibrary} disabled={busy}>
          {busy && libraryOnly ? (
            'Saving…'
          ) : (
            <>
              <Icon name="gallery" size={18} className="text-world-ink in-disabled:text-ink-muted" />
              Choose from library
            </>
          )}
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger-ink">
          {error}
        </p>
      )}
    </div>
  )
}
