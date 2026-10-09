import { MotionGlobalConfig } from 'framer-motion'

/** The glow of a full tile, before it goes. */
export const HOLD_MS = 380
/** A full tile shrinking into its chip. */
export const MORPH_MS = 720
/** A tile widening or narrowing when the odd one out changes. */
export const RESIZE_MS = 460
const EASE_MORPH = 'cubic-bezier(.55,0,.2,1)'
const EASE_SLIDE = 'cubic-bezier(.2,.8,.2,1)'
const EASE_POP = 'cubic-bezier(.34,1.56,.64,1)'

/** Whether the board animates at all: not in tests that skip animations, nor without the Web Animations API. */
export function canAnimate(): boolean {
  return !MotionGlobalConfig.skipAnimations && typeof document !== 'undefined' && typeof document.documentElement.animate === 'function'
}

export interface Box {
  left: number
  top: number
  width: number
  height: number
}

const relative = (container: Element, r: DOMRect): Box => {
  const c = container.getBoundingClientRect()
  return { left: r.left - c.left, top: r.top - c.top, width: r.width, height: r.height }
}

/** An element's box relative to another (the board). */
export const boxIn = (container: Element, el: Element): Box => relative(container, el.getBoundingClientRect())

/** A text's own box (a title's span has padding above its text). */
function textBox(container: Element, el: Element): Box {
  const range = document.createRange()
  range.selectNodeContents(el)
  return relative(container, typeof range.getBoundingClientRect === 'function' ? range.getBoundingClientRect() : el.getBoundingClientRect())
}

/** The moment a fill is complete: a ring in the world's ink, a small swell and a brighter tile. */
export function glow(tile: HTMLElement): void {
  if (!canAnimate()) return
  const ring = (percent: number, scale: number, brightness: number) => ({
    outlineStyle: 'solid',
    outlineWidth: '2px',
    outlineOffset: '-2px',
    outlineColor: `color-mix(in srgb, var(--color-world-ink) ${percent}%, transparent)`,
    transform: `scale(${scale})`,
    filter: `brightness(${brightness})`,
  })
  tile.animate([ring(0, 1, 1), { ...ring(80, 1.03, 1.18), offset: 0.45 }, ring(0, 1, 1)], { duration: HOLD_MS + 120, easing: 'ease-out' })
}

export interface MorphParts {
  /** The board: positioned, the frame the boxes are measured in. */
  board: HTMLElement
  /** The tile's grid box, already lifted out of the grid (absolute) where it stood. */
  box: HTMLElement
  /** The tile itself, inside the box: rounded, on the surface colour. */
  tile: HTMLElement
  /** The chip in the row above, hidden until the tile lands on it. */
  chip: HTMLElement
}

export interface Morph {
  finished: Promise<void>
  cancel(): void
}

type Flight = Element & ElementCSSInlineStyle

function place(flight: Flight, at: Box, extra: Partial<CSSStyleDeclaration>) {
  Object.assign(flight.style, {
    position: 'absolute',
    left: `${at.left}px`,
    top: `${at.top}px`,
    zIndex: '6',
    pointerEvents: 'none',
    transformOrigin: '0 0',
    margin: '0',
    ...extra,
  })
}

/** The tile's title flies to the chip's label, shrinking to its size and fading to its colour. */
function flyText(board: HTMLElement, from: Element, to: Element, timing: KeyframeAnimationOptions, animations: Animation[]): Flight {
  const a = textBox(board, from)
  const b = textBox(board, to)
  const look = getComputedStyle(from)
  const flight = document.createElement('span')
  flight.textContent = from.textContent
  place(flight, a, { whiteSpace: 'nowrap', fontFamily: look.fontFamily, fontSize: look.fontSize, fontWeight: look.fontWeight, lineHeight: `${a.height}px`, color: look.color })
  board.append(flight)
  animations.push(
    flight.animate(
      [
        { transform: 'none', color: look.color },
        { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${b.height / a.height || 1})`, color: getComputedStyle(to).color },
      ],
      timing,
    ),
  )
  return flight
}

/** The tile's icon flies to the chip's. */
function flyIcon(board: HTMLElement, from: Element, to: Element, timing: KeyframeAnimationOptions, animations: Animation[]): Flight {
  const a = boxIn(board, from)
  const b = boxIn(board, to)
  const color = getComputedStyle(from).color
  const flight = from.cloneNode(true) as Flight
  place(flight, a, { width: `${a.width}px`, height: `${a.height}px`, color })
  board.append(flight)
  animations.push(
    flight.animate(
      [
        { transform: 'none', color },
        { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${b.width / a.width || 1})`, color: getComputedStyle(to).color },
      ],
      timing,
    ),
  )
  return flight
}

