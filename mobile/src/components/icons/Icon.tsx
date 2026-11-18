import Svg from 'react-native-svg'
import { ICONS, type IconName } from './icons'

interface IconProps {
  name: IconName
  /** The icon's colour: its strokes, and its soft fills at 18%. */
  color: string
  size?: number
  /** Line weight on the 24-point grid; thinner suits the big drawings. */
  strokeWidth?: number
  /** Said by VoiceOver; without one the icon is decoration and hidden from it. */
  label?: string
}

/** One of the app's icons. The web's Icon (src/components/icons/Icon.tsx). */
export function Icon({ name, color, size = 24, strokeWidth = 2, label }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      color={color}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={label !== undefined}
      accessibilityRole={label === undefined ? undefined : 'image'}
      accessibilityLabel={label}
      accessibilityElementsHidden={label === undefined}
      importantForAccessibility={label === undefined ? 'no-hide-descendants' : 'yes'}
    >
      {ICONS[name]}
    </Svg>
  )
}
