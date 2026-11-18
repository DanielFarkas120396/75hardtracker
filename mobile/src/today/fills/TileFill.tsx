import type { PainterKind } from '@logic/fillKinds'
import { fillOpacity, fillPalette, type FillPalette } from '@logic/fillPalette'
import { WORLD_COLORS } from '@logic/worldColors'
import { Canvas, ColorShader, Fill, Group, ImageShader, Shader, Skia, useImage, type SkRuntimeEffect } from '@shopify/react-native-skia'
import { createContext, useContext, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useDerivedValue, useSharedValue } from 'react-native-reanimated'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useTheme } from '../../theme/ThemeProvider'
import { createFillEngine, type FillEngine, type FillHandle } from './engine'
import { FILLS, type Uniforms } from './shaders'

const effects = new Map<PainterKind, SkRuntimeEffect | null>()

/** A fill's compiled shader, or null when this phone can't make it (its tile keeps the thin bar). */
export function effectFor(kind: PainterKind): SkRuntimeEffect | null {
  if (!effects.has(kind)) {
    let effect: SkRuntimeEffect | null = null
    try {
      effect = Skia.RuntimeEffect.Make(FILLS[kind].sksl)
    } catch (error) {
      // The fills are decoration: without one, its tile keeps the thin bar.
      console.warn(`Tile fill off (${kind}):`, error)
    }
    effects.set(kind, effect)
  }
  return effects.get(kind) ?? null
}

/** The current world and theme, as fill colours. */
export function useFillPalette(): FillPalette {
  const { world, mode } = useTheme()
  return useMemo(() => fillPalette(WORLD_COLORS[world][mode], mode), [world, mode])
}

export const FillEngineContext = createContext<FillEngine | null>(null)

/** The engine the board above provides (null: no fills, the thin bar). */
export const useBoardFills = () => useContext(FillEngineContext)

/** A board's fill engine, in the current colours, still under reduce motion. */
export function useFillEngine(): FillEngine {
  const palette = useFillPalette()
  const reduce = useReduceMotion()
  const [engine] = useState(() => createFillEngine({ supports: (kind) => effectFor(kind) !== null, palette }))
  useEffect(() => engine.setPalette(palette), [engine, palette])
  useEffect(() => engine.setReduceMotion(reduce), [engine, reduce])
  return engine
}

interface TileFillProps {
  kind: PainterKind
  /** 0–1: taskFill. */
  level: number
  /** How finely the status counts up (76 steps of 50 ml for 3.8 L, 10 pages); none for tiles that don't count. */
  steps?: number
  /** The day's photo, for the iris. */
  imageUri?: string
  /** Where the control the fill starts from sits: points from the tile's right edge and from its top. */
  anchor?: { right: number; top: number }
  onShown?: (level: number) => void
  /** The level the fill has settled at, or null while it moves. */
  onSettledAt: (level: number | null) => void
}

/** A tile's fill: a canvas under the tile's content, drawn from the board's engine. The web's TileFill. */
export function TileFill({ kind, level, steps, imageUri, anchor, onShown, onSettledAt }: TileFillProps) {
  const engine = useBoardFills()
  const reduce = useReduceMotion()
  const palette = useFillPalette()
  const effect = effectFor(kind)
  const uniforms = useSharedValue<Uniforms>({})
  const previous = useSharedValue<Uniforms>({})
  const fade = useSharedValue(1)
  const fadeOut = useDerivedValue(() => 1 - fade.value)
  // What the engine draws into: the same three for the tile's whole life.
  const [surface] = useState({ uniforms, previous, fade })
  const image = useImage(kind === 'iris' ? imageUri : undefined)
  const [size, setSize] = useState<{ width: number; height: number }>()
  // Nothing to draw with until the engine has drawn a first frame.
  const [drawn, setDrawn] = useState(false)
  const handleRef = useRef<FillHandle | null>(null)
  const levelRef = useRef(level)
  const reported = useRef<{ shown: number | null; settled: number | null | undefined }>({ shown: null, settled: undefined })

  const report = useEffectEvent(() => {
    const handle = handleRef.current
    if (!handle) return
    if (!drawn) setDrawn(true)
    if (steps && onShown) {
      const shown = Math.round(handle.shown() * steps) / steps
      if (shown !== reported.current.shown) {
        reported.current.shown = shown
        onShown(shown)
      }
    }
    const settled = handle.settledAt()
    if (settled !== reported.current.settled) {
      reported.current.settled = settled
      onSettledAt(settled)
    }
  })

  useLayoutEffect(() => {
    levelRef.current = level
  })

  // Made once per engine and kind, straight at the day's level: only changes animate.
  useLayoutEffect(() => {
    if (!engine) return
    const handle = engine.add(kind, surface, () => report())
    handleRef.current = handle
    handle.setLevel(levelRef.current, 'instant')
    return () => {
      handle.remove()
      handleRef.current = null
    }
  }, [engine, kind, surface])

  useLayoutEffect(() => {
    handleRef.current?.setLevel(level, reduce ? 'fade' : 'animate')
  }, [level, reduce])

  useLayoutEffect(() => {
    if (size) handleRef.current?.setSize(size.width, size.height)
  }, [size, engine])

  const right = anchor?.right
  const top = anchor?.top
  useLayoutEffect(() => {
    if (right !== undefined && top !== undefined) handleRef.current?.setAnchor(right, top)
  }, [right, top, engine])

  // The iris stays shut until the photo is decoded.
  useEffect(() => {
    handleRef.current?.setHasImage(image !== null)
  }, [image, engine])

  const photo = kind !== 'iris' ? null : image && size ? <ImageShader image={image} fit="cover" rect={{ x: 0, y: 0, ...size }} /> : <ColorShader color="transparent" />

  return (
    <View
      pointerEvents="none"
      testID={`fill-${kind}`}
      style={[StyleSheet.absoluteFill, { opacity: fillOpacity(kind, palette) }]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout
        if (width !== size?.width || height !== size.height) setSize({ width, height })
      }}
    >
      {effect && drawn && (
        <Canvas style={StyleSheet.absoluteFill}>
          {/* Reduce motion: the last frame fades out under the new one. */}
          {reduce && (
            <Group opacity={fadeOut}>
              <Fill>
                <Shader source={effect} uniforms={previous}>
                  {photo}
                </Shader>
              </Fill>
            </Group>
          )}
          <Group opacity={fade}>
            <Fill>
              <Shader source={effect} uniforms={uniforms}>
                {photo}
              </Shader>
            </Fill>
          </Group>
        </Canvas>
      )}
    </View>
  )
}
