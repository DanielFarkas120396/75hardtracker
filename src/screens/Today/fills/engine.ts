import { WebGLRenderer } from 'three'
import { isWorldId, WORLD_COLORS } from '../../../lib/worldColors'
import { fillOpacity, fillPalette, type FillPalette, type Mode } from './palette'
import type { FillEngine, FillHandle, LevelMode, Painter, PainterKind } from './painter'
import { PAINTERS } from './painters'
import { DRIFT_MS, frameDecision } from './schedule'

/** Reduce motion's crossfade to a new level. */
const FADE_S = 0.25

interface Entry {
  kind: PainterKind
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  painter: Painter
  level: number
  visible: boolean
  dirty: boolean
  /** The last frame before a crossfade, drawn under the new one as it fades in. */
  prev: HTMLCanvasElement | null
  fade: number
  onFrame: () => void
}

/** The world and theme on <html> (data-world, the .dark class), as fill colours. */
function currentPalette(): FillPalette {
  const root = document.documentElement
  const world = root.dataset.world
  const mode: Mode = root.classList.contains('dark') ? 'dark' : 'light'
  return fillPalette(WORLD_COLORS[isWorldId(world) ? world : 'hell'][mode], mode)
}

/**
 * One three.js renderer for every tile on the board. It draws each tile's fill on a hidden canvas, at the tile's
 * current size, and copies it into the tile's own 2D canvas: one WebGL context however many tiles there are, and a
 * tile that resizes or shrinks into its chip is simply drawn at its new size. The loop runs only while a fill moves,
 * fades or drifts (drift at 30 frames a second), and skips tiles that are off screen.
 */
