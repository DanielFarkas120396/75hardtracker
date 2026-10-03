import { ICONS, type IconName } from './icons'

interface IconProps {
  name: IconName
  size?: number
  /** Announced to screen readers; without one the icon is decorative and hidden. */
  label?: string
  className?: string
}

export function Icon({ name, size = 24, label, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {ICONS[name]}
    </svg>
  )
}
