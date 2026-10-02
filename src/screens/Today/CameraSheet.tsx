import { motion } from 'framer-motion'
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react'
import { BlobImage } from '../../components/BlobImage'
import { Mascot, type DuckMood, type DuckReaction } from '../../components/mascot/Mascot'
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

/** How long the duck celebrates a saved photo before the sheet slides away. */
export const SAVED_LINGER_MS = 1200

interface CameraSheetProps {
  /** The most recent earlier photo, shown faintly to line up the pose. */
  ghost?: Blob
  /** Saves the shot; a rejection keeps the review open with an error. */
  onCapture: (blob: Blob) => Promise<void>
  onClose: () => void
  /** The camera couldn't start (denied, unsupported, in use). */
  onUnavailable: () => void
}

/** A dark, see-through round button that floats on the camera picture. */
function GlassButton({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string
  pressed?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-12 min-w-12 touch-manipulation items-center justify-center rounded-full px-3 text-lg font-bold text-white backdrop-blur-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-40 motion-safe:transition-transform motion-safe:active:scale-90 ${pressed === false ? 'bg-black/25 opacity-60' : 'bg-black/45'}`}
    >
      {children}
    </button>
  )
}

/**
 * The progress-photo camera: a panel that slides up over the app, with the
 * controls floating on the picture and the duck perched on the panel's top
 * edge. The stream is stopped whenever the sheet closes, unmounts, or the
 * app goes to the background.
 */
export function CameraSheet({ ghost, onCapture, onClose, onUnavailable }: CameraSheetProps) {
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
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    // The page behind the sheet shouldn't scroll under a finger on the camera.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('keydown', onKeyDown)
    }
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Camera"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        className="relative mx-auto h-[82dvh] w-full max-w-md rounded-t-[2.5rem] bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <div className="pointer-events-none absolute -top-[106px] left-5 z-10">
          <Mascot mood={MOOD_BY_PHASE[phase]} reaction={reaction} size={120} decorative />
        </div>

        <div className="relative h-full overflow-hidden rounded-[2rem] bg-black">
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
              className="absolute inset-0 flex items-center justify-center font-rounded text-9xl font-extrabold text-white drop-shadow-lg"
            >
              {count}
            </p>
          )}

          {!reviewing && (
            <div className="absolute top-4 right-4 flex gap-2">
              <GlassButton
                label={`Timer: ${timer === 0 ? 'off' : `${timer} seconds`}`}
                onClick={() => setTimer(TIMER_STEPS[(TIMER_STEPS.indexOf(timer) + 1) % TIMER_STEPS.length])}
                disabled={phase === 'countdown'}
              >
                ⏱{timer === 0 ? '' : <span className="ml-1 text-sm">{timer}s</span>}
              </GlassButton>
              {ghost && (
                <GlassButton label="Show last photo as a guide" pressed={ghostOn} onClick={() => setGhostOn((on) => !on)}>
                  👻
                </GlassButton>
              )}
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="absolute inset-x-4 bottom-32 rounded-2xl bg-black/60 px-4 py-2 text-center text-sm font-semibold text-white backdrop-blur-md"
            >
              {error}
            </p>
          )}

          {reviewing ? (
            <div className="absolute inset-x-4 bottom-6 flex gap-3">
              <button
                type="button"
                onClick={onRetake}
                disabled={phase !== 'review'}
                className="min-h-touch flex-1 touch-manipulation rounded-full bg-black/45 font-rounded font-bold text-white backdrop-blur-md disabled:opacity-40 motion-safe:active:scale-95"
              >
                Retake
              </button>
              <button
                type="button"
                onClick={() => void onUse()}
                disabled={phase !== 'review'}
                className="min-h-touch flex-1 touch-manipulation rounded-full bg-white font-rounded font-bold text-black disabled:opacity-80 motion-safe:active:scale-95"
              >
                {phase === 'review' ? 'Use photo' : phase === 'saving' ? 'Saving…' : 'Saved!'}
              </button>
            </div>
          ) : (
            <div className="absolute inset-x-4 bottom-6 flex items-center justify-between">
              <GlassButton label="Close camera" onClick={onClose}>
                ‹
              </GlassButton>
              <button
                type="button"
                aria-label={phase === 'countdown' ? 'Cancel timer' : 'Take photo'}
                onClick={phase === 'countdown' ? () => setPhase('live') : onShutter}
                disabled={phase === 'starting'}
                className="flex h-20 w-20 touch-manipulation items-center justify-center rounded-full border-4 border-white/60 bg-white bg-clip-padding text-2xl text-black shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:opacity-50 motion-safe:transition-transform motion-safe:active:scale-90"
              >
                {phase === 'countdown' ? '■' : ''}
              </button>
              <GlassButton label="Switch camera" onClick={onFlip} disabled={phase !== 'live'}>
                ⟲
              </GlassButton>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
