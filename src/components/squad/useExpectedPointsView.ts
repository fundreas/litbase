import { useMemo } from 'react'

import { usePointcast } from '@/api/hooks/usePointcast'
import type { PointcastPrediction } from '@/api/models'
import { useActiveLeague } from '@/league/useActiveLeague'
import {
  expectedPointsView,
  useExpectedPoints,
  type ExpectedPointsView,
} from '@/lib/expectedPoints'

/**
 * **What every player on the screen is expected to score** — the reader's own
 * guesses, with the [pointcast](../../api/hooks/usePointcast.ts) prediction
 * standing in wherever he has not made one.
 *
 * The two halves come from different places and are joined here rather than at
 * four call sites: the guesses from `localStorage` through
 * [`useExpectedPoints`](../../lib/expectedPoints.ts), the predictions from one
 * cached file per matchday. Every list that shows expected points calls this —
 * one's own Kader, a rival's, a club's roster — and they share the single
 * request, because the query key is the competition and the matchday and
 * nothing else.
 *
 * The competition comes from the league in the URL rather than from a prop:
 * every screen this serves sits inside `/leagues/:leagueId`, and the model
 * covers Bundesliga only, so the hook that knows about the model is the right
 * place to ask which competition it is looking at.
 *
 * Memoised on the two inputs, both of which are stable references — the store
 * hands back the same record until a guess changes, React Query the same map
 * until the file is re-fetched — so the view a list closes over is stable too.
 */
export function useExpectedPointsView(
  matchday: number | undefined,
): ExpectedPointsView {
  const { competitionId } = useActiveLeague()
  const own = useExpectedPoints(matchday)
  const pointcast = usePointcast(competitionId, matchday)
  const predictions = pointcast.data?.byPlayerId

  return useMemo(() => expectedPointsView(own, predictions), [own, predictions])
}

/**
 * **One player's prediction, for the sheet that lets him be overruled.**
 *
 * The [sheet](./ExpectedPointsDialog.tsx) shows the model's figure whether or
 * not it is the one in the field, so it needs the whole prediction — the band,
 * the start chance — and not just the number the view resolved. It also needs
 * to tell "still loading" from "the model has nothing for him", because those
 * two deserve different lines on the screen; `isPending` is what separates
 * them, and it is `false` for a competition the run does not cover, where
 * waiting would never end.
 */
export function usePointcastPrediction(
  matchday: number | undefined,
  playerId: string,
): { prediction: PointcastPrediction | undefined; isPending: boolean } {
  const { competitionId } = useActiveLeague()
  const pointcast = usePointcast(competitionId, matchday)

  return {
    prediction: pointcast.data?.byPlayerId.get(playerId),
    isPending: pointcast.isLoading,
  }
}
