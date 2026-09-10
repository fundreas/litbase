import type { ReactNode } from 'react'

import type { TeamFixture } from '@/api/models'
import { ExpectedPointsDialog } from '@/components/squad/ExpectedPointsDialog'
import { useHashModal } from '@/lib/useHashModal'

/**
 * **A player, as the expected-points sheet needs him** — the least any list
 * has to supply to let a guess be entered against one of its rows.
 *
 * Deliberately not `SquadMember`. The same guess is entered from three lists
 * built on three different payloads: one's own squad, a
 * [rival's](../manager/ManagerSquadTab.tsx) — which carries no first name —
 * and a [club's](../team/TeamSquadTab.tsx), which carries one full name and no
 * season total. What they have in common is an id, something to put in the
 * title, and the two figures a guess is calibrated against; everything else
 * the sheet asks for is optional and simply left out where a payload has no
 * answer.
 */
export interface ExpectedPointsSubject {
  id: string
  /** Whatever the list calls him — the sheet's title, verbatim. */
  name: string
  /** Season average, when the payload has one. */
  averagePoints?: number
  /** Season total, when the payload has one. */
  totalPoints?: number
  /** His club's fixture this matchday, or `undefined` on a bye. */
  fixture?: TeamFixture
}

/**
 * **The expected-points sheet, wherever a list of players is shown.**
 *
 * One hook rather than three copies of the same twelve lines: the sheet is
 * addressed as `#expected:<playerId>` through
 * [`useHashModal`](../../lib/useHashModal.ts), so opening it is a navigation
 * and every list that has players can offer it — one's own squad, a rival's
 * Kader, a club's roster.
 *
 * The caller supplies **`resolve`**, which turns the id in the hash back into
 * a player. That is what makes the URL survive a refresh: the sheet reopens
 * from an id alone, against whatever the list has since re-fetched, and closes
 * itself quietly when the id names nobody the list holds any more — a player
 * sold out of the squad the link was made from.
 *
 * Returns the opener for the rows and the sheet to render. The sheet is a
 * node rather than something the hook mounts itself, so it lands in the
 * caller's tree where a dialog belongs.
 */
export function useExpectedPointsSheet({
  matchday,
  resolve,
}: {
  /** The matchday the guess is filed under; `undefined` while it loads. */
  matchday: number | undefined
  resolve: (playerId: string) => ExpectedPointsSubject | undefined
}): { open: (playerId: string) => void; sheet: ReactNode } {
  const modal = useHashModal('expected')
  const player = modal.id === undefined ? undefined : resolve(modal.id)

  return {
    open: (playerId: string) => {
      modal.open(playerId)
    },
    /* `key` per player: the figure in the field is seeded once, at mount, so
       opening the sheet on a second player has to be a second component. It
       waits for the matchday number — the guess is filed under it — which
       arrives with the fixtures the sheet also names. */
    sheet:
      modal.isOpen && player !== undefined && matchday !== undefined ? (
        <ExpectedPointsDialog
          key={player.id}
          player={player}
          matchday={matchday}
          onClose={modal.close}
        />
      ) : null,
  }
}
