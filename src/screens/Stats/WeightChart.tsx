import { useId, type PointerEvent } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import type { TrendWeight } from '../../logic/measurements'

interface WeightChartProps {
  /** The attempt's weigh-ins, from `weightTrend`. */
  points: TrendWeight[]
  /** The day the attempt has reached: the axis runs to it. */
  lastDay: number
  /** The day the cursor stands on, if the chart has been read. */
  readDay: number | null
  /** A finger (or pointer) picked the weigh-in of this day. */
  onRead: (day: number) => void
}

const TICK_STEP = 10
const AXIS_TICK = { fill: 'var(--color-ink-muted)', fontSize: 12, fontFamily: 'var(--font-rounded)' }
const MARK = { fill: 'var(--color-chart-line)', stroke: 'var(--color-surface)', strokeWidth: 2 }
const FAINT_DOT = { fill: 'var(--color-chart-line)', fillOpacity: 0.4, stroke: 'none', r: 3 }
/** The plot sits between these: the left margin (room for "Start") and the scale on the right. */
const MARGIN_LEFT = 16
const SCALE_WIDTH = 30

/** "Day 1", then every 10 days; a starting weigh-in from before Day 1 takes the first tick, as "Start". */
function dayTicks(hasStart: boolean, lastDay: number): number[] {
  const ticks = [hasStart ? 0 : 1]
  for (let day = TICK_STEP; day <= lastDay; day += TICK_STEP) ticks.push(day)
  return ticks
}

const tickLabel = (day: number) => (day === 0 ? 'Start' : day === 1 ? 'Day 1' : String(day))

/**
 * Weight over the attempt, by challenge day: one series, so no legend. The smoothed trend
 * carries the line, over a soft fill, from the first weigh-in; the weigh-ins are faint dots and
 * the latest trend gets a big dot. The scale sits on the right.
 *
 * A finger anywhere on the chart puts the cursor on the closest weigh-in by day, and dragging
 * moves it; it stays where it was let go. The section's header shows the reading (no floating
 * box), and nothing animates. Vertical swipes still scroll the page.
 */
export function WeightChart({ points, lastDay, readDay, onRead }: WeightChartProps) {
  const fillId = useId()
  const firstDay = points[0]?.day === 0 ? 0 : 1
  const last = points.length - 1
  const reading = readDay === null ? undefined : points.find((p) => p.day === readDay)

  const weights = points.map((p) => p.weight_kg)
  const yDomain = [Math.floor(Math.min(...weights) - 1), Math.ceil(Math.max(...weights) + 1)]

  const read = (event: PointerEvent<HTMLDivElement>) => {
    // A mouse reads on hover; a finger only while it touches.
    if (event.type === 'pointermove' && event.pointerType !== 'mouse' && event.buttons === 0) return
    const box = event.currentTarget.getBoundingClientRect()
    const width = box.width - MARGIN_LEFT - SCALE_WIDTH
    const share = Math.min(1, Math.max(0, (event.clientX - box.left - MARGIN_LEFT) / width))
    const day = firstDay + share * (lastDay - firstDay)
    const closest = points.reduce((best, p) => (Math.abs(p.day - day) < Math.abs(best.day - day) ? p : best))
    if (closest.day !== readDay) onRead(closest.day)
  }

  return (
    <figure className="mt-1 -mx-1" aria-label="Weight by challenge day chart">
      <div className="h-40 w-full touch-pan-y select-none" onPointerDown={read} onPointerMove={read}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 0, bottom: 0, left: MARGIN_LEFT }}>
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--color-chart-line)" stopOpacity={0.3} />
                <stop offset="1" stopColor="var(--color-chart-line)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--color-chart-grid)" strokeWidth={1} />
            <XAxis
              dataKey="day"
              type="number"
              domain={[firstDay, lastDay]}
              ticks={dayTicks(firstDay === 0, lastDay)}
              interval={0}
              tickFormatter={tickLabel}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              orientation="right"
              domain={yDomain}
              allowDecimals={false}
              width={SCALE_WIDTH}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
            />
            <Area
              type="monotone"
              dataKey="trend"
              stroke="var(--color-chart-line)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={`url(#${fillId})`}
              dot={({ cx, cy, index }: { cx?: number; cy?: number; index?: number }) =>
                index === last ? <circle key="latest" cx={cx} cy={cy} r={6} {...MARK} strokeWidth={3} /> : <g key={index} />
              }
              activeDot={false}
              isAnimationActive={false}
            />
            <Line type="linear" dataKey="weight_kg" stroke="none" dot={FAINT_DOT} activeDot={false} isAnimationActive={false} />
            {reading && <ReferenceLine x={reading.day} stroke="var(--color-ink-muted)" strokeWidth={1} />}
            {reading && <ReferenceDot x={reading.day} y={reading.weight_kg} r={5} {...MARK} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
