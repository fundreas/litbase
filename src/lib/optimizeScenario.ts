import type { PositionKey } from '@/api/models'
import {
  FORMATIONS,
  GOALKEEPER_COUNT,
  LINEUP_SIZE,
  PENALTY_PER_EMPTY_SLOT,
  type Formation,
} from '@/lib/lineup'

/**
 * **"Who do I sell, and who do I field?"** — the two halves of the
 * [scenario](../pages/WhatIfPage.tsx), answered together because neither has
 * an answer on its own.
 *
 * A manager who has bid past his budget has to raise the difference by
 * selling, and every sale takes a player off the pitch. So "sell the cheapest
 * surplus" and "field the best eleven" are not two problems in sequence: the
 * eleven decides who is *surplus*, and the money decides how much of the
 * eleven he can keep. Solving them one after the other gives the wrong answer
 * in the only case that is interesting — the one where the gap is big enough
 * that somebody in the eleven has to go.
 *
 * ## The reformulation that makes it tractable
 *
 * The constraint looks like a search over sale sets, and it is not. Whatever
 * the manager keeps *off* the pitch is sellable, so:
 *
 * ```
 * Σ(sale value of everyone sellable) − Σ(sale value of the eleven) ≥ need
 * ```
 *
 * which rearranges to a **cap on the eleven**:
 *
 * ```
 * Σ(sale value of the eleven) ≤ Σ(sale value of everyone sellable) − need
 * ```
 *
 * That is a knapsack: pick eleven players, maximise expected points, keep the
 * value of the owned ones inside a budget. Feasibility is then guaranteed for
 * the second half — there is always *some* way to cover the gap from what is
 * left — which is what lets {@link chooseSales} pick the *nice* way rather
 * than any way.
 *
 * ## What "best" means
 *
 * **Points**, as the rest of the app means them: the reader's own guess where
 * he typed one, the [pointcast](../api/hooks/usePointcast.ts) prediction
 * everywhere else — see {@link ExpectedPointsView}. The caller resolves that
 * to a number per player; this file only adds up.
 *
 * An empty slot is worth {@link PENALTY_PER_EMPTY_SLOT} *negative* points, so
 * the search is over lineups of **at most** eleven rather than exactly eleven:
 * a squad of ten after the sales has a best answer too, and it is the one that
 * leaves the cheapest hole. In practice 100 points dwarfs any single player's
 * expectation, so eleven is filled whenever eleven exist.
 *
 * ## Nothing is sold that did not have to be
 *
 * The cap says how much value must leave the pitch; it does not say that all
 * of it must leave the squad. Only a **minimal** set is sold — one where
 * dropping any member puts the budget back under water — and of those, the one
 * that costs the manager least. See {@link chooseSales} for what "costs" means
 * and for where the 24-hour market move comes into it.
 */

/** A squad member as the optimiser needs him — the four facts it reads. */
export interface OptimizerPlayer {
  id: string
  position: PositionKey
  /** What he is expected to score on the matchday being planned. */
  points: number
  /** What selling him would bring in, on the scenario's chosen day. */
  saleValue: number
  /**
   * His **24-hour market-value change**, in €, signed — `0` where the squad
   * payload did not carry one.
   *
   * The tie-breaker, and the manager's own rule: with two players equally
   * surplus to the eleven, the one still climbing is the one worth keeping.
   */
  valueChangeDay: number
  /**
   * Whether the scenario may sell him at all.
   *
   * `false` for a player it does not own yet — the target of a bid, and the
   * players the standing bids would bring in. They can be *fielded*, which is
   * the whole point of imagining them, but they are nobody's to sell.
   */
  isSellable: boolean
}

export interface ScenarioPlan {
  /** Who to sell, in the order they were considered. May be empty. */
  soldIds: string[]
  /** The eleven, keeper first, then defence, midfield and attack. */
  lineupIds: string[]
  /** The shape those eleven make. */
  formation: Formation
  /** What the lineup is expected to score, before any empty-slot penalty. */
  points: number
  /** Places it could not fill — each one {@link PENALTY_PER_EMPTY_SLOT}. */
  emptySlots: number
  /** What the sales bring in. */
  proceeds: number
  /**
   * What is **still** missing once every sellable player is gone — `0`
   * whenever the gap closes, which is almost always.
   *
   * Non-zero means the question had no answer: the bid is simply bigger than
   * the squad. Nothing is sold in that case, because selling the lot and still
   * being overdrawn is not a plan; the lineup half is answered anyway, and the
   * caller says so.
   */
  shortfall: number
}

