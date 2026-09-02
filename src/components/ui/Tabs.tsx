import * as Radix from '@radix-ui/react-tabs'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/cn'

/**
 * Styled Radix Tabs. Radix supplies the parts that are tedious to get right:
 * arrow-key navigation, `role="tablist"`, and the `aria-selected` wiring.
 */

export const Tabs = Radix.Root

export function TabsList({
  className,
  ...rest
}: ComponentProps<typeof Radix.List>) {
  return (
    <Radix.List
      className={cn(
        'flex w-full gap-1 rounded-xl border border-line bg-surface p-1',
        className,
      )}
      {...rest}
    />
  )
}

export function TabsTrigger({
  className,
  ...rest
}: ComponentProps<typeof Radix.Trigger>) {
  return (
    <Radix.Trigger
      className={cn(
        // Equal-width segments so the control reads as one unit on a phone.
        'flex h-10 flex-1 items-center justify-center rounded-lg px-2',
        'text-sm font-medium whitespace-nowrap transition-colors',
        'text-muted hover:text-ink',
        'data-[state=active]:bg-accent data-[state=active]:text-accent-ink',
        'data-[state=active]:font-semibold',
        className,
      )}
      {...rest}
    />
  )
}

export function TabsContent({
  className,
  ...rest
}: ComponentProps<typeof Radix.Content>) {
  return (
    <Radix.Content
      className={cn('mt-4 focus-visible:outline-none', className)}
      {...rest}
    />
  )
}
