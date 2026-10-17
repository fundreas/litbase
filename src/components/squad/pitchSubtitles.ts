import { Clock3, Hash, Shield } from 'lucide-react'

import type { PlayerFigure, TeamFixture } from '@/api/models'
import type { PlateContent } from '@/components/squad/pitchMetrics'
import { PITCH_SUBTITLES, type PitchSubtitle } from '@/preferences/preferences'

/**
 * **What each mode is called**, on the button and in the tooltip the line it
 * governs carries — one table, so the control and the plate underneath can
 * never drift into describing different things. The same arrangement
 * [`VALUE_MODE`](./useValueMode.ts) uses for the squad list's two figures.
 *
 * The labels are nouns rather than sentences because the button is the size of
 * a chip on grass: *Punkte*, *Gegner*, *Anpfiff* name the three answers, and
 * the full question lives in the tooltip.
 */
export const PITCH_SUBTITLE = {
  points: {
    icon: Hash,
    label: 'Punkte',
    title: 'Punkte — erzielt, laufend oder erwartet',
  },
  opponent: {
    icon: Shield,
    label: 'Gegner',
    title: 'Gegner dieses Spieltags, mit Heim- oder Auswärtszeichen',
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
 * A **cycle**, not three buttons: the pitch's corner has room for one chip,
 * and the chip already names the state it is in — so a tap means "the next
 * answer" and three taps come back where you started. Three is about the
 * limit for that; a fourth would want a menu.
 */
export function nextPitchSubtitle(current: PitchSubtitle): PitchSubtitle {
  const index = PITCH_SUBTITLES.indexOf(current)
  return PITCH_SUBTITLES[(index + 1) % PITCH_SUBTITLES.length] as PitchSubtitle
}

/**
 * How tall a card's plate has to be budgeted for in this mode — see
 * {@link PlateContent}.
 *
 * **A crest is taller than a line of text**, and the card sizing is a search
 * that fits the busiest band exactly: a pitch budgeted for two text lines that
 * then drew a crest would push every band and clip the lot. So `opponent` asks
 * for the `full` budget wherever the pitch would otherwise have used the
 * cheaper one.
 *
 * It only ever raises the budget, never lowers it — the two squad pitches pass
 * `full` as their base and keep it in every mode. Lowering it would shrink the
 * floor those pitches are allowed to fall to (40px against 30px), so a cramped
 * screen could end up with *smaller* portraits for having switched to a
 * shorter line, which is nobody's idea of what that tap does.
 */
export function pitchSubtitlePlate(
  subtitle: PitchSubtitle,
  base: PlateContent,
): PlateContent {
  return subtitle === 'opponent' ? 'full' : base
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
