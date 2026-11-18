import type { FillModel } from './fillKinds'
import { clamp01, inOut, smooth } from './fillMotion'
import type { Mode } from './fillPalette'

/**
 * The chosen book (docs/prototypes/README.md, Reading). `pages`: every ruleset reads 10 pages a day. `turn`: a page
 * lifts at once, 2.1 s of motion. `fadeIn`: a new page fades in over 1.5 s (chosen 2026-11-17: a quick fade made its
 * shape pop up over the book). `ebb`: how fast the fill recedes after an undo, in pages a second (ten in 0.4 s).
 */
export const BOOK = {
  pages: 10,
  turn: 2.2,
  fade: 0.7,
  fadeIn: 1.5,
  beta: 0.6,
  base: 0.6,
  blend: 0.8,
  reach: 0.4,
  feather: 18,
  fillFrom: 0.12,
  fillTo: 0.9,
  start: 0.04,
  gutter: 0.32,
  ebb: 25,
}

/** The gap before the next page: the calm pace for one page; several at once riffle through, all starting within 2.4 s. */
export function riffleGap(pagesToGo: number): number {
  return Math.min(BOOK.turn * 0.45, 2.4 / Math.max(1, pagesToGo))
}

/**
 * The spine's shade, from 0 to 1. It comes in with the first page and leaves with it on undo: an unread book's dark
 * crease read as a glitch. In light mode it stays soft, so the tile's ink keeps 4.5:1 across it.
 */
export function spineShade(pagesTurned: number, mode: Mode): number {
  return smooth(pagesTurned) * (mode === 'light' ? 0.5 : 1)
}

/** How steeply the open book's page dips at `u` (0 at the spine, 1 at its outer edge), radians. */
export const restAngle = (u: number) => BOOK.beta * (1 - smooth(clamp01(u / BOOK.gutter)))

/**
 * The angle of a turning page at (`u`, `v`) (`v` 1 at the top), `t` of the way through its turn. It turns around the
 * spine; its bottom-right corner leads and the part by the spine lags, so it curls.
 */
export function pageAngle(u: number, v: number, t: number): number {
  const lead = 0.3 * u * (1 - v) + 0.12 * u
  const lag = 0.16 * (1 - smooth(clamp01(u / 0.3)))
  const e = inOut((t - BOOK.start - lag + lead) / (1 - BOOK.start - lag))
  const r = restAngle(u)
  return r + (Math.PI - 2 * r) * e
}

/** A turning page's opacity: it fades in as it lifts and out as it lands. */
export const pageOpacity = (t: number) => 0.55 * Math.min(smooth((t * BOOK.turn) / BOOK.fadeIn), 1 - smooth((t - BOOK.fade) / (1 - BOOK.fade)))

export interface BookPage {
  /** Counts up with each page started: the order they are drawn in. */
  id: number
  /** 0–1 through its turn. */
  t: number
}

export interface BookFrame {
  /** Pages turned so far, a page in mid-turn counting for its share. */
  turned: number
  /** The fill's right edge, px from the tile's left edge. */
  fillPx: number
  /** The pages turning now, oldest first. */
  pages: readonly BookPage[]
}

/** Reading: an open book whose pages lift from the right, curl over the spine and fade; the tile fills a tenth per page. */
export function createBookModel(): FillModel<BookFrame> {
  const active: (BookPage & { start: number })[] = []
  let shown = 0
  let target = 0
  let time = 0
  let nextAt = 0
  let gap = BOOK.turn * 0.45
  let serial = 0
  /** Pages of fill still receding after an undo: the book never turns pages back. */
  let ebb = 0

  const share = (page: BookPage) => smooth((page.t - BOOK.fillFrom) / (BOOK.fillTo - BOOK.fillFrom))
  const turned = () => shown + ebb + active.reduce((sum, page) => sum + share(page), 0)

  return {
    setLevel(level, instant) {
      const pages = Math.round(level * BOOK.pages)
      target = pages
      if (instant) {
        active.length = 0
        shown = pages
        ebb = 0
        return
      }
      if (pages < shown + active.length) {
        // Keep the pages already turning that still fit; the fill recedes over the rest, never jumping up.
        const from = turned()
        while (active.length > 0 && shown + active.length > pages) active.pop()
        shown = Math.min(shown, pages)
        ebb = 0
        ebb = Math.max(0, from - turned())
      }
      gap = riffleGap(pages - shown - active.length)
    },
    step(dt) {
      time += dt
      ebb = Math.max(0, ebb - dt * BOOK.ebb)
      if (shown + active.length < target && time >= nextAt) {
        active.push({ id: ++serial, start: time, t: 0 })
        nextAt = time + gap
      }
      for (let k = active.length - 1; k >= 0; k--) {
        const page = active[k]
        page.t = clamp01((time - page.start) / BOOK.turn)
        if (page.t >= 1) {
          shown = Math.min(BOOK.pages, shown + 1)
          active.splice(k, 1)
        }
      }
      return active.length > 0 || shown < target || ebb > 0
    },
    drifts: () => false,
    shown: () => turned() / BOOK.pages,
    settled: () => ebb === 0 && turned() >= target - 0.02,
    frame: (width) => ({ turned: turned(), fillPx: (Math.min(BOOK.pages, turned()) / BOOK.pages) * width, pages: active }),
  }
}