/** The order a lineup's ids come out in — the order {@link buildSlots} wants. */
const POSITIONS: readonly PositionKey[] = ['gk', 'def', 'mid', 'fwd']

/**
 * What fielding this player costs the cap.
 *
 * His sale value if he is the manager's to sell, and **nothing** if he is not:
 * a bid's target left on the bench frees no money, so putting him on the pitch
 * spends none of the allowance either.
 */
function capValue(player: OptimizerPlayer): number {
  return player.isSellable ? player.saleValue : 0
}

/**
 * How many partial elevens one position's frontier is allowed to carry.
 *
 * The exact frontier can grow with the number of distinct point totals, and
 * four of them are multiplied together. Thinning keeps both ends — the
 * highest-scoring pick and the cheapest one — and drops evenly spaced middle
 * entries, which is the one thinning that cannot quietly lose the answer at
 * either extreme the cap might be asking for. It does not bind on a real
 * squad; it is a bound on a pathological one.
 */
const FRONTIER_LIMIT = 48

/**
 * The most players one position may contribute candidates from.
 *
 * {@link trimDominated} normally leaves far fewer. This is the seatbelt for a
 * squad that defeats it — fifteen defenders whose prices rank exactly as their
 * points do, so that none dominates another.
 */
const GROUP_LIMIT = 16

/** Nodes {@link chooseSales} may visit before it falls back to a greedy pick. */
const SALE_SEARCH_LIMIT = 300_000

/**
 * The plan: who goes, who plays.
 *
 * `deficit` is what the budget is short by once the bid and every standing
 * offer the scenario is counting have been taken off it — negative when there
 * is money spare, in which case nothing is sold and this is purely a lineup
 * optimiser.
 */
export function planScenario({
  players,
  deficit,
}: {
  players: readonly OptimizerPlayer[]
  deficit: number
}): ScenarioPlan {
  const sellable = players.filter((player) => player.isSellable)
  const liquid = sellable.reduce((sum, player) => sum + player.saleValue, 0)
  const need = Math.max(deficit, 0)
  const shortfall = Math.max(need - liquid, 0)

  /* With the gap unclosable the cap would admit no eleven at all, and an
     answer of "field nobody" helps no one. So the money half is abandoned
     openly — reported as the shortfall — and the lineup half is answered
     without a cap, which is the half that still has an answer. */
  const cap = shortfall > 0 ? Number.POSITIVE_INFINITY : liquid - need

  const lineup = bestLineup(players, cap)
  const fielded = new Set(lineup.ids)
  const sold =
    shortfall > 0
      ? []
      : chooseSales(
          sellable.filter((player) => !fielded.has(player.id)),
          need,
        )

  return {
    soldIds: sold.map((player) => player.id),
    lineupIds: lineup.ids,
    formation: lineup.formation,
    points: lineup.points,
    emptySlots: LINEUP_SIZE - lineup.ids.length,
    proceeds: sold.reduce((sum, player) => sum + player.saleValue, 0),
    shortfall,
  }
}

/* ------------------------------------------------------------------ */
/* The eleven                                                          */
/* ------------------------------------------------------------------ */

/**
 * A partial eleven: what it scores, what of it could have been sold, and who
 * is in it.
 *
 * `value` counts the **sellable** players only. A bid's target contributes
 * points and nothing to the cap, which is right — fielding him frees no money
 * because there was never any to free.
 */
interface Pick {
  points: number
  value: number
  ids: readonly string[]
}

/** Picks indexed by how many players they field. */
type PicksByCount = Pick[][]

/** The bucket for picks of this size, created on first use. */
function bucketOf(byCount: PicksByCount, count: number): Pick[] {
  const existing = byCount[count]
  if (existing !== undefined) return existing

  const fresh: Pick[] = []
  byCount[count] = fresh
  return fresh
}

