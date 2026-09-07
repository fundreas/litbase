#!/usr/bin/env node
/**
 * Build the matchday-ranking files under `data/` that the app reads for any
 * matchday other than the current one.
 *
 * ## Why this exists
 *
 * `/v4/competitions/{id}/players` is the only bulk ranking the API serves, and
 * it answers the **current matchday only** — every matchday parameter it was
 * offered is swallowed in silence. So a past matchday's ranking has to be
 * assembled from the one place the numbers survive: each player's own
 * performance history.
 *
 * The sweep is:
 *
 *   1. `/competitions/{id}/table`                    → the 18 club ids
 *   2. `/competitions/{id}/teams/{tid}/teamprofile`  → every player, 18 calls
 *   3. `/competitions/{id}/players/{pid}/performance` → one call per player,
 *      each answering **every matchday of the season at once**
 *
 * That last property is what makes this affordable: ~470 requests rebuild the
 * whole season, not one matchday, so re-running after each matchday is the
 * same cost as seeding from scratch and there is no incremental state to get
 * wrong.
 *
 * ## What it writes
 *
 * One file per **settled** matchday — `data/rankings/{competitionId}/matchday-{day}.json`
 * — holding every player who scored that day, points descending. The current
 * matchday is deliberately skipped: it is still moving, and the app has the
 * live endpoint for it.
 *
 * The 100-row cap the UI shows is applied **at render, not here**. Keeping the
 * full list means the per-position rankings are real top-100s rather than
 * whatever survived an overall cut, and raising the cap later costs no
 * re-seed.
 *
 * ## Running it
 *
 *   KB_TOKEN=<bearer> npm run data:rankings
 *
 * Options, all optional:
 *
 *   --competition=1     Competition id (default 1, Bundesliga)
 *   --days=1,2          Only these matchdays (default: every settled one)
 *   --out=data          Output root
 *   --concurrency=8     Requests in flight
 *   --dry-run           Fetch and report, write nothing
 *
 * The token is a normal Kickbase bearer — the one the app itself signs in for.
 * It is read from the environment and never written to disk.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { argv, env, exit } from 'node:process'

const API_BASE = 'https://api.kickbase.com'

/** `pos` on the wire → the key the app's models use. */
const POSITION_BY_CODE = { 1: 'gk', 2: 'def', 3: 'mid', 4: 'fwd' }

/** `k` on a performance entry — see docs/api/codes.md. */
const EVENT_GOAL = 1
const EVENT_ASSIST = 3

/** `mdst` on a performance entry: the matchday is played out. */
const MATCHDAY_FINISHED = 2

/* -------------------------------------------------------------------------- */
/* Arguments                                                                  */
/* -------------------------------------------------------------------------- */

function parseArgs(args) {
  const flags = new Map()
  for (const arg of args) {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg)
    if (match === null) fail(`Unrecognised argument: ${arg}`)
    flags.set(match[1], match[2] ?? 'true')
  }
  return {
    competitionId: flags.get('competition') ?? '1',
    outDir: flags.get('out') ?? 'data',
    concurrency: Number(flags.get('concurrency') ?? '8'),
    isDryRun: flags.get('dry-run') === 'true',
    days:
      flags.get('days') === undefined
        ? undefined
        : new Set(
            flags
              .get('days')
              .split(',')
              .map((value) => Number(value.trim())),
          ),
  }
}

function fail(message) {
  console.error(`\n  ✗ ${message}\n`)
  exit(1)
}

/* -------------------------------------------------------------------------- */
/* HTTP                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * One GET, with a short retry.
 *
 * A sweep this size will meet the occasional 502 or dropped socket, and losing
 * one player out of 470 would silently bend a ranking rather than break it —
 * which is the kind of error nobody notices. So a request either succeeds or
 * the run stops.
 */
async function get(path, token, attempt = 1) {
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Accept-Language': 'de-DE,de;q=0.9',
      },
    })
  } catch (cause) {
    if (attempt >= 4) throw new Error(`${path}: ${cause.message}`, { cause })
    await sleep(attempt * 500)
    return get(path, token, attempt + 1)
  }

  if (response.status === 401) {
    fail(
      'The token was rejected (401). Sign in again and re-run with a fresh KB_TOKEN.',
    )
  }

  if (!response.ok) {
    if (attempt >= 4) throw new Error(`${path}: HTTP ${response.status}`)
    await sleep(attempt * 500)
    return get(path, token, attempt + 1)
  }

  return response.json()
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Map with a ceiling on requests in flight, preserving input order. */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let cursor = 0

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await fn(items[index], index)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  )
  return results
}

/* -------------------------------------------------------------------------- */
/* The sweep                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Every player of the competition, from the table's club list outward.
 *
 * The table is the only enumeration of clubs the API offers — there is no
 * `/competitions/{id}/teams` — and `teamprofile` is the only bulk source of a
 * club's squad. Both facts are load-bearing enough to be documented in
 * docs/api/competitions.md.
 */
