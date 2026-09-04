import { FlaskConical } from 'lucide-react'
import { useEffect, useState } from 'react'

import { activeSimulation, isSimulationEnabled } from '@/dev/simulation'
import { cn } from '@/lib/cn'
import { isClockShifted, nowMs } from '@/lib/clock'
import { time, weekdayDate } from '@/lib/format'

/** The badge re-reads the clock this often, so it visibly ticks. */
const TICK_MS = 1000

/**
 * "This app is not living in real time" — a chip in the header, dev only.
 *
 * The [live profile](./simulation.ts) shows real players with real points from
 * a matchday that finished days ago, dressed as a match in progress. That is
 * exactly convincing enough to be mistaken for a real result an hour later, so
 * the app says so while it is doing it. It renders `null` in every normal
 * `npm run dev` session and in every build.
 *
 * It ticks once a second, which is not decoration: watching the simulated
 * clock advance is how you confirm the thing is running, and the tick is also
 * what makes the chip pick up the matchday once the fixture list has landed
 * (the simulation is module state, not React state — nothing here subscribes
 * to it).
 */
export function SimulationBadge() {
  const isEnabled = isSimulationEnabled() || isClockShifted()
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!isEnabled) return
    const id = setInterval(() => {
      setTick((value) => value + 1)
    }, TICK_MS)
    return () => {
      clearInterval(id)
    }
  }, [isEnabled])

  if (!isEnabled) return null

  const simulation = activeSimulation()
  const at = new Date(nowMs()).toISOString()

  const title = [
    simulation === null
      ? 'Die Uhr der App ist verschoben (VITE_NOW).'
      : `Live-Entwicklungsprofil: Spieltag ${String(simulation.day)} wird als laufend simuliert, gestartet ${String(simulation.minute)} Minuten nach dem ersten Anpfiff.`,
    `App-Zeit: ${weekdayDate(at)} · ${time(at)}.`,
    'Punkte und Spiele sind echt, der Zeitpunkt ist es nicht.',
  ].join(' ')

  return (
    <span
      title={title}
      className={cn(
        'nums flex shrink-0 items-center gap-1 rounded-full border px-2 py-1',
        'border-warning/40 bg-warning/10 text-[0.6875rem] font-semibold text-warning',
      )}
    >
      <FlaskConical size={12} aria-hidden="true" className="shrink-0" />
      <span className="sr-only">Simulierte Zeit. </span>
      {simulation !== null && (
        <span aria-hidden="true">{simulation.day}. ST</span>
      )}
      {time(at)}
    </span>
  )
}
