import { weightTicks, type TrendWeight } from '@logic/measurements'

/** The web's chart margins (recharts): room for "Start" on the left, the scale on the right, the day labels below. */
export const CHART = { height: 160, top: 8, left: 16, scale: 30, axis: 30 } as const
const TICK_STEP = 10

/** "Day 1" (or "Start" for a weigh-in before Day 1), then every 10 days up to the day reached. */
export function dayTicks(hasStart: boolean, lastDay: number): number[] {
  const ticks = [hasStart ? 0 : 1]
  for (let day = TICK_STEP; day <= lastDay; day += TICK_STEP) ticks.push(day)
  return ticks
}

export const tickLabel = (day: number) => (day === 0 ? 'Start' : day === 1 ? 'Day 1' : String(day))

export interface ChartGeometry {
  firstDay: number
  /** The plot's box, in points. */
  plot: { left: number; right: number; top: number; bottom: number }
  x: (day: number) => number
  y: (kg: number) => number
  yTicks: number[]
  xTicks: number[]
}

/** Where things go on a chart `width` points wide, for the weigh-ins `points` and an axis running to `lastDay`. */
export function chartGeometry(points: readonly TrendWeight[], lastDay: number, width: number): ChartGeometry {
  const firstDay = points[0]?.day === 0 ? 0 : 1
  const plot = { left: CHART.left, right: width - CHART.scale, top: CHART.top, bottom: CHART.height - CHART.axis }
  const yTicks = weightTicks(points.map((p) => p.weight_kg))
  const low = yTicks[0]
  const high = yTicks[yTicks.length - 1]
  const span = Math.max(1, lastDay - firstDay)
  return {
    firstDay,
    plot,
    x: (day) => plot.left + ((day - firstDay) / span) * (plot.right - plot.left),
    y: (kg) => plot.bottom - ((kg - low) / Math.max(1e-9, high - low)) * (plot.bottom - plot.top),
    yTicks,
    xTicks: dayTicks(firstDay === 0, lastDay),
  }
}

/** The weigh-in closest by day to a finger at `x` points across the chart (the web's read()). */
export function closestDay(points: readonly TrendWeight[], lastDay: number, width: number, x: number): number {
  const { firstDay, plot } = chartGeometry(points, lastDay, width)
  const share = Math.min(1, Math.max(0, (x - plot.left) / (plot.right - plot.left)))
  const day = firstDay + share * (lastDay - firstDay)
  return points.reduce((best, p) => (Math.abs(p.day - day) < Math.abs(best.day - day) ? p : best)).day
}

const sign = (v: number) => (v < 0 ? -1 : 1)

/**
 * A smooth line through the points that never overshoots them: d3's curveMonotoneX (Fritsch–Carlson), the curve
 * recharts draws for type "monotone". Points go left to right.
 */
export function monotonePath(points: readonly { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M${points[0].x},${points[0].y}`
  const n = points.length
  const slopes = points.slice(1).map((p, i) => (p.y - points[i].y) / (p.x - points[i].x || 1e-9))
  const tangents = points.map((_, i) => {
    if (i === 0 || i === n - 1) return 0
    const h0 = points[i].x - points[i - 1].x
    const h1 = points[i + 1].x - points[i].x
    const [s0, s1] = [slopes[i - 1], slopes[i]]
    const p = (s0 * h1 + s1 * h0) / (h0 + h1 || 1e-9)
    return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0
  })
  // The ends lean on their neighbour's tangent, as d3's slope2.
  tangents[0] = n > 2 ? (3 * slopes[0] - tangents[1]) / 2 : slopes[0]
  tangents[n - 1] = n > 2 ? (3 * slopes[n - 2] - tangents[n - 2]) / 2 : slopes[0]
  let d = `M${points[0].x},${points[0].y}`
  for (let i = 1; i < n; i++) {
    const [a, b] = [points[i - 1], points[i]]
    const dx = (b.x - a.x) / 3
    d += `C${a.x + dx},${a.y + dx * tangents[i - 1]},${b.x - dx},${b.y - dx * tangents[i]},${b.x},${b.y}`
  }
  return d
}
