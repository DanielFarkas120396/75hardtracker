import { useEffect, useId } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TrendWeight } from '../../logic/measurements'

interface WeightChartProps {
  /** The attempt's weigh-ins, from `weightTrend`. */
  points: TrendWeight[]
  /** The day the attempt has reached: the axis runs to it. */
  lastDay: number
  /** The day of the weigh-in under the finger (or pointer) while it reads the chart; null once it lets go. */
  onRead: (day: number | null) => void
}

const TICK_STEP = 10
const AXIS_TICK = { fill: 'var(--color-ink-muted)', fontSize: 12, fontFamily: 'var(--font-rounded)' }
const MARK = { fill: 'var(--color-chart-line)', stroke: 'var(--color-surface)', strokeWidth: 2 }
const FAINT_DOT = { fill: 'var(--color-chart-line)', fillOpacity: 0.4, stroke: 'none', r: 3 }

/** "Day 1", then every 10 days; a starting weigh-in from before Day 1 takes the first tick, as "Start". */
function dayTicks(hasStart: boolean, lastDay: number): number[] {
  const ticks = [hasStart ? 0 : 1]
  for (let day = TICK_STEP; day <= lastDay; day += TICK_STEP) ticks.push(day)
  return ticks
}

const tickLabel = (day: number) => (day === 0 ? 'Start' : day === 1 ? 'Day 1' : String(day))

/**
 * The tooltip draws nothing: it hands the day under the finger to the header, once it has moved
 * there. Only the day (a number) is passed on, so a re-render with fresh point objects can't loop.
 */
function Reader({
  active,
  payload,
  onRead,
}: {
  active?: boolean
  payload?: { payload: TrendWeight }[]
  onRead: (day: number | null) => void
}) {
  const day = active ? (payload?.[0]?.payload.day ?? null) : null
  useEffect(() => onRead(day), [day, onRead])
  return null
}

/**
 * Weight over the attempt, by challenge day: one series, so no legend. The smoothed trend
 * carries the line, over a soft fill, from the first weigh-in; the weigh-ins are faint dots and
 * the latest trend gets a big dot. The scale sits on the right. Reading a point shows a plain
 * crosshair; the section's header shows the reading (no floating box), and nothing animates,
 * so the line never redraws while a finger moves over it.
 */
export function WeightChart({ points, lastDay, onRead }: WeightChartProps) {
  const fillId = useId()
  const hasStart = points[0]?.day === 0
  const last = points.length - 1

  const weights = points.map((p) => p.weight_kg)
  const yDomain = [Math.floor(Math.min(...weights) - 1), Math.ceil(Math.max(...weights) + 1)]

  return (
    // A lifted finger hands the header back to today's weight.
    <figure className="mt-1 -mx-1" aria-label="Weight by challenge day chart" onTouchEnd={() => onRead(null)}>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 0, bottom: 0, left: 16 }}>
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
              domain={[hasStart ? 0 : 1, lastDay]}
              ticks={dayTicks(hasStart, lastDay)}
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
              width={30}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<Reader onRead={onRead} />} isAnimationActive={false} cursor={{ stroke: 'var(--color-ink-muted)', strokeWidth: 1 }} />
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
            <Line
              type="linear"
              dataKey="weight_kg"
              stroke="none"
              dot={FAINT_DOT}
              activeDot={{ ...MARK, r: 5 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
