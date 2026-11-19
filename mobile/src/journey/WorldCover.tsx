import { Canvas, ColorMatrix, Group, Image as SkiaImage, Paint, useImage } from '@shopify/react-native-skia'
import { useState } from 'react'
import { Image, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { useTheme } from '../theme/ThemeProvider'
import type { World } from './worlds'

interface WorldCoverProps {
  world: World
  /** The badge in the corner: the score, "Cleared", or when a locked world opens. */
  badge: string
  /** The line under the name. */
  detail: string
  /** A world ahead: greyed out, a little shorter. */
  locked?: boolean
  /** The page's own canvas, which the picture darkens into (a chapter wears its world's canvas). */
  pageCanvas: string
  onLayout?: (event: LayoutChangeEvent) => void
}

/** Greyscale at three quarters of the brightness: the web's `brightness-75 grayscale` on a world ahead. */
const LOCKED = [0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0, 0, 0, 1, 0].map((v, i) =>
  i % 5 < 3 && i < 15 ? v * 0.75 : v,
)

/**
 * A chapter's cover: the world's picture, darkened into the page so its name reads on it, in the world's colour.
 * The web's WorldCover (src/screens/Journey/WorldCover.tsx). Lives inside the world's WorldScope.
 */
export function WorldCover({ world, badge, detail, locked = false, pageCanvas, onLayout }: WorldCoverProps) {
  const { colors, fonts } = useTheme()
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${world.name}, ${badge}`}
      onLayout={onLayout}
      style={[styles.cover, { height: locked ? 80 : 112 }]}
    >
      {locked ? <LockedPicture source={world.cover} /> : <Image source={world.cover} resizeMode="cover" style={StyleSheet.absoluteFill} />}
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="scrim" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={pageCanvas} stopOpacity={1} />
            <Stop offset="0.55" stopColor={pageCanvas} stopOpacity={0.72} />
            <Stop offset="1" stopColor={pageCanvas} stopOpacity={0.3} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#scrim)" />
      </Svg>
      <View style={[styles.badge, { backgroundColor: locked ? colors.surface : colors.world }]}>
        <Text style={[styles.badgeText, { color: locked ? colors.inkMuted : colors.onWorld, fontFamily: fonts.display.semibold }]}>{badge}</Text>
      </View>
      <Text style={[styles.name, { color: locked ? colors.inkMuted : colors.worldInk, fontFamily: fonts.display.semibold }]}>{world.name}</Text>
      <Text style={[styles.detail, { color: colors.ink, fontFamily: fonts.rounded.medium }]}>{detail}</Text>
    </View>
  )
}

/** The picture of a world ahead, grey and dimmed. React Native's images have no greyscale on iOS: Skia draws it. */
function LockedPicture({ source }: { source: number }) {
  const image = useImage(source)
  const [size, setSize] = useState({ width: 0, height: 0 })
  return (
    <Canvas style={StyleSheet.absoluteFill} onLayout={(event) => setSize(event.nativeEvent.layout)}>
      <Group layer={<Paint><ColorMatrix matrix={LOCKED} /></Paint>}>
        {image && <SkiaImage image={image} fit="cover" x={0} y={0} width={size.width} height={size.height} />}
      </Group>
    </Canvas>
  )
}

const styles = StyleSheet.create({
  cover: { justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14 },
  badge: { position: 'absolute', top: 12, right: 12, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  badgeText: { fontSize: 14, letterSpacing: 0.7, textTransform: 'uppercase' },
  name: { fontSize: 24, lineHeight: 26, letterSpacing: 0.6, textTransform: 'uppercase' },
  detail: { marginTop: 4, fontSize: 12 },
})
