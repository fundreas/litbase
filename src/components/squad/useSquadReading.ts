import { CalendarDays, Coins } from 'lucide-react'
import { useState } from 'react'

import { readString, writeString } from '@/lib/storage'

/**
 * **What the right-hand end of a squad row is about.**
 *
 *  - `values` — the money. What he is worth, what that did overnight or since
 *    he was bought, and the one crest of his next opponent. The row every
 *    squad list has always drawn.
 *  - `fixtures` — the **next four opponents** instead, one crest per matchday.
 *
 * Two readings rather than one longer row, because they answer questions from
 * different weeks. *Is he worth selling before the morning* is asked at the
 * price; *has this squad drawn a kind month* is asked at the fixture list, and
 * it cannot be asked at all while each row carries a single crest — you would
 * be visiting twenty player pages to assemble it.
 *
 * They cannot sit side by side on a phone row: the four crests want about the
 * width the price and its delta take, which is exactly why this is a switch
 * and not an extra column.
 */
export type SquadReading = 'values' | 'fixtures'

const STORAGE_KEY = 'litbase.squad.reading'

/**
 * The choice, remembered across visits — and **shared by both squad lists**,
 * one's own and a rival's, for the same reason
 * [`useValueMode`](./useValueMode.ts) is: they are the same row read for the
 * same reason, and a reader who went looking for fixtures on his own Kader
 * did not mean "only here".
 *
 * Through the app's safe localStorage wrapper, so blocked storage costs a
 * remembered preference and nothing more.
 *
 * Not in the URL: a preference, not a place.
 */
export function useSquadReading(): [
  SquadReading,
  (next: SquadReading) => void,
] {
  const [reading, setReadingState] = useState<SquadReading>(
    () => (readString(STORAGE_KEY) as SquadReading | null) ?? 'values',
  )

  const setReading = (next: SquadReading) => {
    setReadingState(next)
    writeString(STORAGE_KEY, next)
  }

  return [reading, setReading]
}

/**
 * **What each reading is called**, on the button and in the tooltips the rows
 * carry — one table, so the control and the rows it governs can never drift
 * into describing different things. The arrangement
 * [`VALUE_MODE`](./useValueMode.ts) uses, next to which this button sits.
 */
export const SQUAD_READING = {
  values: {
    icon: Coins,
    label: 'Werte',
    title: 'Marktwert und Veränderung',
  },
  fixtures: {
    icon: CalendarDays,
    label: 'Spielplan',
    title: 'Die nächsten Gegner, ein Wappen je Spieltag',
  },
} as const satisfies Record<
  SquadReading,
  { icon: typeof Coins; label: string; title: string }
>
