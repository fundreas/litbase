import { useQueries } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import {
  areFixturesSettled,
  fixtureState,
  toOwnerId,
  toPosition,
  type MatchdayFixture,
  type PositionKey,
} from '@/api/models'
import { LIVE_POLL_MS } from '@/api/polling'
import { qk } from '@/api/queryKeys'
import type {
  PlayerCenterResponse,
  PlayerDetailResponse,
  PlayerMatchdayPoints,
} from '@/api/types'

/**
 * One matchday's entry out of a player's points history.
 *
 * **`ph` is newest first**, and it is **dense**: one entry per matchday from
 * the first up to the one the response is current for, so a player who missed
 * a matchday — or whose club has not kicked off — still has an entry. The
 * index therefore counts *back* from the front.
 *
 * This was `ph[day - 1]` until 2026-09-05, on a documented but wrong reading of
 * the array as oldest-first. It agreed with the truth for exactly one matchday
 * — index `0` either way — and then, on the second, showed every player their
 * *previous* matchday's points on the duel and match pages alike. Measured
 * against `/performance`, which carries an explicit `day` per entry:
 *
 * | Player | `ph` | `/performance` |
 * | ------ | ---- | -------------- |
 * | Heskey, played MD2 only | `[{hp:true,p:-14},{hp:false}]` | MD1 –, MD2 -14 |
 * | Vermeeren, MD2 not kicked off | `[{hp:false},{hp:true,p:25}]` | MD1 25 |
 *
 * Vermeeren is the one that settles it: his club had not played matchday 2 and
 * he still has an entry for it, at the **front**.
 *
 * ## The anchor is the array's own length, not `day`
 *
 * Given density, `ph.length` **is** the matchday the array is current for, so
 * the entry for matchday `d` sits at `length - d` and no other field is needed.
 * The first version of this fix anchored on `detail.day` instead and fell back
 * to the length — which is the same arithmetic whenever the two agree, and
 * every payload probed had them agree.
 *
 * They are not the same when they *dis*agree, and that is the whole reason
 * this changed. `detail.day` is one endpoint's notion of "current matchday"
 * being compared against the **competition's** notion, which is where `day`
 * comes from on every page that calls this. Two endpoints, two clocks: if the
 * player payload's is even one behind — which is exactly what a matchday that
 * has started but not finished invites — the index goes negative and *every
 * player on the page reads `–`*, which is a far worse failure than being one
 * matchday stale. Anchoring on the array removes the cross-endpoint dependency
 * altogether; `detail.day` stays only as the fallback for a payload whose
 * length lands out of range.
 *
 * Exported so that nothing has to re-derive it. The
 * [team roster](./useTeam.ts) reads the same `ph` across a whole season to add
 * a club's points up per matchday, and a second copy of this index — off by
 * one in the same quiet way — is exactly the bug that was shipped once already.
 */
export function matchdayEntry(
  detail: PlayerDetailResponse,
  day: number,
): PlayerMatchdayPoints | undefined {
  const history = detail.ph
  if (history === undefined) return undefined

  // Both readings of "which matchday is the front of this array", best first.
  // Whichever lands inside it wins; identical whenever the payload is
  // self-consistent, which is every payload observed.
  for (const anchor of [history.length, detail.day]) {
    if (anchor === undefined) continue
    const index = anchor - day
    if (index >= 0 && index < history.length) return history[index]
  }

  return undefined
}

