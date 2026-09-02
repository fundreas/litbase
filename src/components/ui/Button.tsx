import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-ink hover:brightness-110 active:brightness-95 shadow-raise',
  secondary:
    'bg-surface-2 text-ink hover:bg-line active:bg-line/80 border border-line',
  ghost: 'text-muted hover:bg-surface-2 hover:text-ink active:bg-line',
  danger:
    'bg-negative/15 text-negative hover:bg-negative/25 border border-negative/30',
}

// Every size clears the 44px touch target Apple and Google both recommend.
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  isLoading?: boolean
  fullWidth?: boolean
  leadingIcon?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  leadingIcon,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled === true || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-semibold select-none',
        'transition-[filter,background-color,opacity] duration-150',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {isLoading ? <Spinner size={16} /> : leadingIcon}
      {children}
    </button>
  )
}
