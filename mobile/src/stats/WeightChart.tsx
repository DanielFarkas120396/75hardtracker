import type { TrendWeight } from '@logic/measurements'
import { useMemo, useState } from 'react'
import { PanResponder, View, type GestureResponderEvent } from 'react-native'
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg'
import { useTheme } from '../theme/ThemeProvider'
import { CHART, chartGeometry, closestDay, monotonePath, tickLabel } from './chartGeometry'

interface WeightChartProps {
  /** The attempt's weigh-ins, from `weightTrend`. */
  points: TrendWeight[]
  /** The day the attempt has reached: the axis runs to it. */
  lastDay: number
  /** The day the cursor stands on, if the chart has been read. */
  readDay: number | null
  /** A finger picked the weigh-in of this day. */
  onRead: (day: number) => void
}

/**
 * Weight over the attempt, by challenge day: the smoothed trend carries the line over a soft fill, the weigh-ins are
 * faint dots, the latest trend gets a big dot, the scale sits on the right. A finger anywhere on it puts the cursor on
 * the closest weigh-in by day and a sideways drag moves it; it stays where it was let go, and a vertical swipe still
 * scrolls the page. Nothing animates. The web's WeightChart, drawn by hand.
 */
export function WeightChart({ points, lastDay, readDay, onRead }: WeightChartProps) {
  const { colors, fonts } = useTheme()
  const [width, setWidth] = useState(0)
  const line = colors.worldInk
  const g = chartGeometry(points, lastDay, width)
  const reading = readDay === null ? undefined : points.find((p) => p.day === readDay)
  const latest = points[points.length - 1]

  const read = useMemo(() => {
    const follow = (event: GestureResponderEvent) => {
      if (width === 0 || points.length === 0) return
      const day = closestDay(points, lastDay, width, event.nativeEvent.locationX)
      if (day !== readDay) onRead(day)
    }
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: follow,
      onPanResponderMove: follow,
      // The page's vertical scroll may take the touch over: reading is for sideways moves.
      onPanResponderTerminationRequest: () => true,
    })
  }, [width, points, lastDay, readDay, onRead])

  const trend = points.map((p) => ({ x: g.x(p.day), y: g.y(p.trend) }))
  const curve = monotonePath(trend)
  const area = trend.length > 1 ? `${curve}L${trend[trend.length - 1].x},${g.plot.bottom}L${trend[0].x},${g.plot.bottom}Z` : ''
  const tick = { fill: colors.inkMuted, fontSize: 12, fontFamily: fonts.rounded.regular }

  return (
    <View
      testID="weight-chart"
      accessibilityLabel="Weight by challenge day chart"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ height: CHART.height, marginTop: 4, marginHorizontal: -4 }}
      {...read.panHandlers}
    >
      {width > 0 && (
        <Svg width={width} height={CHART.height} pointerEvents="none">
          <Defs>
            <LinearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={line} stopOpacity={0.3} />
              <Stop offset="1" stopColor={line} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {g.yTicks.map((kg) => (
            <Line key={`grid-${kg}`} x1={g.plot.left} x2={g.plot.right} y1={g.y(kg)} y2={g.y(kg)} stroke={colors.chartGrid} strokeWidth={1} />
          ))}
          {g.yTicks.map((kg) => (
            <SvgText key={`kg-${kg}`} x={g.plot.right + 8} y={g.y(kg) + 4} {...tick}>
              {String(kg)}
            </SvgText>
          ))}
          {g.xTicks.map((day) => (
            <SvgText key={`day-${day}`} x={g.x(day)} y={g.plot.bottom + 20} textAnchor="middle" {...tick}>
              {tickLabel(day)}
            </SvgText>
          ))}
          <Path d={area} fill="url(#weight-fill)" />
          <Path d={curve} fill="none" stroke={line} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p) => (
            <Circle key={`w-${p.day}`} cx={g.x(p.day)} cy={g.y(p.weight_kg)} r={3} fill={line} fillOpacity={0.4} />
          ))}
          {latest && <Circle cx={g.x(latest.day)} cy={g.y(latest.trend)} r={6} fill={line} stroke={colors.surface} strokeWidth={3} />}
          {reading && (
            <>
              <Line x1={g.x(reading.day)} x2={g.x(reading.day)} y1={g.plot.top} y2={g.plot.bottom} stroke={colors.inkMuted} strokeWidth={1} />
              <Circle testID="weight-reading" cx={g.x(reading.day)} cy={g.y(reading.weight_kg)} r={5} fill={line} stroke={colors.surface} strokeWidth={2} />
            </>
          )}
        </Svg>
      )}
    </View>
  )
}
