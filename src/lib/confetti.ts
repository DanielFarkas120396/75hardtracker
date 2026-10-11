import confetti from 'canvas-confetti'

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Shades of the world the app wears, lighter and darker than its fill, so the burst shows on a world-coloured field. */
const CONFETTI_TOKENS = ['--color-world-ink', '--color-world-edge', '--color-world-soft', '--color-on-world', '--color-ink']

function worldColors(): string[] | undefined {
  const style = getComputedStyle(document.documentElement)
  const colors = CONFETTI_TOKENS.map((token) => style.getPropertyValue(token).trim()).filter(Boolean)
  return colors.length > 0 ? colors : undefined
}

/** Fires a celebratory confetti burst in the world's colours, skipped entirely when the user prefers reduced motion. */
export function celebrate(): void {
  if (prefersReducedMotion()) return

  confetti({
    particleCount: 140,
    spread: 90,
    startVelocity: 45,
    origin: { y: 0.6 },
    colors: worldColors(),
  })
}
