import { cn } from '@/lib/cn'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-lg bg-surface-2', className)}
    />
  )
}

/** Placeholder for a list of rows — the shape most pages load into. */
export function SkeletonList({
  rows = 6,
  className,
}: {
  rows?: number
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-16 w-full rounded-card" />
      ))}
    </div>
  )
}
