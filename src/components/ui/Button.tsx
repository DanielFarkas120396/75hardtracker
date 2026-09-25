import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'streak' | 'water' | 'xp' | 'danger' | 'secondary'

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-green border-green-dark text-on-accent',
  streak: 'bg-orange border-orange-dark text-on-accent',
  water: 'bg-blue border-blue-dark text-on-accent',
  xp: 'bg-yellow border-yellow-dark text-on-accent',
  danger: 'bg-danger-dark border-danger-deep text-white',
  secondary: 'bg-surface border-ink/15 text-ink',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

/** Chunky, "press down" button: a solid bottom border that collapses on tap. */
export function Button({ variant = 'primary', className = '', disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={`min-h-touch min-w-touch touch-manipulation rounded-2xl border-b-4 px-6 py-3 font-rounded font-bold motion-safe:transition-transform motion-safe:duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${disabled ? '' : 'active:translate-y-1 active:border-b-0'} ${className}`}
      disabled={disabled}
      {...rest}
    />
  )
}
