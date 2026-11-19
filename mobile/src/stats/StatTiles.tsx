import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg'
import { useTheme } from '../theme/ThemeProvider'
import { mixHex, withAlpha } from '../theme/tokens'
import { fadeInOut, phase, useLoopClock } from './loop'

const AnimatedG = Animated.createAnimatedComponent(G)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/** A stats tile: a small drawing, the number, and what it counts. The web's StatTile. */
export function StatTile({ art, value, label, tone }: { art: ReactNode; value: string; label: string; tone: string }) {
  const { colors, fonts, mode } = useTheme()
  return (
    <View style={[styles.tile, { backgroundColor: colors.surface }, mode === 'light' && { borderWidth: 1, borderColor: withAlpha(colors.ink, 0.1) }]}>
      <View style={styles.art}>{art}</View>
      <Text style={[styles.value, { color: tone, fontFamily: fonts.display.semibold }]}>{value}</Text>
      <Text style={[styles.label, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}>{label}</Text>
    </View>
  )
}

const BOTTLE = 'M12 7h8v3c0 2.5 8 4 8 11v31a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6V21c0-7 8-8.5 8-11z'
const BOTTLE_TOP = 14
const BOTTLE_BOTTOM = 58

/** Five humps, 80 wide: sliding left by one 32-wide stretch loops seamlessly inside the 32-wide bottle. */
const wave = (y: number) => `M0 ${y} q8 -3 16 0 t16 0 t16 0 t16 0 t16 0 V64 H0z`

/** A glass bottle filled to `fill` (0 to 1): two waves rolling on the water and a few bubbles (still with Reduce Motion). */
export function BottleArt({ fill }: { fill: number }) {
  const { colors } = useTheme()
  const clock = useLoopClock()
  const level = Math.min(1, Math.max(0, fill))
  const y = BOTTLE_BOTTOM - (BOTTLE_BOTTOM - BOTTLE_TOP) * level
  const tone = colors.blueInk
  // The web's `wave` (3 s) and `wave-back` (4.5 s, reversed): each slides one 32-wide hump to the left.
  const front = useAnimatedProps(() => ({ translateX: -32 * phase(clock.value, 3) }))
  const back = useAnimatedProps(() => ({ translateX: -32 * (1 - phase(clock.value, 4.5)) }))
  return (
    <Svg width={32} height={64} viewBox="0 0 32 64" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <ClipPath id="bottle-clip">
          <Path d={BOTTLE} />
        </ClipPath>
        <LinearGradient id="bottle-water" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={mixHex(colors.blue, '#ffffff', 0.25)} />
          <Stop offset="1" stopColor={colors.blueDark} />
        </LinearGradient>
      </Defs>
      <Path d={BOTTLE} fill={tone} opacity={0.1} />
      {level > 0 && (
        <G clipPath="url(#bottle-clip)">
          <AnimatedG animatedProps={back}>
            <Path d={wave(y + 1.5)} fill={colors.blue} opacity={0.45} />
          </AnimatedG>
          <AnimatedG animatedProps={front}>
            <Path d={wave(y)} fill="url(#bottle-water)" />
          </AnimatedG>
          <Bubble clock={clock} cx={12} cy={BOTTLE_BOTTOM - 4} r={1.2} delay={0} />
          <Bubble clock={clock} cx={19} cy={BOTTLE_BOTTOM - 8} r={0.9} delay={1.6} />
        </G>
      )}
      <Rect x={10.5} y={1} width={11} height={6} rx={2} fill={tone} />
      <Path d={BOTTLE} fill="none" stroke={tone} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M8.5 25v20" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" opacity={0.35} />
    </Svg>
  )
}

/** A bubble rising 22 points in 3.5 s, easing in, fading in then out (the web's `bubble`). Still: where it starts, at 0.7. */
function Bubble({ clock, cx, cy, r, delay }: { clock: SharedValue<number>; cx: number; cy: number; r: number; delay: number }) {
  const props = useAnimatedProps(() => {
    if (clock.value === 0) return { cy, opacity: 0.7 }
    const p = phase(clock.value, 3.5, delay)
    return { cy: cy - 22 * p * p, opacity: p < 0.2 ? (p / 0.2) * 0.7 : 0.7 * (1 - (p - 0.2) / 0.8) }
  })
  return <AnimatedCircle cx={cx} r={r} fill="#ffffff" animatedProps={props} />
}

const BOOK_WIDTHS = [11, 9, 12, 10, 13, 9, 11, 12]
const BOOK_HEIGHTS = [36, 31, 39, 33, 38, 30, 35, 38]
/** The shelf is wood whatever the world, so the books carry the colour. */
const WOOD = '#8a5a2a'
/** The shelf's top edge: the tallest book still clears the top of the drawing. */
const SHELF = 56
/** Dust gathers with the books: two specks a book, two on an empty shelf. */
const DUST_PER_BOOK = 2

/** Specks of dust drifting in the light: fixed spots and paces (no randomness), the web's DUST. */
const DUST = Array.from({ length: 8 * DUST_PER_BOOK }, (_, i) => ({
  x: 10 + ((i * 37) % 100),
  y: 8 + ((i * 23) % 42),
  r: 0.5 + (i % 3) * 0.3,
  opacity: 0.35 + ((i * 7) % 5) / 12,
  duration: 8 + ((i * 5) % 6),
  delay: (i * 1.7) % 9,
  dx: ((i * 11) % 9) - 4,
  dy: -4 - ((i * 7) % 8),
}))

/**
 * A wooden shelf with a book for every 100 pages read (eight fit, then "+n"), under a faint beam of warm light that
 * slowly sways, with dust floating in it: the more books, the more dust. Before the first 100 pages, the shelf waits.
 * The web's BookShelfArt.
 */
export function BookShelfArt({ pages }: { pages: number }) {
  const { colors, fonts } = useTheme()
  const clock = useLoopClock()
  const books = [colors.green, colors.orange, colors.blue, colors.yellow, colors.purple, colors.danger, colors.world, colors.blueDark]
  const finished = Math.floor(pages / 100)
  const shown = Math.min(books.length, finished)
  // Each book starts where the ones before it end, 0.6 apart.
  const xAt = (i: number) => 6 + BOOK_WIDTHS.slice(0, i).reduce((sum, w) => sum + w + 0.6, 0)
  // The web's `beam-sway`: -5° to 5° and back in 9 s, easing, around the beam's top (85, 0).
  const beam = useAnimatedProps(() => ({ rotation: -5 * Math.cos((2 * Math.PI * clock.value) / 9) }))

  return (
    <Svg width="100%" height={64} viewBox="0 0 120 64" preserveAspectRatio="xMinYMax meet" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id="shelf-beam" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.dust} stopOpacity={0.14} />
          <Stop offset="1" stopColor={colors.dust} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <AnimatedG originX={85} originY={0} animatedProps={beam}>
        <Path d={`M72 0H98L64 ${SHELF}H26Z`} fill="url(#shelf-beam)" />
      </AnimatedG>

      <Rect x={0} y={SHELF} width={120} height={4} rx={1.5} fill={WOOD} />
      <Rect x={0} y={SHELF + 4} width={120} height={2} fill="#000000" opacity={0.25} />

      {Array.from({ length: shown }, (_, i) => {
        const x = xAt(i)
        const w = BOOK_WIDTHS[i]
        const h = BOOK_HEIGHTS[i]
        return (
          <G key={i}>
            <Rect x={x} y={SHELF - h} width={w} height={h} rx={1.5} fill={books[i]} />
            <Rect x={x} y={SHELF - h} width={2} height={h} fill="#000000" opacity={0.15} />
            <Path d={`M${x} ${SHELF - h + 4}h${w}M${x} ${SHELF - 4}h${w}`} stroke="#000000" strokeWidth={1.2} opacity={0.22} />
            <Rect x={x + w / 2 - 1.2} y={SHELF - h + 8} width={2.4} height={h * 0.3} rx={1} fill="#ffffff" opacity={0.5} />
          </G>
        )
      })}

      {shown === 0 && (
        <SvgText x={60} y={SHELF - 14} textAnchor="middle" fontFamily={fonts.quote} fontStyle="italic" fontSize={12} fill={colors.inkMuted}>
          first book at 100
        </SvgText>
      )}
      {finished > shown && (
        <SvgText x={117} y={10} textAnchor="end" fontSize={9} fontFamily={fonts.rounded.bold} fill={colors.worldInk}>
          {`+${finished - shown}`}
        </SvgText>
      )}

      {DUST.slice(0, Math.max(1, shown) * DUST_PER_BOOK).map((speck, i) => (
        <Speck key={i} clock={clock} speck={speck} color={colors.dust} />
      ))}
    </Svg>
  )
}

/** One speck drifting by (dx, dy) and fading in and out, at its own pace (the web's `dust`). Still: in place, at its opacity. */
function Speck({ clock, speck, color }: { clock: SharedValue<number>; speck: (typeof DUST)[number]; color: string }) {
  const props = useAnimatedProps(() => {
    if (clock.value === 0) return { cx: speck.x, cy: speck.y, opacity: speck.opacity }
    const p = phase(clock.value, speck.duration, speck.delay)
    return { cx: speck.x + speck.dx * p, cy: speck.y + speck.dy * p, opacity: fadeInOut(p, speck.opacity, 0.8) }
  })
  return <AnimatedCircle r={speck.r} fill={color} animatedProps={props} />
}

const styles = StyleSheet.create({
  tile: { flex: 1, gap: 8, borderRadius: 20, padding: 16 },
  art: { height: 64, flexDirection: 'row', alignItems: 'flex-end' },
  value: { fontSize: 24, lineHeight: 26, letterSpacing: 0.6 },
  label: { fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' },
})