/** The photo gathers in the middle of the tile and shrinks into the chip's thumbnail. */
function flyPhoto(board: HTMLElement, tile: Box, to: HTMLImageElement, timing: KeyframeAnimationOptions, animations: Animation[]): Flight {
  const size = 72
  const start = { left: tile.left + tile.width / 2 - size / 2, top: tile.top + tile.height / 2 - size / 2, width: size, height: size }
  const b = boxIn(board, to)
  const flight = to.cloneNode() as HTMLImageElement
  place(flight, start, { width: `${size}px`, height: `${size}px`, borderRadius: '50%', objectFit: 'cover', opacity: '0' })
  board.append(flight)
  animations.push(
    flight.animate(
      [
        { opacity: 0, transform: 'none' },
        { opacity: 1, offset: 0.3 },
        { opacity: 1, transform: `translate(${b.left - start.left}px, ${b.top - start.top}px) scale(${b.width / size})` },
      ],
      timing,
    ),
  )
  return flight
}

/**
 * Shrinks a full tile into its chip. The tile's box travels to the chip's while its corners round into a pill and
 * its colour passes through the world's colour into the chip's. Its content fades, and its title and icon fly into
 * the chip's (the photo shrinks into the thumbnail). Under reduce motion the tile fades out where it is as the chip
 * fades in.
 */
export function morphIntoChip({ board, box, tile, chip }: MorphParts, reduce: boolean): Morph {
  if (!canAnimate()) return { finished: Promise.resolve(), cancel() {} }
  const animations: Animation[] = []
  const flights: Flight[] = []
  if (reduce) {
    const fade: KeyframeAnimationOptions = { duration: 250, fill: 'forwards' }
    animations.push(box.animate([{ opacity: 1 }, { opacity: 0 }], fade), chip.animate([{ opacity: 0 }, { opacity: 1 }], fade))
  } else {
    const a = boxIn(board, box)
    const b = boxIn(board, chip)
    const surface = getComputedStyle(chip).backgroundColor
    const timing: KeyframeAnimationOptions = { duration: MORPH_MS, easing: EASE_MORPH, fill: 'forwards' }
    animations.push(
      box.animate(
        [
          { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` },
          { left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` },
        ],
        timing,
      ),
      tile.animate(
        [
          { borderRadius: '20px', backgroundColor: surface },
          { backgroundColor: `color-mix(in srgb, var(--color-world) 55%, ${surface})`, offset: 0.22 },
          { borderRadius: `${b.height / 2}px`, backgroundColor: surface },
        ],
        timing,
      ),
    )
    for (const child of Array.from(tile.children)) {
      animations.push(child.animate([{ opacity: getComputedStyle(child).opacity }, { opacity: 0 }], { duration: MORPH_MS * 0.3, easing: 'ease-out', fill: 'forwards' }))
    }
    const title = tile.querySelector('[data-fill-title]')
    const label = chip.querySelector('[data-chip-label]')
    if (title && label) flights.push(flyText(board, title, label, timing, animations))
    const chipIcon = chip.querySelector('[data-chip-icon]')
    const photo = chipIcon?.querySelector('img')
    const icon = tile.querySelector('[data-fill-icon] svg')
    if (photo) flights.push(flyPhoto(board, a, photo, timing, animations))
    else if (icon && chipIcon) flights.push(flyIcon(board, icon, chipIcon, timing, animations))
  }
  const finished = Promise.allSettled(animations.map((animation) => animation.finished)).then(() => flights.forEach((flight) => flight.remove()))
  return {
    finished,
    cancel() {
      animations.forEach((animation) => animation.cancel())
      flights.forEach((flight) => flight.remove())
    },
  }
}

/** Landing: the chip's tick pops and the chip gives a small bounce. */
export function popTick(chip: HTMLElement): void {
  if (!canAnimate()) return
  chip.querySelector('[data-chip-tick]')?.animate(
    [{ transform: 'scale(0) rotate(-35deg)' }, { transform: 'scale(1.45)', offset: 0.55 }, { transform: 'scale(1)' }],
    { duration: 440, easing: EASE_POP },
  )
  chip.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.07)', offset: 0.35 }, { transform: 'scale(1)' }], { duration: 360, easing: 'ease-out' })
}

/** A tile whose width changes widens or narrows; its fill is drawn at each width on the way. */
export function animateWidth(tile: HTMLElement, from: number, to: number): void {
  if (!canAnimate() || from === to) return
  tile.animate([{ width: `${from}px` }, { width: `${to}px` }], { duration: RESIZE_MS, easing: EASE_SLIDE })
}
