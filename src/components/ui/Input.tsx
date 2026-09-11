import { useId, type InputHTMLAttributes, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: ReactNode
  trailing?: ReactNode
  /**
   * Keep the label for screen readers but take it off the screen.
   *
   * For the field that *is* the page — a search box at the top of a page of
   * results, where a caption over it says what the placeholder already says
   * and pushes the results down a line. Still required, never optional: a
   * field with no accessible name is a field nobody can fill in blind.
   */
  hideLabel?: boolean
}

export function Input({
  label,
  error,
  hint,
  trailing,
  hideLabel = false,
  className,
  id,
  ...rest
}: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const describedBy = error !== undefined ? `${inputId}-error` : undefined

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className={cn(
          'text-xs font-medium tracking-wide text-muted uppercase',
          hideLabel && 'sr-only',
        )}
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          aria-invalid={error !== undefined || undefined}
          aria-describedby={describedBy}
          className={cn(
            // 16px font size keeps iOS Safari from zooming in on focus.
            'h-12 w-full rounded-xl border bg-surface px-3.5 text-base text-ink',
            'placeholder:text-faint',
            'transition-colors duration-150',
            error === undefined
              ? 'border-line focus:border-accent'
              : 'border-negative',
            trailing !== undefined && 'pr-12',
            className,
          )}
          {...rest}
        />
        {trailing !== undefined && (
          <div className="absolute inset-y-0 right-1 flex items-center">
            {trailing}
          </div>
        )}
      </div>
      {error !== undefined ? (
        <p id={describedBy} className="text-xs text-negative">
          {error}
        </p>
      ) : (
        hint !== undefined && <p className="text-xs text-faint">{hint}</p>
      )}
    </div>
  )
}
