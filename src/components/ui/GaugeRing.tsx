import { MotionGlobalConfig, useReducedMotionConfig } from 'framer-motion'
import { useId, useLayoutEffect, useRef, useState } from 'react'

interface GaugeRingProps {
  value: number
  max: number
  /** Keeps the last state on screen, and plays the change once released (the "Day complete!" overlay covers it meanwhile). */
  held?: boolean
}

const BARS = 41
const CX = 92
const CY = 92
/** The wave and the fill cross their bars in this time, however many there are. */
const FRONT_MS = 700
const NUMBER_PULSE_MS = 600
const EASE = 'cubic-bezier(.37,0,.63,1)'
const LABEL_STOPS = 33
const CROWN = 'M12 6l4 6l5-4l-2 10H5L3 8l5 4z'

/** Each bar is drawn from r 54 to r 90 but shows r 60–78: the dash grows both ways when the wave passes. */
const REST = { strokeDasharray: '18 100', strokeDashoffset: '-6', strokeWidth: '3' }
const PEAK = {
  up: { strokeDasharray: '26 100', strokeDashoffset: '-3', strokeWidth: '4.1' },
  won: { strokeDasharray: '30 100', strokeDashoffset: '-2', strokeWidth: '4.6' },
  down: { strokeDasharray: '21.5 100', strokeDashoffset: '-4.5', strokeWidth: '3.5' },
}
const UNLIT = 'var(--color-ink-muted)'
const UNLIT_OPACITY = 0.25

const point = (r: number, deg: number) => [CX + r * Math.cos((deg * Math.PI) / 180), CY + r * Math.sin((deg * Math.PI) / 180)]
const GEOMETRY = Array.from({ length: BARS }, (_, i) => {
  const f = i / (BARS - 1)
  const deg = 150 + f * 240
  const [x1, y1] = point(54, deg)
  const [x2, y2] = point(90, deg)
  return { x1, y1, x2, y2, color: `color-mix(in srgb, var(--color-world), var(--color-yellow) ${Math.round(f * 100)}%)` }
})

const sine = (k: number) => 0.5 - 0.5 * Math.cos(Math.PI * k)
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const litBars = (value: number, max: number) => (max > 0 ? Math.round(clamp01(value / max) * BARS) : 0)
/** Never full before the day is won: only 5/5 earns the whole crown. */
const crownFill = (p: number) => (p >= 1 ? 1 : p * 0.7)

/**
 * The day's tasks as an arch of bars in the world's colours, with a crown in its gap.
 * Every change sends one wave through the bars, the label and the crown together; 5/5 ends
 * it with a crown that pops and sparkles. Reduce motion shows the end state at once.
 */