/**
 * The best lineup whose sellable half stays inside `cap`.
 *
 * Every one of the ten {@link FORMATIONS} is tried, because the cap can make a
 * shape that is worse on points the only shape that is affordable — five cheap
 * defenders instead of three good ones is exactly the trade this function
 * exists to find. Within a formation each position is solved on its own and
 * the four answers are merged, which is what keeps an exhaustive search over
 * eleven players out of twenty-odd down to a few thousand additions.
 */
function bestLineup(
  players: readonly OptimizerPlayer[],
  cap: number,
): { ids: string[]; formation: Formation; points: number } {
  const byPosition = new Map<PositionKey, OptimizerPlayer[]>(
    POSITIONS.map((position) => [
      position,
      players
        .filter((player) => player.position === position)
        .sort(
          (a, b) =>
            b.points - a.points ||
            capValue(a) - capValue(b) ||
            a.id.localeCompare(b.id),
        ),
    ]),
  )

  const positionOf = new Map(
    players.map((player) => [player.id, player.position]),
  )

  let best: { ids: string[]; formation: Formation; points: number } = {
    ids: [],
    formation: { def: 0, mid: 0, fwd: 0 },
    points: 0,
  }
  let bestScore = Number.NEGATIVE_INFINITY

  for (const formation of FORMATIONS) {
    const allowance: Record<PositionKey, number> = {
      gk: GOALKEEPER_COUNT,
      def: formation.def,
      mid: formation.mid,
      fwd: formation.fwd,
    }

    let frontier: PicksByCount = [[{ points: 0, value: 0, ids: [] }]]
    for (const position of POSITIONS) {
      const group = byPosition.get(position) ?? []
      const room = allowance[position]
      frontier = merge(
        frontier,
        positionPicks(trimDominated(group, room), room),
        LINEUP_SIZE,
      )
    }

    for (const [count, bucket] of frontier.entries()) {
      for (const pick of bucket) {
        if (pick.value > cap) continue
        const score =
          pick.points - PENALTY_PER_EMPTY_SLOT * (LINEUP_SIZE - count)
        if (score <= bestScore) continue
        bestScore = score
        best = {
          ids: [...pick.ids],
          /* The shape actually built, not the one it was searched inside:
             a cap that leaves four midfielders in a 4-5-1 has built a 4-4-1,
             and calling that a 4-5-1 would claim a slot nobody fills. */
          formation: shapeOf(pick.ids, positionOf),
          points: pick.points,
        }
      }
    }
  }

  return best
}

/** The def-mid-fwd shape a set of ids actually makes. */
function shapeOf(
  ids: readonly string[],
  positionOf: ReadonlyMap<string, PositionKey>,
): Formation {
  const shape: Formation = { def: 0, mid: 0, fwd: 0 }
  for (const id of ids) {
    const position = positionOf.get(id)
    if (position === 'def') shape.def += 1
    else if (position === 'mid') shape.mid += 1
    else if (position === 'fwd') shape.fwd += 1
  }
  return shape
}

/**
 * Candidates one position can contribute, with the hopeless ones removed.
 *
 * A player is **dominated** by another who scores at least as much and would
 * sell for no more: there is never a reason to field the first over the
 * second. Dominated by `room` others and he can never make an optimal pick at
 * all — however many of this position are fielded, one of those others is
 * free to take his place. Dropping him is therefore exact, not a heuristic,
 * and it is what keeps the subset enumeration below small.
 *
 * `players` must arrive sorted by points descending then value ascending, so
 * that everything earlier in the list is a potential dominator and the test is
 * a single backward scan.
 */
function trimDominated(
  players: readonly OptimizerPlayer[],
  room: number,
): OptimizerPlayer[] {
  if (room === 0) return []

  const kept: OptimizerPlayer[] = []
  for (const player of players) {
    let dominators = 0
    for (const other of players) {
      if (other === player) break
      if (capValue(other) <= capValue(player)) dominators += 1
      if (dominators >= room) break
    }
    if (dominators < room) kept.push(player)
    if (kept.length >= GROUP_LIMIT) break
  }
  return kept
}

