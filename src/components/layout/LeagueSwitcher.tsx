import { Check, ChevronsUpDown } from 'lucide-react'

import { Avatar } from '@/components/ui/Avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { useActiveLeague } from '@/league/useActiveLeague'
import { money, placement } from '@/lib/format'

/**
 * League picker in the header. Renders as a plain label when the user only has
 * one league — a dropdown with a single option is just noise.
 */
export function LeagueSwitcher() {
  const { league, leagues, switchLeague } = useActiveLeague()

  if (leagues.length <= 1) {
    return (
      <div className="flex min-w-0 items-center gap-2 px-1">
        <Avatar src={league.image} name={league.name} size={24} square />
        <span className="truncate text-sm font-semibold text-ink">
          {league.name}
        </span>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-11 min-w-0 items-center gap-2 rounded-xl px-2 text-left transition-colors hover:bg-surface-2 data-[state=open]:bg-surface-2"
        aria-label="Liga wechseln"
      >
        <Avatar src={league.image} name={league.name} size={24} square />
        <span className="truncate text-sm font-semibold text-ink">
          {league.name}
        </span>
        <ChevronsUpDown size={16} className="shrink-0 text-faint" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="center" className="min-w-64">
        <DropdownMenuLabel>
          <span className="text-[0.6875rem] tracking-wide text-faint uppercase">
            Liga wechseln
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {leagues.map((candidate) => {
          const isActive = candidate.id === league.id
          return (
            <DropdownMenuItem
              key={candidate.id}
              onSelect={() => {
                switchLeague(candidate.id)
              }}
              className="h-14"
            >
              <Avatar
                src={candidate.image}
                name={candidate.name}
                size={28}
                square
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{candidate.name}</p>
                <p className="nums truncate text-xs text-muted">
                  {placement(candidate.placement)} · {money(candidate.budget)}
                </p>
              </div>
              {isActive && <Check size={16} className="shrink-0 text-accent" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