export function GaugeRing({ value, max, held = false }: GaugeRingProps) {
  const id = useId()
  const reduceMotion = useReducedMotionConfig() ?? false
  // The first wave counts up from 0, unless nothing animates.
  const [count, setCount] = useState(() => (reduceMotion || MotionGlobalConfig.skipAnimations ? value : 0))
  const svgRef = useRef<SVGSVGElement>(null)
  const numberRef = useRef<SVGTextElement>(null)
  const labelRef = useRef<SVGGElement>(null)
  const crownRef = useRef<SVGGElement>(null)
  const crownStopsRef = useRef<SVGLinearGradientElement>(null)
  const crownOutlineRef = useRef<SVGPathElement>(null)
  const labelStopsRef = useRef<SVGLinearGradientElement>(null)
  const sparklesRef = useRef<SVGGElement>(null)
  /** What is on screen, so a change mid-animation carries on from there. */
  const shown = useRef({ value: 0, p: 0, crown: 0 })

  useLayoutEffect(() => {
    if (held) return
    const svg = svgRef.current!
    const bars = [...svg.querySelectorAll<SVGLineElement>('[data-bar]')]
    const labelStops = [...labelStopsRef.current!.children] as SVGStopElement[]
    const crownStops = [...crownStopsRef.current!.children] as SVGStopElement[]
    const instant = reduceMotion || MotionGlobalConfig.skipAnimations
    const state = shown.current
    const timers: number[] = []
    let frame = 0
    let done = false

    const from = shown.current.value
    const up = value > from
    const won = up && value >= max && max > 0
    const lit = litBars(value, max)
    const wasLit = litBars(from, max)
    const top = Math.max(lit, wasLit)
    const fromP = shown.current.p
    const toP = max > 0 ? clamp01(value / max) : 0
    const fromCrown = shown.current.crown
    const toCrown = crownFill(Math.min(toP, 0.999))
    const sweepStrength = won ? 0.9 : up ? 0.8 : 0.4

    const paint = (p: number, crown: number, sweep: number | null) => {
      shown.current.p = p
      shown.current.crown = crown
      const soft = 0.06
      const crownOffsets = [0, Math.max(0, crown - soft), Math.min(1, crown + soft), 1]
      crownStops.forEach((stop, i) => {
        stop.setAttribute('offset', String(crownOffsets[i]))
        stop.style.stopOpacity = crown > 0 && i < 2 ? '1' : '0'
      })
      crownOutlineRef.current!.style.stroke = `color-mix(in srgb, ${UNLIT}, var(--color-yellow-dark) ${Math.round(crown * 100)}%)`
      labelStops.forEach((stop, j) => {
        const o = j / (LABEL_STOPS - 1)
        const filled = p > 0 ? clamp01((p - o) / 0.08 + 0.5) : 0
        // world-ink deepened toward the text colour: every stop reads at least as well as world-ink.
        let color = `color-mix(in srgb, ${UNLIT}, color-mix(in srgb, var(--color-world-ink), var(--color-ink) ${Math.round(o * 35)}%) ${Math.round(filled * 100)}%)`
        if (sweep !== null) {
          const band = Math.max(0, 1 - Math.abs(o - sweep) / 0.16)
          const glow = band * band * sweepStrength
          if (glow > 0.01) color = `color-mix(in srgb, ${color}, white ${Math.round(glow * 100)}%)`
        }
        stop.style.stopColor = color
      })
    }

    const setBar = (bar: SVGLineElement, on: boolean, delay: number) => {
      bar.style.transitionDelay = `${delay}ms`
      bar.style.stroke = on ? bar.dataset.color! : UNLIT
      bar.style.strokeOpacity = String(on ? 1 : UNLIT_OPACITY)
      bar.toggleAttribute('data-lit', on)
    }

    bars.forEach((bar) => bar.getAnimations?.().forEach((a) => a.cancel()))
    shown.current.value = value

    if (instant || value === from) {
      bars.forEach((bar, i) => setBar(bar, i < lit, 0))
      paint(toP, toP >= 1 ? 1 : toCrown, null)
      setCount(value)
      return
    }

    // The bars: one front lights or dims them, and the wave rides along it.
    const waveMs = won ? 1100 : up ? 950 : 850
    const step = top > 1 ? FRONT_MS / (top - 1) : 0
    const peak = won ? PEAK.won : up ? PEAK.up : PEAK.down
    bars.forEach((bar, i) => {
      const delay = (up ? i : top - 1 - i) * step
      setBar(bar, i < lit, delay + waveMs * 0.15)
      if (i < top) bar.animate?.([REST, { ...peak, offset: 0.5 }, REST], { duration: waveMs, delay, easing: EASE })
    })
    // Short of 5/5, the grey bars ahead absorb the wave, more and more softly, to the end of the arch.
    if (up && !won && lit > 0) {
      const tail = BARS - lit
      const pace = step || FRONT_MS / BARS
      for (let j = 0; j < tail; j++) {
        const a = Math.pow(1 - (j + 1) / (tail + 1), 1.4)
        const swell = {
          strokeDasharray: `${18 + 3.5 * a} 100`,
          strokeDashoffset: String(-6 + 1.2 * a),
          strokeWidth: String(3 + 0.8 * a),
          strokeOpacity: String(UNLIT_OPACITY + 0.2 * a),
          offset: 0.5,
        }
        const rest = { ...REST, strokeOpacity: String(UNLIT_OPACITY) }
        bars[lit + j].animate?.([rest, swell, rest], {
          duration: waveMs * (1 - (0.25 * (j + 1)) / tail),
          delay: (lit - 1) * pace + (j + 1) * pace * (1 + (0.6 * j) / tail),
          easing: EASE,
        })
      }
    }

    // The number: one tick per task, with the wave.
    const steps = Math.abs(value - from)
    const gap = steps > 1 ? Math.min(NUMBER_PULSE_MS * 0.75, FRONT_MS / (steps - 1)) : 0
    for (let k = 1; k <= steps; k++) {
      const next = from + (up ? k : -k)
      const last = k === steps
      timers.push(
        window.setTimeout(() => {
          setCount(next)
          numberRef.current?.animate?.(
            up
              ? [
                  { transform: 'translateY(0) scale(1)' },
                  { transform: `translateY(-2px) scale(${last && won ? 1.2 : 1.12})`, offset: 0.4 },
                  { transform: 'translateY(0) scale(1)' },
                ]
              : [
                  { transform: 'translateY(0) scale(1)', opacity: 1 },
                  { transform: 'translateY(2px) scale(.94)', opacity: 0.65, offset: 0.4 },
                  { transform: 'translateY(0) scale(1)', opacity: 1 },
                ],
            { duration: NUMBER_PULSE_MS, easing: EASE },
          )
        }, (k - 1) * gap),
      )
    }

    // The label and the crown fill with the front; a white glow sweeps through the label the same way.
    const start = performance.now()
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / FRONT_MS)
      const e = sine(k)
      paint(fromP + (toP - fromP) * e, fromCrown + (toCrown - fromCrown) * e, up ? -0.2 + 1.4 * e : 1.2 - 1.4 * e)
      if (k < 1) frame = requestAnimationFrame(tick)
      else {
        done = true
        paint(toP, toCrown, null)
        if (won) celebrate()
      }
    }
    frame = requestAnimationFrame(tick)

    const celebrate = () => {
      const fillStart = performance.now()
      const filled = shown.current.crown
      const fill = (now: number) => {
        const k = Math.min(1, (now - fillStart) / 260)
        paint(toP, filled + (1 - filled) * sine(k), null)
        if (k < 1) frame = requestAnimationFrame(fill)
      }
      frame = requestAnimationFrame(fill)
      crownRef.current?.animate?.(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.4)', offset: 0.35 }, { transform: 'scale(.95)', offset: 0.7 }, { transform: 'scale(1)' }],
        { duration: 800, easing: EASE },
      )
      labelRef.current?.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.08)', offset: 0.4 }, { transform: 'scale(1)' }], {
        duration: 800,
        easing: EASE,
      })
      sparkle(sparklesRef.current!)
    }

    return () => {
      timers.forEach(clearTimeout)
      cancelAnimationFrame(frame)
      // Cut short (Strict Mode's second run, or a quick second change): the next run starts from the same place.
      if (!done) state.value = from
    }
  }, [value, max, held, reduceMotion])

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`${value} of ${max} tasks done`}
      viewBox="0 0 184 152"
      className="block w-full max-w-[184px] overflow-visible"
    >
      <defs>
        <linearGradient id={`${id}label`} ref={labelStopsRef}>
          {Array.from({ length: LABEL_STOPS }, (_, j) => (
            <stop key={j} offset={j / (LABEL_STOPS - 1)} stopColor={UNLIT} />
          ))}
        </linearGradient>
        <linearGradient id={`${id}crown`} ref={crownStopsRef}>
          {[0, 1, 2, 3].map((j) => (
            <stop key={j} offset={j / 3} stopColor="var(--color-yellow)" stopOpacity={0} />
          ))}
        </linearGradient>
      </defs>
      {GEOMETRY.map((bar, i) => (
        <line
          key={i}
          data-bar=""
          data-color={bar.color}
          x1={bar.x1}
          y1={bar.y1}
          x2={bar.x2}
          y2={bar.y2}
          strokeLinecap="round"
          style={{
            ...REST,
            stroke: UNLIT,
            strokeOpacity: UNLIT_OPACITY,
            transition: `stroke .6s ${EASE}, stroke-opacity .6s ${EASE}`,
          }}
        />
      ))}
      <g ref={labelRef} style={{ transformBox: 'fill-box', transformOrigin: '50% 60%' }}>
        <text x={CX} y={70} textAnchor="middle" fill={`url(#${id}label)`} className="font-rounded" fontSize={11} fontWeight={800}>
          today's tasks
        </text>
      </g>
      <text
        ref={numberRef}
        x={CX + 3}
        y={108}
        textAnchor="end"
        className="font-display"
        fontSize={46}
        style={{ fill: 'var(--color-ink)', transformBox: 'fill-box', transformOrigin: '50% 60%' }}
      >
        {count}
      </text>
      <text x={CX + 5} y={108} className="font-display" fontSize={18} style={{ fill: UNLIT }}>
        /{max}
      </text>
      <g transform={`translate(${CX - 12} 112)`}>
        <g ref={crownRef} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
          <path d={CROWN} fill={`url(#${id}crown)`} />
          <path ref={crownOutlineRef} d={CROWN} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" style={{ stroke: UNLIT }} />
        </g>
      </g>
      <g ref={sparklesRef} aria-hidden="true" />
    </svg>
  )
}

