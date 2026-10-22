import { useQueries } from '@tanstack/react-query'

import { rankingDayQueryOptions } from '@/api/hooks/useDuels'
import {
  duelResultFrom,
  matchdayState,
  type DuelResult,
  type SeasonMatchday,
} from '@/api/models'
import type { RankingResponse } from '@/api/types'
import { FORM_LENGTH } from '@/components/ui/formDepth'

/**
 * How many matchdays back the form strip looks — the strip's own length, so the
 * fade cannot run out of steps.
 *
 * Five is what a football table's form guide has settled on, and about as many
 * marks as fit beside a name on a phone. Here it is also the bill: one request
 * per matchday.
 */
export const DUEL_FORM_LENGTH = FORM_LENGTH

/** One mark on the strip. */
export interface DuelFormEntry {
  day: number
  result: DuelResult
}

/** A league's recent duel form — see {@link useLeagueDuelForm}. */
export interface LeagueDuelForm {
  /**
   * Manager id → their last duels, **newest first**, at most
   * {@link DUEL_FORM_LENGTH}. A manager with no finished duel is absent rather
   * than an empty array, so read it through `?? []`.
   */
  byManagerId: Map<string, DuelFormEntry[]>
  /** Matchdays still in flight — the strips grow as they land. */
  pendingCount: number
}

/**
 * One matchday's standings, appended to every manager's run.
 *
 * Both sides of every duel are in this one payload, so the pairing is resolved
 * from `hhoui` and the outcome taken from the two `mdp` through
 * [`duelResultFrom`](../models.ts) — the same comparison the row's current
 * duel is read with.
 *
 * A manager whose opponent is missing from the payload — a bye, or an
 * odd-sized league — had no duel that week and gets no mark. The strip is
 * therefore *up to* five, not five with blanks in it: a gap would have to mean
 * something, and "no duel" is not an outcome.
 */
function addDay(
  data: RankingResponse,
  /* The matchday **asked for**, not the one echoed back: `day` on the payload
     repeats `?dayNumber=` including nonsense, so the number this strip labels
     a mark with is the one the request was made with. */
  day: number,
  into: Map<string, DuelFormEntry[]>,
): void {
  const users = data.us ?? []
  const byId = new Map(users.map((user) => [user.i, user]))

  for (const user of users) {
    const opponent = user.hhoui === undefined ? undefined : byId.get(user.hhoui)
    if (opponent === undefined || opponent.i === user.i) continue

    const entry: DuelFormEntry = {
      day,
      result: duelResultFrom(user.mdp, opponent.mdp),
    }
    const run = into.get(user.i)
    if (run === undefined) into.set(user.i, [entry])
    else run.push(entry)
  }
}

/**
 * **Every manager's last five duels** — won, drawn or lost, newest first.
 *
 * What the [standings](../../pages/RankingPage.tsx) draw as a
 * [form strip](../../components/ranking/DuelFormStrip.tsx) under each name. The
 * table already said how the *current* duel went; a league table's real
 * question is who is on a run, and in a duel league a manager three points off
 * the top having lost four straight is a different story from one who has won
 * four. Until this existed that story lived only on each manager's own page,
 * one visit at a time.
 *
 * ## What it costs
 *
 * **One request per matchday**, capped at {@link DUEL_FORM_LENGTH}, for the
 * reason the [Chicago table](./useChicagoRanking.ts) and a manager's
 * [season of duels](./useManagerDuels.ts) cost one each: `ranking?dayNumber=`
 * is the only payload that carries a pairing, and it carries exactly one
 * matchday's. This hook is the cheap member of that family — five requests
 * against Chicago's whole season — because a form guide is by definition
 * short.
 *
 * They are the **same cache entries** the duels page, the matchday page, every
 * manager's Duelle tab and the Chicago table fill, through
 * `rankingDayQueryOptions`. So the five are usually already in hand, and they
 * leave those screens loaded in turn.
 *
 * Gated on `matchdays` being passed at all: `undefined` switches the whole
 * hook off, which is how the page keeps it off non-duel leagues and off the
 * battles view.
 *
 * ## Only matchdays that are **over**
 *
 * A live matchday is a pair of part-scores — level at `0` in the third minute
 * is not a draw — so the strip is the last five *settled* duels and the
 * running one is the row's own outcome line, which stays wordless until the
 * final whistle. The same gate the record, the averages and every outcome mark
 * in the app apply.
 *
 * ## Strips grow as matchdays land
 *
 * `useQueries` reports per matchday, so a manager's run is whatever has
 * arrived — rebuilt newest-first on every render, so a matchday landing out of
 * order still slots into the right place rather than appending to the end.
 */
export function useLeagueDuelForm(
  leagueId: string | undefined,
  /** The season's matchdays. `undefined` switches the whole hook off. */
  matchdays: SeasonMatchday[] | undefined,
): LeagueDuelForm {
  /* Newest first, and only then cut to five — the other way round would take
     the season's first five matchdays and call them form. */
  const days =
    leagueId === undefined || matchdays === undefined
      ? []
      : matchdays
          .filter((matchday) => matchdayState(matchday) === 'finished')
          .map((matchday) => matchday.day)
          .sort((a, b) => b - a)
          .slice(0, DUEL_FORM_LENGTH)

  const results = useQueries({
    queries: days.map((day) => rankingDayQueryOptions(leagueId, day, false)),
  })

  const byManagerId = new Map<string, DuelFormEntry[]>()
  let pendingCount = 0

  /* `days` is newest first and `useQueries` answers in the same order, so
     walking it in order is what makes every manager's run newest first. */
  results.forEach((result, index) => {
    if (result.isPending) pendingCount += 1
    const day = days[index]
    if (result.data === undefined || day === undefined) return
    addDay(result.data, day, byManagerId)
  })

  return { byManagerId, pendingCount }
}
