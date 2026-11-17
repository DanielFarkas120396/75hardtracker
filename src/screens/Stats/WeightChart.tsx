import { useReducedMotion } from 'framer-motion'
import { useId } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { format, parseISO } from 'date-fns'
import type { TrendWeight } from '../../logic/measurements'

interface WeightChartProps {
  /** The attempt's weigh-ins, from `weightTrend`. */
  points: TrendWeight[]
  /** The day the attempt has reached: the axis runs to it. */
  lastDay: number
}

interface ChartDatum {
  day: number
  date: string
  weight: number
  trend: number
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

/** Crosshair readout: the weight leads, then the day and date, then the trend there. */
function WeightTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartDatum }[] }) {
  const datum = active ? payload?.[0]?.payload : undefined
  if (!datum) return null
  return (
    <div className="rounded-xl bg-surface px-3 py-2 font-rounded shadow-md ring-1 ring-ink/10">
      <p className="text-base font-bold text-ink">{datum.weight.toFixed(1)} kg</p>
      <p className="text-xs font-semibold text-ink-muted">
        {datum.day === 0 ? 'Start' : `Day ${datum.day}`} · {format(parseISO(datum.date), 'EEE d MMM')}
      </p>
      <p className="text-xs font-semibold text-ink-muted">Trend {datum.trend.toFixed(1)} kg</p>
    </div>
  )
}

/**
 * Weight over the attempt, by challenge day: one series, so no legend (the section heading
 * names it). The smoothed trend carries the line, over a soft fill, from the first weigh-in;
 * the weigh-ins are faint dots and the latest trend gets a big dot. The scale sits on the right.
 */
export function WeightChart({ points, lastDay }: WeightChartProps) {
  const reduceMotion = useReducedMotion()
  const fillId = useId()
  const data: ChartDatum[] = points.map((p) => ({ day: p.day, date: p.date, weight: p.weight_kg, trend: p.trend }))
  const hasStart = data[0]?.day === 0
  const last = data.length - 1

  const weights = data.map((d) => d.weight)
  const yDomain = [Math.floor(Math.min(...weights) - 1), Math.ceil(Math.max(...weights) + 1)]

  return (
    <figure className="mt-3 -mx-1" aria-label="Weight by challenge day chart">
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 0, bottom: 0, left: 16 }}>
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
            <Tooltip content={<WeightTooltip />} cursor={{ stroke: 'var(--color-ink-muted)', strokeWidth: 1 }} />
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
              isAnimationActive={!reduceMotion}
            />
            <Line
              type="linear"
              dataKey="weight"
              stroke="none"
              dot={FAINT_DOT}
              activeDot={{ ...MARK, r: 5 }}
              isAnimationActive={!reduceMotion}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
