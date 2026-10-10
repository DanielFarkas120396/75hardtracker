import type { FillPalette } from './palette'
import type { Painter, PainterKind } from './painter'
import { createBook } from './book'
import { createInk } from './ink'
import { createIris } from './iris'
import { createSprint } from './sprint'
import { createWave } from './wave'

/** The fills built so far; a task whose kind isn't here keeps the thin bar. */
export const PAINTERS: Partial<Record<PainterKind, (palette: FillPalette) => Painter>> = {
  wave: createWave,
  ink: createInk,
  sprint: createSprint,
  iris: createIris,
  book: createBook,
}
