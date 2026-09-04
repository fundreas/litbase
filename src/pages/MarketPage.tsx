import { Store } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useMarket } from '@/api/hooks/useMarket'
import { useMarketValueChanges } from '@/api/hooks/useMarketValueChanges'
import { useCurrentMatchday } from '@/api/hooks/useMatchday'
import { PageHeading } from '@/components/PageHeading'
import { MarketRow } from '@/components/market/MarketRow'
import { OfferDialog } from '@/components/market/OfferDialog'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useActiveLeague } from '@/league/useActiveLeague'
import { nowMs } from '@/lib/clock'
import { money } from '@/lib/format'

/**
 * How often the countdowns are redrawn.
 *
 * [`duration()`](../lib/format.ts) drops to whole minutes, so a per-second tick
 * would re-render twenty rows to change nothing fifty-nine times out of sixty.
 * Ten seconds keeps "14 Min." honest to the second it turns over without
 * pretending to a precision the label does not show.
 */
const TICK_MS = 10_000

/** The page's shared clock. One interval for the whole list — see `MarketRow`. */
function useTick(): number {
  const [now, setNow] = useState(() => nowMs())

  useEffect(() => {
    const id = setInterval(() => {
      setNow(nowMs())
    }, TICK_MS)
    return () => {
      clearInterval(id)
    }
  }, [])

  return now
}

/**
 * The transfer market: everything on offer, soonest to expire first.
 *
 * The ordering is the page's argument. A listing settles the moment its
 * countdown reaches zero — to the highest bid standing at that instant, with
 * no second round — so the ones about to close are the only ones you can still
 * do anything about. Manager listings, which have no expiry at all, sort last.
 *
 * Every row is two targets: the portrait opens the player, everything else
 * opens the bid dialog. See [`MarketRow`](../components/market/MarketRow.tsx).
 */
export function MarketPage() {
  const { league, leagueId, competitionId } = useActiveLeague()
  const { data, isPending, isError, error, refetch } = useMarket(leagueId)
  const matchday = useCurrentMatchday(competitionId)
  const marketValueChanges = useMarketValueChanges(leagueId, data)
  const now = useTick()

  // The id, not the listing: the market refetches every half minute, and the
  // dialog has to keep showing the *current* offer state of the player it was
  // opened for rather than a snapshot from whenever it was tapped.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = data?.find((listing) => listing.id === selectedId) ?? null

  const heading = (
    <PageHeading
      title="Transfermarkt"
      subtitle={
        <>
          Budget <span className="nums">{money(league.budget)}</span>
        </>
      }
    />
  )

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        {heading}
        <SkeletonList rows={8} />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        {heading}
        <ErrorState
          error={error}
          onRetry={() => {
            void refetch()
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {heading}

      {data.length === 0 ? (
        <EmptyState
          icon={<Store size={22} />}
          title="Keine Spieler auf dem Markt"
          description="Kickbase stellt laufend neue Spieler ein — schau später wieder vorbei."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((listing) => (
            <MarketRow
              key={listing.id}
              listing={listing}
              leagueId={leagueId}
              fixture={matchday.data?.fixtureByTeamId.get(listing.teamId)}
              marketValueChange={marketValueChanges.get(listing.id)}
              now={now}
              onOffer={() => {
                setSelectedId(listing.id)
              }}
            />
          ))}
        </ul>
      )}

      {selected !== null && (
        // Keyed by player: the dialog seeds its amount once, at mount, so a
        // fresh component per listing is what keeps a background refetch from
        // overwriting a half-typed figure.
        <OfferDialog
          key={selected.id}
          listing={selected}
          leagueId={leagueId}
          budget={league.budget}
          onClose={() => {
            setSelectedId(null)
          }}
        />
      )}
    </div>
  )
}
