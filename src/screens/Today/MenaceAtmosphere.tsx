import { AnimatePresence, motion, useReducedMotionConfig } from 'framer-motion'
import type { MenaceLevel } from '../../logic/menace'

const DARK_VIGNETTE = 'radial-gradient(ellipse at 50% 40%, transparent 50%, rgba(40, 14, 10, 0.26) 100%)'
const RED_GLOW = 'radial-gradient(ellipse at 50% 40%, transparent 45%, rgba(190, 24, 34, 0.4) 100%)'
/** Keeps the top of the screen clear: the header's text sits on the canvas there. */
const TOP_CLEAR_MASK = 'linear-gradient(to bottom, transparent 0, transparent 160px, black 260px)'

interface MenaceAtmosphereProps {
  level: MenaceLevel
  /** Goes up by one per lunge: each flashes the screen red once. */
  flashes: number
}

/**
 * The Today screen's mood lighting, behind the content: a dark vignette when
 * time is tight, a slow red pulse (2.8 s, far below any flashing threshold)
 * when it's out. Cards sit on top, so no text is ever over it.
 */
export function MenaceAtmosphere({ level, flashes }: MenaceAtmosphereProps) {
  const reduceMotion = useReducedMotionConfig() ?? false

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 mx-auto max-w-md"
      style={{ maskImage: TOP_CLEAR_MASK, WebkitMaskImage: TOP_CLEAR_MASK }}
    >
      <motion.div
        className="absolute inset-0"
        style={{ background: DARK_VIGNETTE }}
        initial={false}
        animate={{ opacity: level === 'tapping' ? 1 : 0 }}
        transition={{ duration: 1 }}
      />
      <motion.div className="absolute inset-0" initial={false} animate={{ opacity: level === 'hunting' ? 1 : 0 }} transition={{ duration: 1 }}>
        <motion.div
          className="absolute inset-0"
          style={{ background: RED_GLOW }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: [0.78, 1, 0.78] }}
          transition={reduceMotion ? { duration: 0 } : { duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
      <AnimatePresence>
        {flashes > 0 && !reduceMotion && (
          <motion.div
            key={flashes}
            className="absolute inset-0"
            style={{ background: RED_GLOW }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
