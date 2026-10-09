#!/usr/bin/env node
/**
 * Build `public/ligainsider.json`: every Bundesliga player's and club's page
 * on ligainsider.de, keyed by Kickbase id.
 *
 *   npm run ligainsider
 *
 * Why a static file: ligainsider sends no CORS headers, so the browser cannot
 * read the site, and this app has no server to read it from. What it *can* do
 * is link out — and for that it only needs to know which ligainsider page is
 * which Kickbase player. That is the whole job here.
 *
 * Where the ids come from:
 *
 *  - **Kickbase** — the pointcast player index, which carries every Bundesliga
 *    player's id, last name and club id. No token, no league, and no need to
 *    know which league the user is in.
 *  - **ligainsider** — the eighteen squad pages (`/<club>/<id>/kader/`). The
 *    first one is a fixed seed; the other seventeen are discovered from its
 *    club navigation, so a promoted club turns up by itself next summer.
 *
 * Neither site knows the other's ids, so the join is by **name within club**:
 *
 *  1. Clubs are paired by how many last names their squads share. Eighteen
 *     clubs, a one-to-one pairing, and a mistake would show as a club with a
 *     handful of matches rather than twenty-odd.
 *  2. Within a pair, a Kickbase last name is matched against the end of the
 *     ligainsider full name, both folded to plain ASCII (`Pavlović` →
 *     `pavlovic`). A name that fits exactly one ligainsider player is a match;
 *     none or several is reported, and `overrides.json` settles it by hand.
 *
 * The run prints what it could not pair, so a transfer window's new arrivals
 * are one read of the output away from being fixed. Nothing fails silently —
 * a club that pairs badly, or a squad page that stops parsing, exits non-zero.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const LIGAINSIDER = 'https://www.ligainsider.de'
/** The squad page the club list is discovered from. Any Bundesliga club does. */
const SEED_SQUAD_PATH = '/fc-bayern-muenchen/1/kader/'
const POINTCAST_PLAYERS =
  'https://fundreas.github.io/litbase-pointcast/v1/players/index.json'
/** A pause between squad pages — eighteen requests, no reason to burst them. */
const PAUSE_MS = 500
/** Below this many shared names a club pairing is not trusted. */
const MIN_SHARED_NAMES = 8

const here = dirname(fileURLToPath(import.meta.url))
const OUT_FILE = resolve(here, '../../public/ligainsider.json')
const OVERRIDES_FILE = resolve(here, 'overrides.json')

const USER_AGENT =
  'litbase (https://github.com/fundreas/litbase; builds a link table, once per transfer window)'

/* -------------------------------------------------------------------------- */
/* Fetching                                                                   */
/* -------------------------------------------------------------------------- */

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) {
    throw new Error(`${url}: HTTP ${String(response.status)}`)
  }
  return response.text()
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

/* -------------------------------------------------------------------------- */
/* ligainsider                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The club navigation on every squad page: one `/<slug>/<id>/kader/` link per
 * Bundesliga club. Exactly the eighteen — the 2. Bundesliga has its own pages.
 */
function parseClubLinks(html) {
  const clubs = new Map()
  for (const match of html.matchAll(/href="\/([a-z0-9-]+)\/(\d+)\/kader\/"/g)) {
    clubs.set(match[2], { id: match[2], slug: match[1] })
  }
  return [...clubs.values()]
}

/**
 * The squad: one `<a href="/<slug>_<id>/"><img class="img-circle" … alt="Full
 * Name">` per player. The `alt` is the name as ligainsider spells it, which is
 * the one to match against — the slug has already lost its diacritics.
 */
function parseSquad(html) {
  const players = new Map()
  const pattern =
    /<a href="\/([a-z0-9-]+_(\d+))\/"><img class="img-circle"[^>]*\balt="([^"]+)"/g
  for (const match of html.matchAll(pattern)) {
    players.set(match[2], {
      id: match[2],
      path: match[1],
      name: decode(match[3]),
    })
  }
  return [...players.values()]
}

/**
 * The club's name: the `<h2>` under the page's `KADER` heading.
 *
 * Not the `<title>`, and not `og:title` or the canonical link either — all
 * three name a *different* club on most squad pages (the Augsburg squad is
 * titled "Eintracht Frankfurt", eight clubs came back as "VfL Wolfsburg"),
 * presumably a server-side cache that keys the head on something other than
 * the club. The body is right; the heading in it is the name.
 */
