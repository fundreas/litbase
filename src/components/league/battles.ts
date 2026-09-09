import {
  ArrowLeftRight,
  Compass,
  Crown,
  Flame,
  Hand,
  Shield,
  ShieldCheck,
  Target,
  type LucideIcon,
} from 'lucide-react'

/**
 * **Battle icons by type code — the one thing about a battle that is ours.**
 *
 * A battle's name and its one-line description arrive worded by the API and
 * are printed as they come (see `BATTLE_LABEL` and `BATTLE_UNIT` in
 * [models](../../api/models.ts)); the glyph is mapped from the code, here, in
 * one place, because two screens draw the same battles and a battle should
 * look the same on both: the [Liga page](../../pages/LeaguePage.tsx)'s
 * *Wettkämpfe* rows and the chips over the
 * [battle standings](../ranking/BattleRankingTab.tsx) those rows open.
 *
 * The four position battles borrow the glyphs the rest of the app already uses
 * for a keeper, a defence, a midfield and an attack, so a row is recognisable
 * before its caption is read.
 *
 * The map is knowingly **incomplete** — the codes are the published spec's and
 * `3` has never been seen in a payload — so every lookup falls back to
 * {@link BATTLE_FALLBACK_ICON}.
 */
export const BATTLE_ICON: Record<number, LucideIcon> = {
  1: Crown,
  2: ArrowLeftRight,
  4: Hand,
  5: Shield,
  6: Compass,
  7: Target,
  8: Flame,
}

/**
 * What an unknown code draws: a medal rather than a hole in a row of icons. A
 * battle Kickbase adds next season should still read as a battle.
 */
export const BATTLE_FALLBACK_ICON: LucideIcon = ShieldCheck
