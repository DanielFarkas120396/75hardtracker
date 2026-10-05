import { motion } from 'framer-motion'

const BURST_COLORS = ['var(--color-world)', 'var(--color-yellow)', 'var(--color-blue)', 'var(--color-orange)']
const BURST_PARTICLES = 8
const BURST_DISTANCE_PX = 28

/** Dots that fly out once from behind a done badge. Position it over the badge's corner. */
export function Burst({ className = '' }: { className?: string }) {
  return (
    <span aria-hidden="true" data-testid="burst" className={`pointer-events-none absolute h-7 w-7 ${className}`}>
      {Array.from({ length: BURST_PARTICLES }, (_, i) => {
        const angle = (i / BURST_PARTICLES) * 2 * Math.PI
        return (
          <motion.span
            key={i}
            className="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: BURST_COLORS[i % BURST_COLORS.length] }}
            initial={{ x: 0, y: 0, opacity: 1 }}
            animate={{ x: Math.cos(angle) * BURST_DISTANCE_PX, y: Math.sin(angle) * BURST_DISTANCE_PX, opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        )
      })}
    </span>
  )
}
