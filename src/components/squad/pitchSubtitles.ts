import { Clock3, Hash } from 'lucide-react'

import type { PlayerFigure, TeamFixture } from '@/api/models'
import { PITCH_SUBTITLES, type PitchSubtitle } from '@/preferences/preferences'

/**
 * **What each mode is called**, on the button and in the tooltip the line it
 * governs carries — one table, so the control and the plate underneath can
 * never drift into describing different things. The same arrangement
 * [`VALUE_MODE`](./useValueMode.ts) uses for the squad list's two figures.
 *
 * The labels are nouns rather than sentences because the button is the size of
 * a chip on grass: *Punkte* and *Anpfiff* name the two answers that can share
 * the line with the crest, and the full question lives in the tooltip.
 */
export const PITCH_SUBTITLE = {
  points: {
    icon: Hash,
    label: 'Punkte',
    title: 'Punkte — erzielt, laufend oder erwartet',
  },
  kickoff: {
    icon: Clock3,
    label: 'Anpfiff',
    title: 'Anpfiff — die Uhrzeit heute, sonst der Wochentag',
  },
} as const satisfies Record<
  PitchSubtitle,
  { icon: typeof Hash; label: string; title: string }
>

/**
 * The next mode in the ring.
 *
 * Two readings, so this is a plain toggle — written as a cycle all the same,
 * because the corner has room for one chip either way and the chip names the
 * state it is in. A third reading would slot in here without touching the
 * button; it is the *plate* that has no room for one, not this.
 */
export function nextPitchSubtitle(current: PitchSubtitle): PitchSubtitle {
  const index = PITCH_SUBTITLES.indexOf(current)
  return PITCH_SUBTITLES[(index + 1) % PITCH_SUBTITLES.length] as PitchSubtitle
}

/**
 * The figure for a pitch that has **no points to show at all** — the squad's
 * own [lineup editor](./LineupTab.tsx), which is a screen about the matchday
 * to come.
 *
 * Its players carry a [`TeamFixture`](../../api/models.ts) rather than the
 * matchday fixture [`playerFigure`](../../api/models.ts) reads, and no
 * matchday score of any kind, so there is nothing for that function to decide:
 * the answer is the kick-off where there is a match and nothing where there is
 * not. Expected points still outrank it, exactly as they do on the read-only
 * pitches — see [`PitchSubtitleLine`](./PitchSubtitle.tsx).
 */
export function upcomingFigure(fixture: TeamFixture | undefined): PlayerFigure {
  if (fixture === undefined) return { kind: 'unknown' }
  return { kind: 'kickoff', kickoff: fixture.kickoff }
}