function parseClubName(html) {
  const match = /<h1[^>]*>KADER<\/h1>\s*<h2[^>]*>([^<]+)<\/h2>/.exec(html)
  return match === null ? undefined : decode(match[1].trim())
}

function decode(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&uuml;/g, 'ü')
    .replace(/&ouml;/g, 'ö')
    .replace(/&auml;/g, 'ä')
    .replace(/&szlig;/g, 'ß')
}

/* -------------------------------------------------------------------------- */
/* Matching                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A name as the two sites can agree on it: lower case, no diacritics, letters
 * only. `Pavlović`, `Pavlovic` and `PAVLOVIĆ` are one key.
 *
 * `ø`, `ł` and `đ` have no decomposition, so they are spelled out by hand.
 */
function fold(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ø/gi, 'o')
    .replace(/ł/gi, 'l')
    .replace(/đ/gi, 'd')
    .replace(/æ/gi, 'ae')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
}

/**
 * Does a Kickbase last name fit a ligainsider full name?
 *
 * Kickbase's `name` is the last name — sometimes two words (`van de Ven`),
 * sometimes the one a player goes by (`Luis Díaz` → `Díaz`). ligainsider's is
 * the full name. So: the full name, folded, ends with the last name, folded.
 * `olise` fits `michaelolise`; `diaz` fits `luisdiaz`; `kim` does *not* fit
 * `joshuakimmich`, because the match is anchored at the end.
 */
function fits(lastName, fullName) {
  const needle = fold(lastName)
  if (needle === '') return false
  return fold(fullName).endsWith(needle)
}

/**
 * The looser fit, for the names {@link fits} misses: the Kickbase name is one
 * *word* of the ligainsider name, wherever it stands. `Minjae` is on Kickbase's
 * shirt and ligainsider writes `Minjae Kim`; `Amaimouni` is the first half of
 * `A. Amaimouni-Echghouyab`. Word by word, so `Kim` still does not fit
 * `Kimmich`. Used for players only — the club pairing stays on the strict fit,
 * where a false positive would cost more than a miss.
 */
function fitsLoosely(lastName, fullName) {
  const needle = fold(lastName)
  if (needle === '') return false
  return fullName
    .split(/[\s-]+/)
    .map(fold)
    .some((word) => word === needle)
}

/**
 * Pair each Kickbase club with the ligainsider club whose squad shares the most
 * last names with it. Greedy, highest overlap first, each ligainsider club
 * taken once — so a second club that would also like the same squad gets its
 * next best, and a pairing below {@link MIN_SHARED_NAMES} is an error rather
 * than a guess.
 */