/**
 * Every way this position could fill nought to `room` of its places, reduced
 * to the picks that are worth keeping.
 *
 * Exhaustive: the trimmed group is a handful of players and `room` is at most
 * six, so this is hundreds of subsets, not millions. The frontier it hands
 * back is what the merge multiplies, which is why it is pruned here rather
 * than afterwards.
 */
function positionPicks(
  players: readonly OptimizerPlayer[],
  room: number,
): PicksByCount {
  const byCount: PicksByCount = Array.from({ length: room + 1 }, () => [])
  const chosen: OptimizerPlayer[] = []

  const walk = (from: number, points: number, value: number): void => {
    bucketOf(byCount, chosen.length).push({
      points,
      value,
      ids: chosen.map((player) => player.id),
    })
    if (chosen.length === room) return

    for (let next = from; next < players.length; next += 1) {
      const player = players[next]
      if (player === undefined) continue
      chosen.push(player)
      walk(next + 1, points + player.points, value + capValue(player))
      chosen.pop()
    }
  }
  walk(0, 0, 0)

  return byCount.map((picks) => prune(picks))
}

/**
 * Two frontiers combined into one, capped at `limit` players in total.
 *
 * Points and value are both additive and the constraint is a ceiling on the
 * sum, so a pick that is beaten on both counts by another of the same size can
 * never become the better of two completed elevens. That is what makes
 * pruning between merges safe, and it is the whole reason this stays cheap.
 */
function merge(
  left: PicksByCount,
  right: PicksByCount,
  limit: number,
): PicksByCount {
  const out: PicksByCount = Array.from({ length: limit + 1 }, () => [])

  for (const [a, ones] of left.entries()) {
    if (ones.length === 0) continue
    for (const [b, others] of right.entries()) {
      if (a + b > limit) break
      const bucket = bucketOf(out, a + b)
      for (const one of ones) {
        for (const other of others) {
          bucket.push({
            points: one.points + other.points,
            value: one.value + other.value,
            ids: [...one.ids, ...other.ids],
          })
        }
      }
    }
  }

  return out.map((picks) => prune(picks))
}

/**
 * The Pareto frontier of a bucket: nothing that another pick beats on points
 * while also being cheaper to keep.
 *
 * Sorted best-points-first, so the kept list runs from "the eleven you would
 * pick with money to burn" down to "the eleven you could still afford after
 * selling almost everybody" — which is exactly the axis the cap slides along.
 */
function prune(picks: Pick[]): Pick[] {
  picks.sort((a, b) => b.points - a.points || a.value - b.value)

  const kept: Pick[] = []
  let cheapest = Number.POSITIVE_INFINITY
  for (const pick of picks) {
    if (pick.value >= cheapest) continue
    kept.push(pick)
    cheapest = pick.value
  }

  return kept.length <= FRONTIER_LIMIT ? kept : thin(kept, FRONTIER_LIMIT)
}

/** `limit` entries spread evenly across the list, both ends included. */
function thin(picks: Pick[], limit: number): Pick[] {
  const step = (picks.length - 1) / (limit - 1)
  const kept: Pick[] = []
  for (let index = 0; index < limit; index += 1) {
    const pick = picks[Math.round(index * step)]
    if (pick !== undefined) kept.push(pick)
  }
  return kept
}

/* ------------------------------------------------------------------ */
/* The sales                                                           */
/* ------------------------------------------------------------------ */

/**
 * **Who to sell, out of the players the eleven does not want.**
 *
 * Any subset that raises `need` would do; the question is which one the
 * manager would least regret, and that is one number:
 *
 * ```
 * cost = (proceeds − need) + Σ(24-hour change of the players sold)
 * ```
 *
 * Both terms are euros, which is what lets them be added:
 *
 *  - **Overshoot** is value liquidated for nothing. Raising 12 Mio. to cover
 *    a 3 Mio. gap is 9 Mio. of team value handed over for no reason, and it is
 *    why the first term exists at all — without it the search would happily
 *    dump a crashing star to plug a hole a reserve could have filled.
 *  - **The overnight move** is what the sale gives away by tomorrow. A player
 *    climbing 200k a night costs 200k to sell; one shedding 300k pays 300k to
 *    be rid of. This is the manager's own rule — *with two players equally
 *    surplus, keep the one making more* — expressed so that it decides the
 *    close calls without ever overruling a wildly worse price.
 *
 * Only **minimal** covering sets are considered: drop any member and the
 * budget goes back under. That is what stops the second term from turning into
 * a licence to sell every faller in the squad, and it is checked in O(1) —
 * removing the *smallest* member is the smallest possible drop, so if even
 * that breaks the cover, every other removal does too.
 *
 * Ties go to the smaller squad disturbance: fewer players, then less money
 * raised, then id order so the same squad always gets the same answer.
 */