/** The little a caller has to know about a player to ask for their points. */
export interface PointsSubject {
  id: string
  /** Which club they play for — how their fixture is found. */
  teamId: string
  /**
   * Fetch this player even if his match cannot have produced points yet,
   * because the caller does not know his **position** and the response
   * carries it.
   *
   * The case is a player transferred away since the matchday: he is in that
   * matchday's snapshot but in nobody's current squad, so nothing else on the
   * page can say what he plays — and a pitch that cannot place him would
   * simply drop him, which is how sold players went missing from the duel
   * lineup while showing up correctly in the ranking.
   */
  needsPosition?: boolean
  /**
   * Fetch this player even before his match can have produced points, because
   * the caller wants **who owns him**.
   *
   * The [match lineup](./useMatchLineup.ts) sets this on every player of a
   * fixture: the ownership badges are the point of that view, and they are
   * worth seeing the evening before as much as during the match. Nothing else
   * needs it — a squad's players are owned by definition.
   */
  needsOwner?: boolean
  /**
   * A **live tally the caller already holds**, which switches this player's
   * per-player poll off entirely.
   *
   * The squad's live view and the duel page both read a matchday snapshot that
   * carries `p` per player — the same running figure
   * `/playercenter/{pid}` serves, out of a payload they fetch anyway. Passing
   * it here is worth more than the one map write it saves: it means those pages
   * spend **one request per manager** on live points instead of one per player,
   * and their rows add up to the manager total Kickbase publishes, because both
   * come from the same payload.
   *
   * It is still outranked by the settled `ph` score, which is the point of
   * merging it here rather than at the call site.
   */
  livePoints?: number
}

export interface MatchdayPoints {
  /**
   * Position per player id, for every player whose detail was fetched.
   *
   * A by-product worth having: the response is already on the wire for the
   * points, and it is the only source of a position for a player no current
   * squad contains. Callers merge it under whatever their own squad knows.
   */
  positionByPlayerId: Map<string, PositionKey>
  /**
   * Owning manager's id per player, for every player whose detail was fetched.
   *
   * The other by-product of the same response (`oui`). A player absent from
   * the map is either unfetched or unowned — `toOwnerId` collapses the API's
   * `"0"` placeholder to absent, so a free agent never appears here with an id
   * that matches no manager.
   */
  ownerIdByPlayerId: Map<string, string>
  /**
   * Points per player id, for the players who have a figure.
   *
   * A player missing from the map has **no known score** — the request is
   * still in flight, their match has not kicked off, or they did not feature
   * at all. Deliberately not defaulted to `0`, which would claim they played
   * and scored nothing.
   */
  byPlayerId: Map<string, number>
  /** True while any per-player request is in flight; rows render without them. */
  isPending: boolean
}

/**
 * Every player's points for one matchday, fanned out one request per player.
 *
 * This is the most expensive thing the app does, and the reason is that
 * **there is no bulk source of per-player matchday points** —
 * `/leagues/{id}/players`, `?ids=` and every other shape answer 404. What there
 * is, is *two* per-player sources that answer at different times, and the whole
 * design of this hook is which one to ask and when.
 *
 * ## The settled score and the running one
 *
 * | | `ph` on `/players/{pid}` | `p` on `/playercenter/{pid}` |
 * | --- | --- | --- |
 * | While the match runs | **nothing** — `{hp: false}`, no `p` | the live tally |
 * | Once it is over | the settled score | a frozen tally, **not reconciled** |
 *
 * Both halves were measured on 2026-09-05 during matchday 2, and both matter:
 *
 *  - A player on the pitch, three reads minutes apart: `p` climbed 23 → 105 →
 *    110 on the player centre while `ph[0]` stayed `{hp: false}` throughout.
 *    **`ph` is empty for the whole duration of the match**, which is why every
 *    live page in this app read `–` until this was found — the bug was never in
 *    the index, it was in asking the only endpoint that had nothing to say.
 *  - A player whose match had already finished read `-8` on the player centre
 *    against `-14` in `ph`, `tp` *and* `/performance`. The running tally is not
 *    corrected at the final whistle.
 *
 * ## Which one wins, and why it depends on the matchday
 *
 * Three sources agreeing on `-14` looks like a settled argument, and it is not
 * — because **Kickbase itself is still counting the `-8`**. The manager totals
 * it publishes in the standings sum the running tallies exactly: 291 against a
 * published `mdp` of 291, measured mid-matchday. Show the settled score for
 * that player and the rows on a live page stop adding up to the total above
 * them, and the app disagrees with the official one about a number both are
 * showing.
 *
 * So the precedence follows the **matchday**, not the match:
 *
 *  - **While the matchday is unsettled** — any fixture still to come or in play
 *    — the running tally wins. That is what Kickbase is summing, so the page is
 *    internally consistent and agrees with the official app.
 *  - **Once every fixture is finished**, `ph` wins. The two converge by then:
 *    on matchday 1, fully played, the player centre and `ph` returned the same
 *    `50`. So this is less a correction than a handover to the source that
 *    stays right for the rest of the season.
 *
 * A row can therefore change by a few points at the end of a matchday. That is
 * Kickbase reconciling, and following it is the point.
 *
 * The fetching follows the same split, so nothing is asked for twice: an
 * unsettled matchday asks only the player centre, a settled one asks only
 * `ph` — and falls back to the centre for a player `ph` has nothing for, which
 * is why the two fan-outs are built in sequence rather than side by side.
 *
 * ## What keeps the cost down
 *
 *  1. **A player whose club has not kicked off is not asked at all.** There is
 *     nothing to read, so an upcoming matchday issues **zero** requests.
 *  2. **A settled player is fetched once** and held for the session.
 *  3. **Only players actually on the pitch are polled**, at
 *     [the live rate](../polling.ts) — per player, not per page, so a matchday
 *     with one late kick-off costs two requests a tick rather than twenty-two.
 *
 *     It is still the app's heaviest traffic by a distance: a full fixture's
 *     thirty-six players poll together. The rate lives in one place so that
 *     trade can be re-made in one edit — and callers that hold a **cheaper live
 *     source** can switch the poll off per player, which is what
 *     {@link PointsSubject.livePoints} is for.
 *
 * ## The cache keys
 *
 * `qk.playerDetail(leagueId, playerId)` carries no matchday — one response
 * holds every matchday's `ph` — and is the same entry
 * [`useStartProbabilities`](./useStartProbabilities.ts) reads, so a page
 * showing both pays for the player once. `qk.playerCenter` **is** keyed by the
 * matchday, because that response describes one fixture and `?dayNumber=`
 * chooses which.
 *
 * Shared by the [duel detail](./useDuelRosters.ts) page, which asks for both
 * managers' players at once, the squad page's live view, which asks for its
 * own, and the [match lineup](./useMatchLineup.ts), which asks for everyone in
 * a fixture — twenty-two players plus the benches, and the one caller that
 * wants a request even before kick-off, for the ownership badges.
 */
