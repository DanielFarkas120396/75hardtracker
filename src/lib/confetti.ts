import confetti from 'canvas-confetti'

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Fires a celebratory confetti burst, skipped entirely when the user prefers reduced motion. */
export function celebrate(): void {
  if (prefersReducedMotion()) return

  confetti({
    particleCount: 140,
    spread: 90,
    startVelocity: 45,
    origin: { y: 0.6 },
    colors: ['#3dd16f', '#ff8a3d', '#38b6ff', '#ffc93d'],
  })
}
