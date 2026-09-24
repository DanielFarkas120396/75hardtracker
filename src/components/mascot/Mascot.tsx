import { motion } from 'framer-motion'

export type MascotState = 'idle' | 'cheering' | 'sad'

interface MascotProps {
  state: MascotState
  size?: number
}

/**
 * An original, hand-drawn blob-shaped mascot (not a Duolingo lookalike):
 * a rounded green body with two arms and a face that changes per state.
 */
export function Mascot({ state, size = 120 }: MascotProps) {
  return (
    <motion.svg
      key={state}
      viewBox="0 0 120 120"
      width={size}
      height={size}
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      role="img"
      aria-label={`mascot ${state}`}
    >
      {/* body */}
      <ellipse cx="60" cy="68" rx="38" ry="34" fill="#3dd16f" />
      <ellipse cx="60" cy="40" rx="30" ry="28" fill="#3dd16f" />

      {/* arms */}
      {state === 'cheering' ? (
        <>
          <rect x="12" y="30" width="12" height="30" rx="6" fill="#2ba857" transform="rotate(-25 18 45)" />
          <rect x="96" y="30" width="12" height="30" rx="6" fill="#2ba857" transform="rotate(25 102 45)" />
        </>
      ) : (
        <>
          <rect x="14" y="55" width="12" height="26" rx="6" fill="#2ba857" transform="rotate(-8 20 68)" />
          <rect x="94" y="55" width="12" height="26" rx="6" fill="#2ba857" transform="rotate(8 100 68)" />
        </>
      )}

      {/* face */}
      {state === 'sad' ? (
        <>
          <circle cx="48" cy="38" r="5" fill="#14181a" />
          <circle cx="72" cy="38" r="5" fill="#14181a" />
          <path d="M46 30 L54 34" stroke="#14181a" strokeWidth="3" strokeLinecap="round" />
          <path d="M74 30 L66 34" stroke="#14181a" strokeWidth="3" strokeLinecap="round" />
          <path d="M46 56 Q60 46 74 56" stroke="#14181a" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M78 44 q4 6 0 12" stroke="#38b6ff" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : state === 'cheering' ? (
        <>
          <path d="M42 36 Q48 30 54 36" stroke="#14181a" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M66 36 Q72 30 78 36" stroke="#14181a" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M45 48 Q60 62 75 48" stroke="#14181a" strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="48" cy="38" r="5" fill="#14181a" />
          <circle cx="72" cy="38" r="5" fill="#14181a" />
          <path d="M48 52 Q60 58 72 52" stroke="#14181a" strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      )}
    </motion.svg>
  )
}
