import { AnimatePresence, motion, useReducedMotionConfig } from 'framer-motion'
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { BlobImage } from '../../components/BlobImage'
import { Icon } from '../../components/icons/Icon'
import type { GalleryEntry } from '../../hooks/useGalleryPhotos'
import { comparePair, frameMs } from '../../logic/photoCompare'

interface PhotoCompareProps {
  /** This attempt's photos, oldest first: at least two. */
  entries: readonly GalleryEntry[]
  open: boolean
  onClose: () => void
}

type Side = 'earlier' | 'later'

/** Close to the camera's frame, so lined-up photos stay lined up. */
const FRAME = 'relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-black'
const DECODE_WAIT_MS = 3000
const PILL ='min-h-touch rounded-full bg-white/10 px-4 font-rounded font-bold text-white aria-pressed:bg-world aria-pressed:text-on-world'

/** This attempt's photos side by side in time: a slider over two of them, or a time-lapse of them all. */
export function PhotoCompare({ entries, open, onClose }: PhotoCompareProps) {
  return <AnimatePresence>{open && <CompareView entries={entries} onClose={onClose} />}</AnimatePresence>
}

function CompareView({ entries, onClose }: Omit<PhotoCompareProps, 'open'>) {
  const [mode, setMode] = useState<'slider' | 'timelapse'>('slider')
  const dialog = useRef<HTMLDivElement>(null)
  const close = useEffectEvent(() => onClose())

  // Like the app's sheets: Escape closes it, and focus moves in, then back to what had it on close.
  useEffect(() => {
    const opener = document.activeElement
    dialog.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [])

  return (
    <motion.div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label="Compare photos"
      tabIndex={-1}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4 outline-none"
      onClick={onClose}
    >
      <div className="flex w-full max-w-[calc(70dvh*2/3)] flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        {mode === 'slider' ? <Slider entries={entries} /> : <TimeLapse entries={entries} />}
        <div className="flex gap-2">
          <button type="button" aria-pressed={mode === 'slider'} onClick={() => setMode('slider')} className={PILL}>
            Slider
          </button>
          <button type="button" aria-pressed={mode === 'timelapse'} onClick={() => setMode('timelapse')} className={PILL}>
            Time-lapse
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label="Close"
        className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"
      >
        <Icon name="close" />
      </button>
    </motion.div>
  )
}

function Slider({ entries }: { entries: readonly GalleryEntry[] }) {
  const [picked, setPicked] = useState<Partial<Record<Side, number>>>({})
  const [split, setSplit] = useState(50)
  const [picking, setPicking] = useState<Side | null>(null)
  const [earlier, later] = comparePair(entries, picked.earlier, picked.later)
  const shown: Record<Side, GalleryEntry> = { earlier, later }
  const days = later.dayNumber - earlier.dayNumber

  const follow = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    setSplit(Math.round(Math.min(100, Math.max(0, ((event.clientX - box.left) / box.width) * 100))))
  }

  const pick = (side: Side, id: number) => {
    setPicked({ earlier: earlier.photo.id, later: later.photo.id, [side]: id })
    setPicking(null)
  }

  return (
    <>
      {/* touch-action on an HTML element: iOS ignores it on SVG (see draw to commit). */}
      <div
        className={`${FRAME} touch-none select-none`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          follow(e)
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) follow(e)
        }}
      >
        <BlobImage
          blob={earlier.photo.blob}
          alt={`Day ${earlier.dayNumber} progress`}
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
          <BlobImage
            blob={later.photo.blob}
            alt={`Day ${later.dayNumber} progress`}
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-world" style={{ left: `${split}%` }}>
          <span className="absolute top-1/2 left-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-world bg-black/60" />
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={split}
          onChange={(e) => setSplit(Number(e.target.value))}
          aria-label={`Compare Day ${earlier.dayNumber} and Day ${later.dayNumber}`}
          aria-valuetext={`${split}%`}
          className="sr-only"
        />
        {(['earlier', 'later'] as const).map((side) => (
          <button
            key={side}
            type="button"
            // The frame captures the pointer for dragging; a tap on a label must stay a tap.
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setPicking(picking === side ? null : side)}
            aria-label={`Change the ${side} day, Day ${shown[side].dayNumber}`}
            aria-expanded={picking === side}
            className={`absolute top-2 ${side === 'earlier' ? 'left-2' : 'right-2'} min-h-touch rounded-full bg-black/60 px-3 font-rounded text-sm font-bold text-white aria-expanded:bg-world aria-expanded:text-on-world`}
          >
            Day {shown[side].dayNumber}
          </button>
        ))}
      </div>

      {picking ? (
        <DayStrip entries={entries} current={shown[picking]} other={shown[picking === 'earlier' ? 'later' : 'earlier']} onPick={(id) => pick(picking, id)} />
      ) : (
        <p className="font-rounded font-bold text-white">
          Day {earlier.dayNumber} → Day {later.dayNumber} · {days} {days === 1 ? 'day' : 'days'}
        </p>
      )}
    </>
  )
}