async function fetchSquads(competitionId, token, concurrency) {
  const table = await get(`/v4/competitions/${competitionId}/table`, token)
  const teamIds = (table.it ?? []).map((row) => row.tid)
  if (teamIds.length === 0) fail('The competition table came back empty.')

  const squads = await mapLimit(teamIds, concurrency, (teamId) =>
    get(`/v4/competitions/${competitionId}/teams/${teamId}/teamprofile`, token),
  )

  const players = []
  for (const squad of squads) {
    for (const player of squad.it ?? []) {
      players.push({
        id: player.i,
        name: player.n,
        team: player.tid ?? squad.tid,
        pos: POSITION_BY_CODE[player.pos] ?? 'mid',
        image: player.pim,
      })
    }
  }
  return { teamCount: teamIds.length, players }
}

/**
 * One player's season, folded into `{ day → row }`.
 *
 * `p` is **absent rather than zero** for a match the player did not appear in,
 * which is the distinction that keeps a bench-warmer out of the ranking
 * instead of parking him on nought points alongside everyone else who did not
 * play.
 */
function rowsByDay(player, season) {
  const byDay = new Map()

  for (const fixture of season.ph ?? []) {
    if (typeof fixture.p !== 'number') continue
    if (fixture.mdst !== MATCHDAY_FINISHED) continue

    const events = fixture.k ?? []
    byDay.set(fixture.day, {
      id: player.id,
      name: player.name,
      team: player.team,
      pos: player.pos,
      points: fixture.p,
      minutes: Number.parseInt(fixture.mp ?? '0', 10) || 0,
      goals: events.filter((code) => code === EVENT_GOAL).length,
      assists: events.filter((code) => code === EVENT_ASSIST).length,
      matchId: fixture.mi,
      image: player.image,
    })
  }

  return byDay
}

/**
 * The season to read out of a performance response.
 *
 * `it[]` is oldest first and a player who has moved carries other clubs'
 * seasons in the earlier entries, so the last one is this season — but only
 * when the player has one at all. A summer signing with no Bundesliga history
 * still answers `it: []`.
 */
function currentSeason(performance) {
  const seasons = performance.it ?? []
  return seasons.length === 0 ? undefined : seasons[seasons.length - 1]
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

async function main() {
  const options = parseArgs(argv.slice(2))
  const token = env.KB_TOKEN

  if (token === undefined || token === '') {
    fail(
      'No KB_TOKEN in the environment.\n' +
        '    Sign in to Kickbase, take the bearer token, and run:\n' +
        '      KB_TOKEN=<token> npm run data:rankings',
    )
  }

  const { competitionId, outDir, concurrency, isDryRun, days } = options

  console.log(`\n  Competition ${competitionId}`)

  const schedule = await get(
    `/v4/competitions/${competitionId}/matchdays`,
    token,
  )
  const currentDay = schedule.day
  console.log(`  Current matchday: ${currentDay}`)

  const { teamCount, players } = await fetchSquads(
    competitionId,
    token,
    concurrency,
  )
  console.log(`  ${players.length} players across ${teamCount} clubs`)

  /*
   * One request per player, each answering the whole season. This is the
   * expensive half — a few hundred calls — and the reason the script rebuilds
   * every matchday in one pass rather than being run per matchday.
   */
  let done = 0
  const histories = await mapLimit(players, concurrency, async (player) => {
    const performance = await get(
      `/v4/competitions/${competitionId}/players/${player.id}/performance`,
      token,
    )
    done += 1
    if (done % 50 === 0) {
      process.stdout.write(`  … ${done}/${players.length} histories\r`)
    }
    return { player, season: currentSeason(performance) }
  })
  process.stdout.write(' '.repeat(40) + '\r')

  const season = histories.find((entry) => entry.season !== undefined)?.season

  /** day → rows, built once and sliced per file below. */
  const byDay = new Map()
  for (const { player, season: playerSeason } of histories) {
    if (playerSeason === undefined) continue
    for (const [day, row] of rowsByDay(player, playerSeason)) {
      const rows = byDay.get(day) ?? []
      rows.push(row)
      byDay.set(day, rows)
    }
  }

  /*
   * The current matchday is skipped even when it looks settled: the app has
   * the live endpoint for it, and a file that shadowed it would go stale the
   * moment a match kicked off.
   */
  const writable = [...byDay.keys()]
    .filter((day) => day < currentDay)
    .filter((day) => days === undefined || days.has(day))
    .sort((a, b) => a - b)

  if (writable.length === 0) {
    console.log('\n  Nothing to write — no settled matchday matched.\n')
    return
  }

  for (const day of writable) {
    const rows = byDay.get(day).sort((a, b) => b.points - a.points)
    const file = {
      competitionId,
      seasonId: season?.sid,
      season: season?.ti,
      day,
      generatedAt: new Date().toISOString(),
      playerCount: rows.length,
      players: rows,
    }

    const path = join(outDir, 'rankings', competitionId, `matchday-${day}.json`)
    const summary = `matchday ${String(day).padStart(2)} · ${String(rows.length).padStart(3)} players · best ${rows[0].name} ${rows[0].points}`

    if (isDryRun) {
      console.log(`  would write ${path} — ${summary}`)
      continue
    }

    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, `${JSON.stringify(file, null, 2)}\n`, 'utf8')
    console.log(`  ${path} — ${summary}`)
  }

  console.log(
    `\n  ${writable.length} file${writable.length === 1 ? '' : 's'} ${isDryRun ? 'planned' : 'written'}.\n`,
  )
}

await main()
