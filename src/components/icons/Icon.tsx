import { ICONS, type IconName } from './icons'

interface IconProps {
  name: IconName
  size?: number
  /** Line weight on the 24 px grid; thinner suits the big drawings. */
  strokeWidth?: number
  /** Announced to screen readers; without one the icon is decorative and hidden. */
  label?: string
  className?: string
}

export function Icon({ name, size = 24, strokeWidth = 2, label, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {ICONS[name]}
    </svg>
  )
}