function pairClubs(kickbaseClubs, ligainsiderClubs) {
  const candidates = []
  for (const [kbTeamId, kbPlayers] of kickbaseClubs) {
    for (const club of ligainsiderClubs) {
      let shared = 0
      for (const kbPlayer of kbPlayers) {
        if (club.players.some((player) => fits(kbPlayer.name, player.name))) {
          shared += 1
        }
      }
      candidates.push({ kbTeamId, club, shared })
    }
  }
  candidates.sort((a, b) => b.shared - a.shared)

  const pairs = new Map()
  const taken = new Set()
  for (const { kbTeamId, club, shared } of candidates) {
    if (pairs.has(kbTeamId) || taken.has(club.id)) continue
    if (shared < MIN_SHARED_NAMES) {
      throw new Error(
        `Kickbase club ${kbTeamId} shares only ${String(shared)} names with its best ligainsider match (${club.slug}) — not pairing it`,
      )
    }
    pairs.set(kbTeamId, { club, shared })
    taken.add(club.id)
  }
  return pairs
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

async function main() {
  const overrides = JSON.parse(await readFile(OVERRIDES_FILE, 'utf8'))

  console.log('pointcast: reading the player index')
  const index = JSON.parse(await fetchText(POINTCAST_PLAYERS))
  const kickbasePlayers = index.players.filter(
    (player) =>
      typeof player.playerId === 'string' &&
      typeof player.name === 'string' &&
      typeof player.teamId === 'string',
  )
  const kickbaseClubs = new Map()
  for (const player of kickbasePlayers) {
    const list = kickbaseClubs.get(player.teamId) ?? []
    list.push(player)
    kickbaseClubs.set(player.teamId, list)
  }
  console.log(
    `  ${String(kickbasePlayers.length)} players in ${String(kickbaseClubs.size)} clubs`,
  )

  console.log('ligainsider: reading the squad pages')
  const seed = await fetchText(`${LIGAINSIDER}${SEED_SQUAD_PATH}`)
  const clubLinks = parseClubLinks(seed)
  if (clubLinks.length !== 18) {
    throw new Error(
      `expected 18 clubs in the navigation, found ${String(clubLinks.length)}`,
    )
  }

  const ligainsiderClubs = []
  for (const link of clubLinks) {
    const path = `/${link.slug}/${link.id}/kader/`
    const html =
      path === SEED_SQUAD_PATH ? seed : await fetchText(`${LIGAINSIDER}${path}`)
    const players = parseSquad(html)
    if (players.length < 15) {
      throw new Error(
        `${path}: only ${String(players.length)} players parsed — has the markup changed?`,
      )
    }
    const name = parseClubName(html) ?? link.slug
    ligainsiderClubs.push({ ...link, name, players })
    console.log(`  ${name}: ${String(players.length)} players`)
    if (path !== SEED_SQUAD_PATH) await sleep(PAUSE_MS)
  }

  console.log('pairing clubs')
  const pairs = pairClubs(kickbaseClubs, ligainsiderClubs)
  const teams = {}
  for (const [kbTeamId, { club, shared }] of pairs) {
    teams[kbTeamId] = {
      id: club.id,
      path: `${club.slug}/${club.id}`,
      name: club.name,
    }
    console.log(
      `  Kickbase ${kbTeamId.padStart(2)} → ${club.name} (${String(shared)} of ${String(kickbaseClubs.get(kbTeamId).length)} names)`,
    )
  }

  console.log('matching players')
  const players = {}
  const unmatched = []
  const ambiguous = []
  for (const kbPlayer of kickbasePlayers) {
    const override = overrides[kbPlayer.playerId]
    const club = pairs.get(kbPlayer.teamId)?.club
    const allLigainsider = ligainsiderClubs.flatMap((entry) => entry.players)

    if (override !== undefined) {
      const player = allLigainsider.find(
        (entry) => entry.id === String(override),
      )
      if (player === undefined) {
        throw new Error(
          `overrides.json: Kickbase ${kbPlayer.playerId} (${kbPlayer.name}) points at ligainsider ${String(override)}, which is on no squad page`,
        )
      }
      players[kbPlayer.playerId] = { id: player.id, path: player.path }
      continue
    }

    const squad = club?.players ?? []
    let fitting = squad.filter((player) => fits(kbPlayer.name, player.name))
    if (fitting.length === 0) {
      fitting = squad.filter((player) =>
        fitsLoosely(kbPlayer.name, player.name),
      )
    }
    if (fitting.length === 1) {
      players[kbPlayer.playerId] = { id: fitting[0].id, path: fitting[0].path }
    } else if (fitting.length === 0) {
      unmatched.push(kbPlayer)
    } else {
      ambiguous.push({ kbPlayer, fitting })
    }
  }

  const matched = Object.keys(players).length
  console.log(
    `  ${String(matched)} of ${String(kickbasePlayers.length)} players matched`,
  )
  if (unmatched.length > 0) {
    console.log(
      `\n${String(unmatched.length)} without a match — add to overrides.json if they are on ligainsider under another name:`,
    )
    for (const player of unmatched) {
      const club = pairs.get(player.teamId)?.club
      console.log(
        `  ${player.playerId.padStart(5)}  ${player.name.padEnd(22)} ${club?.name ?? player.teamId}`,
      )
    }
  }
  if (ambiguous.length > 0) {
    console.log(
      `\n${String(ambiguous.length)} ambiguous — pick one in overrides.json:`,
    )
    for (const { kbPlayer, fitting } of ambiguous) {
      console.log(
        `  ${kbPlayer.playerId.padStart(5)}  ${kbPlayer.name.padEnd(22)} ${fitting.map((player) => `${player.name} (${player.id})`).join(', ')}`,
      )
    }
  }

  const out = {
    generatedAt: new Date().toISOString(),
    baseUrl: LIGAINSIDER,
    teams,
    players,
  }
  await mkdir(dirname(OUT_FILE), { recursive: true })
  await writeFile(OUT_FILE, `${JSON.stringify(out, null, 1)}\n`)
  console.log(`\nwrote ${OUT_FILE}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
