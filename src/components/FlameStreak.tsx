import { useReducedMotionConfig } from 'framer-motion'
import type { AnimationItem } from 'lottie-web/build/player/lottie_light'
import { useEffect, useRef, useState } from 'react'

interface FlameStreakProps {
  streak: number
}

/**
 * The frame a still flame holds (reduce motion, or no streak): the middle of
 * fire.json's 26-frame loop (24 fps, `op: 26`), where its marker sits and the
 * flame stands at full height. Re-check it if the animation is re-exported.
 */
const STILL_FRAME = 13

/** The player and the flame load together on first use, so neither weighs on the app's first paint. */
const loadFlame = () =>
  Promise.all([import('lottie-web/build/player/lottie_light'), import('../assets/animations/fire.json')])

/**
 * Streak flame indicator: an animated fire (Noto's 🔥) that grows slightly as
 * the streak increases. It burns while the streak is alive and goes out (still
 * and grey) at 0; with reduce motion on it holds still. Until the player has
 * loaded, the plain emoji stands in at the same size.
 */
export function FlameStreak({ streak }: FlameStreakProps) {
  const reduceMotion = useReducedMotionConfig() ?? false
  const box = useRef<HTMLSpanElement>(null)
  const [flame, setFlame] = useState<AnimationItem>()
  const lit = streak > 0
  const scale = Math.min(1.5, 1 + streak * 0.02)

  useEffect(() => {
    let cancelled = false
    let item: AnimationItem | undefined
    void loadFlame().then(([{ default: lottie }, { default: animationData }]) => {
      if (cancelled || !box.current) return
      item = lottie.loadAnimation({ container: box.current, renderer: 'svg', loop: true, autoplay: false, animationData })
      setFlame(item)
    })
    return () => {
      cancelled = true
      item?.destroy()
    }
  }, [])

  useEffect(() => {
    if (!flame) return
    if (lit && !reduceMotion) flame.play()
    else flame.goToAndStop(STILL_FRAME, true)
  }, [flame, lit, reduceMotion])

  return (
    <div
      role="img"
      aria-label={`Streak: ${streak} ${streak === 1 ? 'day' : 'days'}`}
      className="flex items-center gap-1"
      style={{ transform: `scale(${scale})` }}
    >
      <span aria-hidden="true" className={`relative h-7 w-5 ${lit ? '' : 'opacity-50 grayscale'}`}>
        <span ref={box} className="absolute inset-0" />
        {!flame && <span className="absolute inset-0 flex items-center justify-center text-2xl leading-none">🔥</span>}
      </span>
      <span aria-hidden="true" className={`font-rounded text-lg font-extrabold ${lit ? 'text-orange-ink' : 'text-ink-muted'}`}>
        {streak}
      </span>
    </div>
  )
}
