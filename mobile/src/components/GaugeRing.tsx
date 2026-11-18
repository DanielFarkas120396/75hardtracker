import { useEffect, useId, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, { Defs, G, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useTheme } from '../theme/ThemeProvider'
import { mixHex } from '../theme/tokens'
import { canAnimate } from '../today/boardSettle'
import { BARS, changeFrom, gaugeFrame, restFrame, type GaugeChange } from './gaugeMotion'

export { FlameStreak } from './FlameStreak'
export { litBars } from './gaugeMotion'

interface GaugeRingProps {
  value: number
  max: number
  /** Keeps the last state on screen, and plays the change once released (the "Day complete!" overlay covers it meanwhile). */
  held?: boolean
}

// The web gauge's numbers (src/components/ui/GaugeRing.tsx).
const CX = 92
const CY = 92
const LABEL_STOPS = 33
const CROWN = 'M12 6l4 6l5-4l-2 10H5L3 8l5 4z'

const point = (r: number, deg: number) => [CX + r * Math.cos((deg * Math.PI) / 180), CY + r * Math.sin((deg * Math.PI) / 180)]
/** Each bar is drawn from r 54 to r 90 but shows r 60 to 78 (the dash): the dash grows both ways when the wave passes. */
const GEOMETRY = Array.from({ length: BARS }, (_, i) => {
  const along = i / (BARS - 1)
  const deg = 150 + along * 240
  const [x1, y1] = point(54, deg)
  const [x2, y2] = point(90, deg)
  return { x1, y1, x2, y2, along }
})

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
/** A shape scaled about a point of the drawing. */
const about = (x: number, y: number, scale: number, dy = 0) => `translate(${x} ${y + dy}) scale(${scale}) translate(${-x} ${-y})`
const star = (s: number) => `M0 ${-s}Q0 0 ${s} 0Q0 0 0 ${s}Q0 0 ${-s} 0Q0 0 0 ${-s}z`

/**
 * The day's tasks as an arch of bars in the world's colours, with a crown in its gap. Every change sends one wave
 * through the bars, the label and the crown together; 5/5 ends it with a crown that pops and sparkles. Reduce motion
 * shows the end state at once. The first one counts up from 0.
 */
export function GaugeRing({ value, max, held = false }: GaugeRingProps) {
  const { colors, fonts } = useTheme()
  const id = useId()
  const reduceMotion = useReduceMotion()
  const instant = reduceMotion || !canAnimate()
  // What the gauge shows: the value it stands on or heads for, the change under way, and how far into it.
  const [target, setTarget] = useState(instant ? value : 0)
  const [change, setChange] = useState<GaugeChange | null>(null)
  const [ms, setMs] = useState(0)

  const frame = change ? gaugeFrame(change, ms) : restFrame(target, max)
  if (!held && value !== target) {
    setTarget(value)
    // A change cut short carries on from what is on screen.
    setChange(instant ? null : changeFrom(frame, value, max))
    setMs(0)
  } else if (change && (instant || frame.done)) {
    setChange(null)
  }

  useEffect(() => {
    if (!change) return
    const start = performance.now()
    let id = requestAnimationFrame(function tick(now) {
      setMs(Math.max(0, now - start))
      id = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(id)
  }, [change])

  const soft = 0.06
  const { p, crown } = frame

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`${value} of ${max} tasks done`} style={styles.box}>
      <Svg width="100%" height="100%" viewBox="0 0 184 152" style={styles.overflow}>
        <Defs>
          <LinearGradient id={`${id}label`}>
            {Array.from({ length: LABEL_STOPS }, (_, j) => {
              const o = j / (LABEL_STOPS - 1)
              const filled = p > 0 ? clamp01((p - o) / 0.08 + 0.5) : 0
              // World ink deepened toward the text colour: every stop reads at least as well as world ink.
              let color = mixHex(colors.inkMuted, mixHex(colors.worldInk, colors.ink, o * 0.35), filled)
              if (frame.sweep !== null) {
                const band = Math.max(0, 1 - Math.abs(o - frame.sweep) / 0.16)
                const glow = band * band * frame.sweepStrength
                if (glow > 0.01) color = mixHex(color, '#ffffff', glow)
              }
              return <Stop key={j} offset={o} stopColor={color} />
            })}
          </LinearGradient>
          <LinearGradient id={`${id}crown`}>
            {[0, Math.max(0, crown - soft), Math.min(1, crown + soft), 1].map((offset, j) => (
              <Stop key={j} offset={offset} stopColor={colors.yellow} stopOpacity={crown > 0 && j < 2 ? 1 : 0} />
            ))}
          </LinearGradient>
        </Defs>
        {GEOMETRY.map((bar, i) => {
          const state = frame.bars[i]
          return (
            <Line
              key={i}
              x1={bar.x1}
              y1={bar.y1}
              x2={bar.x2}
              y2={bar.y2}
              strokeLinecap="round"
              strokeWidth={state.width}
              strokeDasharray={`${state.dash} 100`}
              strokeDashoffset={state.offset}
              stroke={mixHex(colors.inkMuted, mixHex(colors.world, colors.yellow, bar.along), state.lit)}
              strokeOpacity={state.opacity}
            />
          )
        })}
        <G transform={about(CX, 68, frame.labelScale)}>
          <SvgText x={CX} y={70} textAnchor="middle" fill={`url(#${id}label)`} fontFamily={fonts.rounded.bold} fontSize={11}>
            today&apos;s tasks
          </SvgText>
        </G>
        <G transform={about(CX - 8, 94, frame.number.scale, frame.number.dy)} opacity={frame.number.opacity}>
          <SvgText testID="gauge-count" x={CX + 3} y={108} textAnchor="end" fill={colors.ink} fontFamily={fonts.display.semibold} fontSize={46}>
            {frame.count}
          </SvgText>
        </G>
        <SvgText x={CX + 5} y={108} fill={colors.inkMuted} fontFamily={fonts.display.semibold} fontSize={18}>
          /{max}
        </SvgText>
        <G transform={`${about(CX, 124, frame.crownScale)} translate(${CX - 12} 112)`}>
          <Path d={CROWN} fill={`url(#${id}crown)`} />
          <Path d={CROWN} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" stroke={mixHex(colors.inkMuted, colors.yellowDark, crown)} />
        </G>
        {frame.stars.map((s, k) => (
          <Path
            key={k}
            d={star(s.size)}
            fill={s.gold ? colors.yellow : colors.world}
            opacity={s.opacity}
            transform={`translate(${s.x} ${s.y}) scale(${s.scale}) rotate(${s.rotate})`}
          />
        ))}
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { width: '100%', maxWidth: 184, aspectRatio: 184 / 152 },
  overflow: { overflow: 'visible' },
})
