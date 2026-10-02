import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { BlobImage } from '../../components/BlobImage'
import { Mascot, type DuckMood, type DuckReaction } from '../../components/mascot/Mascot'
import { Button } from '../../components/ui/Button'
import { captureFrame, loadFacing, saveFacing, startCamera, stopCamera, type CameraFacing } from '../../lib/camera'

type Phase = 'starting' | 'live' | 'countdown' | 'review' | 'saving' | 'saved'

const TIMER_STEPS = [0, 3, 10] as const
type TimerSeconds = (typeof TIMER_STEPS)[number]

const MOOD_BY_PHASE: Record<Phase, DuckMood> = {
  starting: 'watching',
  live: 'watching',
  countdown: 'tapping',
  review: 'judging',
  saving: 'celebrating',
  saved: 'celebrating',
}

/** How long the duck celebrates a saved photo before the camera folds away. */
export const SAVED_LINGER_MS = 1200

interface InlineCameraProps {
  /** The most recent earlier photo, shown faintly to line up the pose. */
  ghost?: Blob
  /** Saves the shot; a rejection keeps the review open with an error. */
  onCapture: (blob: Blob) => Promise<void>
  onClose: () => void
  /** The camera couldn't start (denied, unsupported, in use). */
  onUnavailable: () => void
}

/**
 * A live camera inside the Photo card. The viewfinder is a 3:4 box with the
 * duck perched on its corner; the stream is stopped whenever the camera
 * closes, the card unmounts, or the app goes to the background.
 */
export function InlineCamera({ ghost, onCapture, onClose, onUnavailable }: InlineCameraProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [facing, setFacing] = useState<CameraFacing>(loadFacing)
  const [phase, setPhase] = useState<Phase>('starting')
  const [ghostOn, setGhostOn] = useState(true)
  const [timer, setTimer] = useState<TimerSeconds>(0)
  const [count, setCount] = useState(0)
  const [shot, setShot] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reaction, setReaction] = useState<{ kind: DuckReaction; id: number }>()

  const react = (kind: DuckReaction) => setReaction((prev) => ({ kind, id: (prev?.id ?? 0) + 1 }))
  const reportUnavailable = useEffectEvent(onUnavailable)
  const close = useEffectEvent(onClose)

  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | null = null
    startCamera(facing)
      .then((s) => {
        stream = s
        if (cancelled) return stopCamera(s)
        const video = videoRef.current
        if (video) {
          video.srcObject = s
          video.play().catch(() => {})
        }
        setPhase('live')
      })
      .catch(() => {
        if (!cancelled) reportUnavailable()
      })
    return () => {
      cancelled = true
      stopCamera(stream)
    }
  }, [facing])

  useEffect(() => {
    rootRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') close()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const capture = async () => {
    const video = videoRef.current
    try {
      if (!video) throw new Error('No video')
      setShot(await captureFrame(video, facing === 'user'))
      setPhase('review')
    } catch {
      setError("Couldn't take the photo — try again.")
      setPhase('live')
    }
  }
  const captureFromTimer = useEffectEvent(capture)

  useEffect(() => {
    if (phase !== 'countdown') return
    if (count === 0) {
      void captureFromTimer()
      return
    }
    const id = setTimeout(() => setCount((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [phase, count])

  useEffect(() => {
    if (phase !== 'saved') return
    const id = setTimeout(() => close(), SAVED_LINGER_MS)
    return () => clearTimeout(id)
  }, [phase])

  const onShutter = () => {
    setError(null)
    if (timer === 0) return void capture()
    setCount(timer)
    setPhase('countdown')
  }

  const onFlip = () => {
    const next: CameraFacing = facing === 'user' ? 'environment' : 'user'
    saveFacing(next)
    setPhase('starting')
    setFacing(next)
  }

  const onRetake = () => {
    setShot(null)
    setError(null)
    setPhase('live')
    react('glare')
  }

  const onUse = async () => {
    if (!shot) return
    setPhase('saving')
    setError(null)
    react('approve')
    try {
      await onCapture(shot)
      setPhase('saved')
    } catch {
      setError("Couldn't save that photo — try again.")
      setPhase('review')
    }
  }

  const reviewing = phase === 'review' || phase === 'saving' || phase === 'saved'

  return (
    <div ref={rootRef}>
      <div className="relative aspect-[3/4] w-full">
        <div className="absolute inset-0 overflow-hidden rounded-2xl bg-black">
          <video
            ref={videoRef}
            data-testid="camera-preview"
            className={`h-full w-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`}
            autoPlay
            muted
            playsInline
          />
          {ghost && ghostOn && !reviewing && (
            <BlobImage
              blob={ghost}
              alt=""
              data-testid="camera-ghost"
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30"
            />
          )}
          {shot && reviewing && (
            <BlobImage blob={shot} alt="Your new photo" className="absolute inset-0 h-full w-full object-cover" />
          )}
          {phase === 'starting' && (
            <p className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white/80">
              Starting camera…
            </p>
          )}
          {phase === 'countdown' && count > 0 && (
            <p
              aria-live="assertive"
              className="absolute inset-0 flex items-center justify-center font-rounded text-8xl font-extrabold text-white drop-shadow-lg"
            >
              {count}
            </p>
          )}
        </div>
        <div className="pointer-events-none absolute -bottom-6 -right-3">
          <Mascot mood={MOOD_BY_PHASE[phase]} reaction={reaction} size={76} decorative />
        </div>
      </div>

      {reviewing ? (
        <div className="mt-8 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onRetake} disabled={phase !== 'review'}>
            Retake
          </Button>
          <Button className="flex-1" onClick={() => void onUse()} disabled={phase !== 'review'}>
            {phase === 'review' ? 'Use photo' : phase === 'saving' ? 'Saving…' : 'Saved!'}
          </Button>
        </div>
      ) : (
        <div className="mt-8 flex items-center justify-between gap-2">
          <Button variant="secondary" className="px-3" aria-label="Close camera" onClick={onClose}>
            ✕
          </Button>
          <Button
            variant="secondary"
            className="px-3"
            aria-label="Switch camera"
            onClick={onFlip}
            disabled={phase !== 'live'}
          >
            ⟲
          </Button>
          <button
            type="button"
            aria-label={phase === 'countdown' ? 'Cancel timer' : 'Take photo'}
            onClick={phase === 'countdown' ? () => setPhase('live') : onShutter}
            disabled={phase === 'starting'}
            className="h-16 w-16 shrink-0 touch-manipulation rounded-full border-4 border-ink/20 bg-surface shadow-inner focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50 motion-safe:transition-transform motion-safe:active:scale-90"
          >
            {phase === 'countdown' ? '■' : ''}
          </button>
          <Button
            variant="secondary"
            className="px-3 text-sm"
            aria-label={`Timer: ${timer === 0 ? 'off' : `${timer} seconds`}`}
            onClick={() => setTimer(TIMER_STEPS[(TIMER_STEPS.indexOf(timer) + 1) % TIMER_STEPS.length])}
            disabled={phase === 'countdown'}
          >
            ⏱{timer === 0 ? '' : ` ${timer}s`}
          </Button>
          <Button
            variant="secondary"
            className={`px-3 ${ghost ? '' : 'invisible'}`}
            aria-label="Show last photo as a guide"
            aria-pressed={ghostOn}
            onClick={() => setGhostOn((on) => !on)}
            disabled={!ghost}
          >
            👻
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger-ink">
          {error}
        </p>
      )}
    </div>
  )
}
