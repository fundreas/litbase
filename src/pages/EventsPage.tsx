import { ActivityFeed } from '@/components/events/ActivityFeed'
import { PageHeading } from '@/components/PageHeading'
import { useActiveLeague } from '@/league/useActiveLeague'

/**
 * **The league's event log, and nothing else** — the landing page of a league.
 *
 * This was the dashboard: four stat tiles and a top-three preview of the
 * standings. Both were duplicates. The budget and team value are in the header
 * on every page, the placement and points are the [Rangliste](RankingPage.tsx)
 * one tap away and in full, and the squad size answers a question nobody
 * arrives with. What was left was a summary of pages that summarise
 * themselves.
 *
 * The feed is the one thing here that exists nowhere else in the app: what has
 * happened in the league since you last looked. So it *is* the page.
 *
 * The heading is the league's name rather than "Aktivitäten" — the page is the
 * league's front door, and the drawer entry beside it already says what kind
 * of page it is.
 */
export function EventsPage() {
  const { league, leagueId } = useActiveLeague()

  return (
    <div className="flex flex-col gap-5">
      <PageHeading
        title={league.name}
        subtitle="Was in der Liga passiert ist"
      />
      <ActivityFeed leagueId={leagueId} />
    </div>
  )
}
