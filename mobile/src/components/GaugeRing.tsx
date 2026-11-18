import { useId } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Defs, G, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg'
import { useTheme } from '../theme/ThemeProvider'
import { mixHex } from '../theme/tokens'

interface GaugeRingProps {
  value: number
  max: number
}

// The web gauge's numbers (src/components/ui/GaugeRing.tsx).
const BARS = 41
const CX = 92
const CY = 92
const LABEL_STOPS = 33
const CROWN = 'M12 6l4 6l5-4l-2 10H5L3 8l5 4z'
const UNLIT_OPACITY = 0.25

const point = (r: number, deg: number) => [CX + r * Math.cos((deg * Math.PI) / 180), CY + r * Math.sin((deg * Math.PI) / 180)]
/** Each bar is drawn from r 54 to r 90 but shows r 60 to 78 (the dash), as on the web, so the wave can grow it both ways. */
const GEOMETRY = Array.from({ length: BARS }, (_, i) => {
  const along = i / (BARS - 1)
  const deg = 150 + along * 240
  const [x1, y1] = point(54, deg)
  const [x2, y2] = point(90, deg)
  return { x1, y1, x2, y2, along }
})

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
export const litBars = (value: number, max: number) => (max > 0 ? Math.round(clamp01(value / max) * BARS) : 0)

/**
 * The day's tasks as an arch of bars in the world's colours, with a crown in
 * its gap. This is the gauge at rest, as the web shows it under reduce motion:
 * the wave through the bars, the crown's pop and the sparkles come with the
 * tile fills (part 4c).
 */
export function GaugeRing({ value, max }: GaugeRingProps) {
  const { colors, fonts } = useTheme()
  const id = useId()
  const p = max > 0 ? clamp01(value / max) : 0
  const lit = litBars(value, max)
  // Never full before the day is won: only 5/5 earns the whole crown.
  const crown = p >= 1 ? 1 : p * 0.7
  const soft = 0.06

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`${value} of ${max} tasks done`} style={styles.box}>
      <Svg width="100%" height="100%" viewBox="0 0 184 152">
        <Defs>
          <LinearGradient id={`${id}label`}>
            {Array.from({ length: LABEL_STOPS }, (_, j) => {
              const o = j / (LABEL_STOPS - 1)
              const filled = p > 0 ? clamp01((p - o) / 0.08 + 0.5) : 0
              // World ink deepened toward the text colour: every stop reads at least as well as world ink.
              return <Stop key={j} offset={o} stopColor={mixHex(colors.inkMuted, mixHex(colors.worldInk, colors.ink, o * 0.35), filled)} />
            })}
          </LinearGradient>
          <LinearGradient id={`${id}crown`}>
            {[0, Math.max(0, crown - soft), Math.min(1, crown + soft), 1].map((offset, j) => (
              <Stop key={j} offset={offset} stopColor={colors.yellow} stopOpacity={crown > 0 && j < 2 ? 1 : 0} />
            ))}
          </LinearGradient>
        </Defs>
        {GEOMETRY.map((bar, i) => (
          <Line
            key={i}
            x1={bar.x1}
            y1={bar.y1}
            x2={bar.x2}
            y2={bar.y2}
            strokeLinecap="round"
            strokeWidth={3}
            strokeDasharray="18 100"
            strokeDashoffset={-6}
            stroke={i < lit ? mixHex(colors.world, colors.yellow, bar.along) : colors.inkMuted}
            strokeOpacity={i < lit ? 1 : UNLIT_OPACITY}
          />
        ))}
        <SvgText x={CX} y={70} textAnchor="middle" fill={`url(#${id}label)`} fontFamily={fonts.rounded.bold} fontSize={11}>
          today&apos;s tasks
        </SvgText>
        <SvgText x={CX + 3} y={108} textAnchor="end" fill={colors.ink} fontFamily={fonts.display.semibold} fontSize={46}>
          {value}
        </SvgText>
        <SvgText x={CX + 5} y={108} fill={colors.inkMuted} fontFamily={fonts.display.semibold} fontSize={18}>
          /{max}
        </SvgText>
        <G transform={`translate(${CX - 12} 112)`}>
          <Path d={CROWN} fill={`url(#${id}crown)`} />
          <Path
            d={CROWN}
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            stroke={mixHex(colors.inkMuted, colors.yellowDark, crown)}
          />
        </G>
      </Svg>
    </View>
  )
}

interface FlameStreakProps {
  streak: number
}

/**
 * A running streak: a flame and the count of days. The emoji is the web's own
 * look until its animated flame has loaded (src/components/FlameStreak.tsx);
 * the animated one, and the flame gone out at 0, come with part 4c.
 */
export function FlameStreak({ streak }: FlameStreakProps) {
  const { colors, fonts } = useTheme()
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Streak: ${streak} ${streak === 1 ? 'day' : 'days'}`} style={styles.streak}>
      <Text style={styles.flame}>🔥</Text>
      <Text style={[styles.count, { color: colors.orangeInk, fontFamily: fonts.rounded.bold }]}>{streak}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { width: '100%', maxWidth: 184, aspectRatio: 184 / 152 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flame: { fontSize: 22 },
  count: { fontSize: 18 },
})