function chooseSales(
  pool: readonly OptimizerPlayer[],
  need: number,
): OptimizerPlayer[] {
  if (need <= 0) return []

  /* Dearest first: a covering set is reached within a few levels, and the
     branch is closed the moment it covers, so the expensive players prune the
     tree instead of sitting at the bottom of it. */
  const candidates = [...pool].sort(
    (a, b) => b.saleValue - a.saleValue || a.id.localeCompare(b.id),
  )
  /** What everything from `index` on is worth — the "give up now" test. */
  const rest = new Array<number>(candidates.length + 1).fill(0)
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    rest[index] = (rest[index + 1] ?? 0) + (candidates[index]?.saleValue ?? 0)
  }
  if ((rest[0] ?? 0) < need) return [...candidates]

  let best: OptimizerPlayer[] | null = null
  let bestCost = Number.POSITIVE_INFINITY
  let bestCount = Number.POSITIVE_INFINITY
  let bestProceeds = Number.POSITIVE_INFINITY
  let visited = 0

  const chosen: OptimizerPlayer[] = []

  const walk = (
    from: number,
    proceeds: number,
    change: number,
    least: number,
  ): void => {
    if (proceeds >= need) {
      // Not minimal — some member is carried for nothing, and a set that
      // sells a player it did not need is never the answer.
      if (proceeds - least >= need) return

      const cost = proceeds - need + change
      const count = chosen.length
      const isBetter =
        cost < bestCost ||
        (cost === bestCost &&
          (count < bestCount ||
            (count === bestCount && proceeds < bestProceeds)))
      if (isBetter) {
        best = [...chosen]
        bestCost = cost
        bestCount = count
        bestProceeds = proceeds
      }
      return
    }

    if (from >= candidates.length) return
    if (proceeds + (rest[from] ?? 0) < need) return
    visited += 1
    if (visited > SALE_SEARCH_LIMIT) return

    for (let next = from; next < candidates.length; next += 1) {
      const player = candidates[next]
      if (player === undefined) continue
      chosen.push(player)
      walk(
        next + 1,
        proceeds + player.saleValue,
        change + player.valueChangeDay,
        Math.min(least, player.saleValue),
      )
      chosen.pop()
    }
  }
  walk(0, 0, 0, Number.POSITIVE_INFINITY)

  return best ?? greedySales(candidates, need)
}

/**
 * The answer for a squad big enough to defeat the search above — the manager's
 * rule applied straight, with no arithmetic behind it.
 *
 * Sell the heaviest faller first and keep going until the gap closes, then
 * take back anyone the rest of the set turned out to cover. It is not optimal;
 * it is what the rule says in one line, and it only ever runs on a pool no
 * real Kickbase squad produces.
 */
function greedySales(
  pool: readonly OptimizerPlayer[],
  need: number,
): OptimizerPlayer[] {
  const order = [...pool].sort(
    (a, b) => a.valueChangeDay - b.valueChangeDay || b.saleValue - a.saleValue,
  )

  const taken: OptimizerPlayer[] = []
  let proceeds = 0
  for (const player of order) {
    if (proceeds >= need) break
    taken.push(player)
    proceeds += player.saleValue
  }

  // Cheapest back on the shelf first, so what remains is the smallest set that
  // still covers rather than the first one that reached it.
  for (const player of [...taken].sort((a, b) => a.saleValue - b.saleValue)) {
    if (proceeds - player.saleValue < need) continue
    taken.splice(taken.indexOf(player), 1)
    proceeds -= player.saleValue
  }

  return taken
}
