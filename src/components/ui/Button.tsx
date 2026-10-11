import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'streak' | 'water' | 'danger' | 'secondary'

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-world text-on-world',
  streak: 'bg-orange text-on-accent',
  water: 'bg-blue text-on-accent',
  danger: 'bg-danger-dark text-white',
  secondary: 'bg-ink/8 text-ink',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

/** A flat pill that sinks slightly on tap. */
export function Button({ variant = 'primary', className = '', disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={`min-h-touch min-w-touch touch-manipulation rounded-full px-6 py-3 font-rounded font-semibold motion-safe:transition-transform motion-safe:duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink-muted ${VARIANT_CLASSES[variant]} ${disabled ? '' : 'active:scale-[0.97]'} ${className}`}
      disabled={disabled}
      {...rest}
    />
  )
}