interface DayStripProps {
  entries: readonly GalleryEntry[]
  /** The side's day, marked. */
  current: GalleryEntry
  /** The other side's day, which can't be picked. */
  other: GalleryEntry
  onPick: (photoId: number) => void
}

function DayStrip({ entries, current, other, onPick }: DayStripProps) {
  const strip = useRef<HTMLDivElement>(null)
  const marked = useRef<HTMLButtonElement>(null)

  // Opens with the side's day in the middle, not at the start of a long attempt.
  useLayoutEffect(() => {
    if (strip.current && marked.current) {
      strip.current.scrollLeft = marked.current.offsetLeft - (strip.current.clientWidth - marked.current.clientWidth) / 2
    }
  }, [])

  return (
    <div ref={strip} className="flex w-full gap-2 overflow-x-auto py-1">
      {entries.map((entry) => (
        <button
          key={entry.photo.id}
          ref={entry === current ? marked : undefined}
          type="button"
          aria-label={`Day ${entry.dayNumber}`}
          aria-pressed={entry === current}
          disabled={entry === other}
          onClick={() => onPick(entry.photo.id)}
          className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg ring-2 ring-transparent aria-pressed:ring-world disabled:opacity-30"
        >
          <BlobImage blob={entry.photo.blob} alt="" className="h-full w-full object-cover" />
          <span className="absolute inset-x-0 bottom-0 bg-black/60 text-center font-rounded text-[11px] font-bold text-white">
            {entry.dayNumber}
          </span>
        </button>
      ))}
    </div>
  )
}

function TimeLapse({ entries }: { entries: readonly GalleryEntry[] }) {
  const reduceMotion = useReducedMotionConfig() ?? false
  const last = entries.length - 1
  const urls = useDecodedUrls(entries)
  const [index, setIndex] = useState(reduceMotion ? last : 0)
  const [playing, setPlaying] = useState(!reduceMotion)
  const at = Math.min(index, last)
  const running = playing && at < last
  const entry = entries[at]

  useEffect(() => {
    if (!urls || !running) return
    const timer = setTimeout(() => setIndex(at + 1), frameMs(entries.length))
    return () => clearTimeout(timer)
  }, [urls, running, at, entries.length])

  return (
    <>
      <div className={FRAME}>
        {urls ? (
          <img src={urls[at]} alt={`Day ${entry.dayNumber} progress`} draggable={false} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <p className="absolute inset-0 flex items-center justify-center font-rounded text-white/70">Loading…</p>
        )}
        <span aria-hidden="true" className="absolute top-3 left-3 rounded-xl bg-black/60 px-3 py-1 font-display text-3xl tracking-wide text-white">
          Day {entry.dayNumber}
        </span>
      </div>

      <div className="flex w-full items-center gap-3">
        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={at}
          onChange={(e) => {
            setPlaying(false)
            setIndex(Number(e.target.value))
          }}
          aria-label="Day"
          aria-valuetext={`Day ${entry.dayNumber}`}
          className="min-h-touch flex-1 accent-world"
        />
        {!running && !reduceMotion && (
          <button
            type="button"
            onClick={() => {
              setIndex(0)
              setPlaying(true)
            }}
            className={PILL}
          >
            Replay
          </button>
        )}
      </div>
    </>
  )
}

/**
 * Object URLs for the photos, handed back once every one is decoded, so the
 * time-lapse doesn't stutter on its first run.
 */
function useDecodedUrls(entries: readonly GalleryEntry[]): string[] | undefined {
  const [decoded, setDecoded] = useState<{ entries: readonly GalleryEntry[]; urls: string[]; images: HTMLImageElement[] }>()

  useEffect(() => {
    const urls = entries.map((e) => URL.createObjectURL(e.photo.blob))
    // ponytail: the decoded images are kept alive here, not pinned by the browser; Safari can still drop them under memory pressure.
    const images = urls.map((url) => Object.assign(new Image(), { src: url }))
    let live = true
    // decode() can wait forever (a hidden page never decodes), so the time-lapse plays after DECODE_WAIT_MS anyway.
    void Promise.race([
      Promise.all(images.map((img) => img.decode().catch(() => {}))),
      new Promise((resolve) => setTimeout(resolve, DECODE_WAIT_MS)),
    ]).then(() => {
      if (live) setDecoded({ entries, urls, images })
    })
    return () => {
      live = false
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [entries])

  return decoded?.entries === entries ? decoded.urls : undefined
}
