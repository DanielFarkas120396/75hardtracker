import { useReducedMotion } from 'framer-motion'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { format, parseISO } from 'date-fns'
import type { WeightPoint } from '../../logic/measurements'

interface WeightChartProps {
  points: WeightPoint[]
}

interface ChartDatum {
  time: number
  weight: number
}

const shortDate = (time: number) => format(time, 'd MMM')
const AXIS_TICK = { fill: 'var(--color-ink-muted)', fontSize: 12, fontFamily: 'var(--font-rounded)' }
const MARK = { fill: 'var(--color-chart-line)', stroke: 'var(--color-surface)', strokeWidth: 2 }

/** Crosshair readout: the value leads, the date follows. */
function WeightTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartDatum }[] }) {
  const datum = active ? payload?.[0]?.payload : undefined
  if (!datum) return null
  return (
    <div className="rounded-xl bg-surface px-3 py-2 font-rounded shadow-md ring-1 ring-ink/10">
      <p className="text-base font-extrabold text-ink">{datum.weight.toFixed(1)} kg</p>
      <p className="text-xs font-semibold text-ink-muted">{format(datum.time, 'EEE d MMM yyyy')}</p>
    </div>
  )
}

/**
 * Weight over time: one series, so no legend (the section heading names it).
 * A real time axis keeps irregular weigh-ins honestly spaced; the list under
 * the chart is its table view.
 */
export function WeightChart({ points }: WeightChartProps) {
  const reduceMotion = useReducedMotion()
  const data: ChartDatum[] = [...points]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => ({ time: parseISO(p.date).getTime(), weight: p.weight_kg }))

  const weights = data.map((d) => d.weight)
  const yDomain = [Math.floor(Math.min(...weights) - 1), Math.ceil(Math.max(...weights) + 1)]

  return (
    <figure className="mt-3" aria-label="Weight over time chart">
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-chart-grid)" strokeWidth={1} />
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={shortDate}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              domain={yDomain}
              allowDecimals={false}
              width={34}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<WeightTooltip />} cursor={{ stroke: 'var(--color-ink-muted)', strokeWidth: 1 }} />
            <Line
              type="linear"
              dataKey="weight"
              stroke="var(--color-chart-line)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={{ ...MARK, r: 4 }}
              activeDot={{ ...MARK, r: 6 }}
              isAnimationActive={!reduceMotion}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