export function useMatchdayPoints(
  leagueId: string | undefined,
  day: number | undefined,
  players: readonly PointsSubject[],
  fixtureByTeamId: Map<string, MatchdayFixture> | undefined,
): MatchdayPoints {
  /**
   * Has every fixture of this matchday been played to the end? That is what
   * decides which of the two scores is the one to show — see the note above.
   */
  const isSettled = areFixturesSettled(fixtureByTeamId)

  // What each subject's own match is doing, which decides both fan-outs. Built
  // flat so each is a single `useQueries` — one hook call whose length may
  // change between renders, which is exactly what it exists for.
  const wanted = players.map((player) => {
    const fixture = fixtureByTeamId?.get(player.teamId)
    const state = fixture === undefined ? undefined : fixtureState(fixture)
    return {
      subject: player,
      matchId: fixture?.matchId,
      isRunning: state === 'running',
      hasStarted: state === 'running' || state === 'finished',
    }
  })

  const detailQueries = useQueries({
    queries: wanted.map(({ subject }) => ({
      queryKey: qk.playerDetail(leagueId ?? 'none', subject.id),
      /*
       * **Only once the whole matchday is over.** Before that `ph` holds
       * nothing for it — asking during a match was thirty-six requests a tick
       * to read `{hp: false}` thirty-six times — and even for a fixture that
       * has finished early, the running tally is the figure the standings are
       * still counting. The two by-products are the exceptions: a position and
       * an owner do not depend on any match having been played.
       */
      enabled:
        leagueId !== undefined &&
        (isSettled ||
          subject.needsPosition === true ||
          subject.needsOwner === true),
      // Nothing in this response moves for the rest of the session: the
      // matchday is over, or what was wanted from it was never about a match.
      staleTime: Infinity,
      queryFn: () =>
        get<PlayerDetailResponse>(
          endpoints.leagues.player(leagueId as string, subject.id),
        ),
    })),
  })

  // All three maps are built on every render, deliberately. `useQueries`
  // returns a fresh array each time, so none can be memoised on its own input
  // without inventing a surrogate key — and a signature-string keyed memo is
  // harder to trust than the thirty map writes it would save. Nothing here is
  // on a hot path: a page using this re-renders on the live poll and on a tab
  // switch.
  const settledPoints = new Map<string, number>()
  const positionByPlayerId = new Map<string, PositionKey>()
  const ownerIdByPlayerId = new Map<string, string>()

  for (const query of detailQueries) {
    const detail = query.data
    if (detail === undefined) continue
    if (detail.pos !== undefined) {
      positionByPlayerId.set(detail.i, toPosition(detail.pos))
    }
    const ownerId = toOwnerId(detail.oui)
    if (ownerId !== undefined) ownerIdByPlayerId.set(detail.i, ownerId)
    if (day === undefined) continue
    /*
     * **The score is `p`, and `hp` is not asked about.** A player who missed
     * the matchday carries `hp: false` with no `p` at all, so the presence of
     * `p` already answers the question `hp` was being tested for — and it
     * answers it about the field actually being read.
     */
    const entry = matchdayEntry(detail, day)
    if (entry?.p !== undefined) settledPoints.set(detail.i, entry.p)
  }

  /*
   * The running tally. Built from the results above rather than beside them,
   * so a settled matchday — where `ph` has answered for everyone — asks for
   * nothing here at all.
   */
  const centerQueries = useQueries({
    queries: wanted.map(({ subject, isRunning, hasStarted }) => ({
      queryKey: qk.playerCenter(leagueId ?? 'none', subject.id, day ?? 0),
      enabled:
        leagueId !== undefined &&
        day !== undefined &&
        hasStarted &&
        // A caller holding a cheaper live source of its own says so, and this
        // player then costs nothing — see `livePoints`.
        subject.livePoints === undefined &&
        // On a settled matchday this is only the fallback for a player `ph`
        // has nothing for; before that it is the source.
        (!isSettled || !settledPoints.has(subject.id)),
      // Only a running match can change. A finished one is frozen — the tally
      // is never revised — so one read is enough.
      staleTime: isRunning ? 0 : Infinity,
      refetchInterval: isRunning ? LIVE_POLL_MS : (false as const),
      queryFn: () =>
        get<PlayerCenterResponse>(
          endpoints.leagues.playerCenter(leagueId as string, subject.id),
          { params: { dayNumber: day } },
        ),
    })),
  })

  const livePoints = new Map<string, number>()

  for (const [index, query] of centerQueries.entries()) {
    const entry = wanted[index]
    const center = query.data
    if (entry === undefined || center === undefined) continue
    /*
     * **The response has to be about the match this page is showing.** It is
     * `?dayNumber=` that selects it, and a silently ignored parameter is a
     * failure mode this API has form for — `dayNumber` on
     * `/managers/{uid}/squad` and on `us` are both ignored. `mi` is the
     * response naming the fixture it answered about, so it is checked rather
     * than trusted; it arrives as a number here and a string on a fixture.
     */
    if (
      entry.matchId !== undefined &&
      center.mi !== undefined &&
      String(center.mi) !== entry.matchId
    ) {
      continue
    }
    if (center.p !== undefined) livePoints.set(entry.subject.id, center.p)
  }

  // What the caller already knew is the same running tally, read from a
  // payload it was holding anyway, so it belongs in the same map.
  for (const { subject } of wanted) {
    if (subject.livePoints !== undefined) {
      livePoints.set(subject.id, subject.livePoints)
    }
  }

  /*
   * The one decision this hook exists to make. **Settled matchday: `ph`
   * first.** **Unsettled: the running tally first** — it is what Kickbase's own
   * standings are summing, so a live page whose rows disagree with the total
   * above them is the app being wrong, not Kickbase.
   *
   * Each is the other's fallback, so a gap in either is covered.
   */
  const [first, second] = isSettled
    ? [settledPoints, livePoints]
    : [livePoints, settledPoints]
  const byPlayerId = new Map([...second, ...first])

  return {
    byPlayerId,
    positionByPlayerId,
    ownerIdByPlayerId,
    isPending: [...detailQueries, ...centerQueries].some(
      (query) => query.isFetching,
    ),
  }
}