/** Twelve four-point stars in gold and the world's colour, bursting up from the crown. */
function sparkle(layer: SVGGElement) {
  const cx = CX
  const cy = 124
  for (let k = 0; k < 12; k++) {
    const deg = -90 + (k - 5.5) * 20 + (Math.random() * 8 - 4)
    const r = 18 + Math.random() * 16
    const size = k % 3 === 0 ? 4.5 : 2.6
    const star = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    star.setAttribute('d', `M0 ${-size}Q0 0 ${size} 0Q0 0 0 ${size}Q0 0 ${-size} 0Q0 0 0 ${-size}z`)
    star.style.fill = k % 2 === 0 ? 'var(--color-yellow)' : 'var(--color-world)'
    star.style.transform = `translate(${cx}px, ${cy}px) scale(0)`
    layer.appendChild(star)
    const dx = r * Math.cos((deg * Math.PI) / 180)
    const dy = r * Math.sin((deg * Math.PI) / 180)
    const flight = star.animate?.(
      [
        { transform: `translate(${cx}px, ${cy}px) scale(0) rotate(0deg)`, opacity: 1 },
        { transform: `translate(${cx + dx * 0.7}px, ${cy + dy * 0.7}px) scale(1.2) rotate(45deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${cx + dx}px, ${cy + dy}px) scale(0) rotate(90deg)`, opacity: 0 },
      ],
      { duration: 900 + Math.random() * 300, easing: 'cubic-bezier(.22,1,.36,1)', delay: k * 18, fill: 'forwards' },
    )
    if (flight) flight.onfinish = () => star.remove()
    else star.remove()
  }
}
