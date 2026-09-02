import * as Radix from '@radix-ui/react-dropdown-menu'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * Styled wrapper around Radix DropdownMenu. Radix handles the parts that are
 * easy to get wrong on touch devices: pointer vs. mouse events, focus return,
 * collision-aware placement and typeahead.
 */

export const DropdownMenu = Radix.Root
export const DropdownMenuTrigger = Radix.Trigger

export function DropdownMenuContent({
  className,
  align = 'end',
  sideOffset = 8,
  children,
  ...rest
}: ComponentProps<typeof Radix.Content>) {
  return (
    <Radix.Portal>
      <Radix.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          'z-50 min-w-52 overflow-hidden rounded-card border border-line',
          'bg-surface p-1 shadow-raise',
          'data-[state=open]:animate-pop-in',
          className,
        )}
        {...rest}
      >
        {children}
      </Radix.Content>
    </Radix.Portal>
  )
}

export function DropdownMenuLabel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('px-3 pt-2 pb-1.5', className)}>{children}</div>
}

export function DropdownMenuSeparator() {
  return <Radix.Separator className="my-1 h-px bg-line" />
}

export function DropdownMenuItem({
  className,
  tone = 'neutral',
  ...rest
}: ComponentProps<typeof Radix.Item> & { tone?: 'neutral' | 'danger' }) {
  return (
    <Radix.Item
      className={cn(
        // h-11 keeps the row a comfortable thumb target.
        'flex h-11 cursor-pointer items-center gap-2.5 rounded-lg px-3 select-none',
        'text-sm outline-none',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        tone === 'danger'
          ? 'text-negative data-[highlighted]:bg-negative/15'
          : 'text-ink data-[highlighted]:bg-surface-2',
        className,
      )}
      {...rest}
    />
  )
}
