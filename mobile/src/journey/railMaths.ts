/** A day's row in the logbook: its day and where it sits in the page, in points from the page's top. */
export interface RowPlace {
  day: number
  top: number
  height: number
}

/** Where on the screen the rail reads which day you're looking at: a little above the middle (the web's READ_LINE). */
export const READ_LINE = 0.45

/**
 * How far up the climb the read line is (the web's dayInView, src/screens/Journey/AltitudeRail.tsx): a day counts in
 * full once the line reaches the top of its row, and empties as the line goes down through it. Between two rows (over a
 * world's cover) it rests on the day below, so a world's section is full before the next one starts. Above the first
 * row (the top of the page) it's the day reached; past the last row, nothing. `rows` go down the page (newest first),
 * `line` is in the page's points.
 */
export function dayInView(rows: readonly RowPlace[], line: number, dayReached: number): number {
  'worklet'
  if (rows.length === 0) return dayReached
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (row.top + row.height <= line) continue
    if (row.top > line) return i === 0 ? dayReached : row.day
    return row.day - (line - row.top) / row.height
  }
  return 0
}

/** How full a world's section of the rail is, 0 to 1, with the climb at `day`. */
export function sectionFill(day: number, firstDay: number, lastDay: number): number {
  'worklet'
  return Math.min(1, Math.max(0, (day - firstDay + 1) / (lastDay - firstDay + 1)))
}

/**
 * The day the rail shows with the page scrolled to `scrollY`: never past the day reached. The read line is 45% down a
 * window `windowHeight` tall, in the page's points (the page starts under the status bar, `insetTop` down).
 */
export function railDay(rows: readonly RowPlace[], scrollY: number, windowHeight: number, insetTop: number, dayReached: number): number {
  'worklet'
  return Math.min(dayReached, dayInView(rows, scrollY + windowHeight * READ_LINE - insetTop, dayReached))
}
