import { Clock3, HandCoins } from 'lucide-react'
import { useState } from 'react'

import { readString, writeString } from '@/lib/storage'

/**
 * **Which second figure a squad row puts under the market value.**
 *
 *  - `day` — what it moved overnight (`tfhmvt`). Who is climbing, who is
 *    bleeding value and should go on the market before the morning.
 *  - `profit` — what the player has made since he was bought (`mvgl`). Whether
 *    selling him today would book a gain or crystallise a loss.
 *
 * Two different questions about the same euro, both asked at the same place on
 * the row, and neither of them fits beside the other: the row has one line
 * under the price and a second figure there would make the pair a puzzle
 * rather than an answer.
 */
export type ValueMode = 'day' | 'profit'

const STORAGE_KEY = 'litbase.squad.valueMode'

/**
 * The choice, remembered across visits — and **shared by every squad list**,
 * one's own and a rival's, because they are the same row read for the same
 * reason and a reader who picked "seit Kauf" on his own Kader did not mean
 * "only here".
 *
 * Through the app's safe localStorage wrapper, like the
 * [list/grid view](./PlayerListTab.tsx): it is exactly the kind of value that
 * may not be writable — private mode, blocked storage — and failing to
 * remember a preference must never be worse than not having one.
 *
 * Not in the URL: a preference, not a place.
 */
export function useValueMode(): [ValueMode, (mode: ValueMode) => void] {
  const [mode, setModeState] = useState<ValueMode>(
    () => (readString(STORAGE_KEY) as ValueMode | null) ?? 'day',
  )

  const setMode = (next: ValueMode) => {
    setModeState(next)
    writeString(STORAGE_KEY, next)
  }

  return [mode, setMode]
}

/**
 * **What each mode is called**, on the button and in the tooltip the figure
 * itself carries — one table, so the control and the number it governs can
 * never drift into describing different things.
 */
export const VALUE_MODE = {
  day: {
    icon: Clock3,
    label: '24 h',
    title: 'Marktwertänderung der letzten 24 Stunden',
    srHint: ' in den letzten 24 Stunden',
  },
  profit: {
    icon: HandCoins,
    label: 'seit Kauf',
    title: 'Gewinn oder Verlust seit dem Kauf',
    srHint: ' seit dem Kauf',
  },
} as const satisfies Record<
  ValueMode,
  { icon: typeof Clock3; label: string; title: string; srHint: string }
>