export function createEngine(): FillEngine {
  const glCanvas = document.createElement('canvas')
  const renderer = new WebGLRenderer({ canvas: glCanvas, alpha: true, antialias: true, powerPreference: 'low-power' })
  renderer.setClearColor(0x000000, 0)
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  renderer.setPixelRatio(dpr)
  renderer.setScissorTest(true)

  const entries = new Map<HTMLCanvasElement, Entry>()
  const listeners = new Set<() => void>()
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  let palette = currentPalette()
  let lost = false
  let held = false
  let bufferWidth = 0
  let bufferHeight = 0
  let raf = 0
  let last = 0
  let lastDrift = 0

  const notify = () => listeners.forEach((listener) => listener())
  const kick = () => {
    if (raf || lost || held || entries.size === 0) return
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }

  function makePainter(kind: PainterKind): Painter {
    const make = PAINTERS[kind]
    if (!make) throw new Error(`No fill for ${kind}`)
    return make(palette)
  }

  // A tile scrolled out of sight is neither stepped nor drawn: its animation waits until it's seen.
  const seen = new IntersectionObserver((records) => {
    for (const record of records) {
      const entry = entries.get(record.target as HTMLCanvasElement)
      if (!entry) continue
      entry.visible = record.isIntersecting
      if (entry.visible) {
        entry.dirty = true
        kick()
      }
    }
  })

  // A new world or theme recolours every fill.
  new MutationObserver(() => {
    palette = currentPalette()
    for (const entry of entries.values()) {
      entry.painter.setPalette(palette)
      entry.canvas.style.opacity = String(fillOpacity(entry.kind, palette))
      entry.dirty = true
    }
    kick()
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-world'] })

  glCanvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault()
    lost = true
    cancelAnimationFrame(raf)
    raf = 0
    notify()
  })
  // Everything on the GPU went with the context: every fill is made again, at its level.
  glCanvas.addEventListener('webglcontextrestored', () => {
    lost = false
    for (const entry of entries.values()) {
      entry.painter.dispose()
      entry.painter = makePainter(entry.kind)
      entry.painter.setLevel(entry.level, true)
      entry.dirty = true
    }
    notify()
    kick()
  })

  function draw(entry: Entry, width: number, height: number) {
    const pw = Math.round(width * dpr)
    const ph = Math.round(height * dpr)
    if (entry.canvas.width !== pw || entry.canvas.height !== ph) {
      entry.canvas.width = pw
      entry.canvas.height = ph
    }
    if (width > bufferWidth || height > bufferHeight) {
      bufferWidth = Math.max(bufferWidth, width)
      bufferHeight = Math.max(bufferHeight, height)
      renderer.setSize(bufferWidth, bufferHeight, false)
    }
    renderer.setViewport(0, 0, width, height)
    renderer.setScissor(0, 0, width, height)
    entry.painter.render(renderer, width, height)
    // The viewport sits at the bottom left of the GL canvas; images count their rows from the top.
    const sourceY = glCanvas.height - ph
    const ctx = entry.ctx
    ctx.clearRect(0, 0, pw, ph)
    if (entry.prev) {
      ctx.globalAlpha = 1 - entry.fade
      ctx.drawImage(entry.prev, 0, 0, pw, ph)
      ctx.globalAlpha = entry.fade
    }
    ctx.drawImage(glCanvas, 0, sourceY, pw, ph, 0, 0, pw, ph)
    ctx.globalAlpha = 1
  }

  function frame(now: number) {
    raf = 0
    if (lost || held) return
    const dt = Math.min(0.05, (now - last) / 1000 || 0)
    last = now
    const drift = !motionQuery.matches
    const driftDue = now - lastDrift >= DRIFT_MS
    if (driftDue) lastDrift = now
    let again = false
    for (const entry of entries.values()) {
      if (!entry.visible) continue
      const width = entry.canvas.clientWidth
      const height = entry.canvas.clientHeight
      if (!width || !height) continue
      // A tile that shrinks into its chip or changes width is drawn at its new size at once, not on the next drift slot.
      const resized = entry.canvas.width !== Math.round(width * dpr) || entry.canvas.height !== Math.round(height * dpr)
      const moving = entry.painter.step(dt, drift)
      if (entry.prev) entry.fade = Math.min(1, entry.fade + dt / FADE_S)
      const decision = frameDecision(
        { moving, fading: entry.prev !== null, dirty: entry.dirty || resized, drifting: drift && entry.painter.drifts() },
        driftDue,
      )
      if (decision.draw) {
        draw(entry, width, height)
        entry.dirty = false
        if (entry.prev && entry.fade >= 1) entry.prev = null
        entry.onFrame()
      }
      if (decision.again) again = true
    }
    if (again) raf = requestAnimationFrame(frame)
  }

  return {
    supports: (kind) => PAINTERS[kind] !== undefined,
    lost: () => lost,
    hold(value) {
      held = value
      if (held) {
        cancelAnimationFrame(raf)
        raf = 0
      } else kick()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    add(kind, canvas, onFrame): FillHandle {
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('This browser has no 2D canvas')
      const entry: Entry = { kind, canvas, ctx, painter: makePainter(kind), level: 0, visible: true, dirty: true, prev: null, fade: 1, onFrame }
      canvas.style.opacity = String(fillOpacity(kind, palette))
      entries.set(canvas, entry)
      seen.observe(canvas)
      kick()
      return {
        setLevel(level: number, mode: LevelMode) {
          if (level === entry.level && mode !== 'instant') return
          entry.level = level
          if (mode === 'fade' && canvas.width && canvas.height) {
            const prev = document.createElement('canvas')
            prev.width = canvas.width
            prev.height = canvas.height
            prev.getContext('2d')?.drawImage(canvas, 0, 0)
            entry.prev = prev
            entry.fade = 0
          }
          entry.painter.setLevel(level, mode !== 'animate')
          entry.dirty = true
          kick()
        },
        shown: () => entry.painter.shown(),
        settledAt: () => (entry.painter.settled() && !entry.prev ? entry.level : null),
        setAnchor(right, top) {
          entry.painter.setAnchor?.(right, top)
        },
        setImage(image) {
          entry.painter.setImage?.(image)
          entry.dirty = true
          kick()
        },
        remove() {
          seen.unobserve(canvas)
          entries.delete(canvas)
          entry.painter.dispose()
        },
      }
    },
  }
}

let shared: FillEngine | undefined

/** The app's one fill engine (one WebGL context), made on first use. */
export function sharedEngine(): FillEngine {
  shared ??= createEngine()
  return shared
}
