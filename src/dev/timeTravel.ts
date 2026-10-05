/**
 * Dev-only time travel: open the app on any day of the challenge, in a
 * separate scratch database, to see every Journey world (and the victory)
 * without waiting 75 days. Your real data is never touched.
 *
 * `?db=time-travel&travel=<day>` seeds that database before the app starts
 * (see seedTravelDay), then drops `travel` from the URL so a reload keeps the
 * day's progress. Production builds never call any of this.
 */

export const TIME_TRAVEL_DB = 'time-travel'

/**
 * The first day of each world, the last day, the victory (any day past 75),
 * and a morning with yesterday half logged (late logging, clock at 09:00).
 */
export const TIME_TRAVEL_STOPS: readonly { day: number; label: string; late?: boolean }[] = [
  { day: 1, label: 'Hell' },
  { day: 11, label: 'The Wasteland' },
  { day: 23, label: 'The Dark Forest' },
  { day: 38, label: 'The Meadows' },
  { day: 51, label: 'The Mountains' },
  { day: 65, label: 'Heaven' },
  { day: 75, label: 'The last day' },
  { day: 76, label: 'Victory' },
  { day: 12, label: 'Yesterday unfinished', late: true },
]

/** With `late`, yesterday is left half logged and the clock is frozen at 09:00 (`?now=`), before the noon cutoff. */
export function timeTravelUrl(day: number, late = false): string {
  return `/?db=${TIME_TRAVEL_DB}&travel=${day}${late ? '&late=1&now=09:00' : ''}`
}

export function isTimeTravelling(search = window.location.search): boolean {
  return new URLSearchParams(search).get('db') === TIME_TRAVEL_DB
}

/** Seeds the requested day, if the URL asks for one. Call before the app renders. */
export async function applyPendingTimeTravel(): Promise<void> {
  const params = new URLSearchParams(window.location.search)
  const day = Number(params.get('travel'))
  if (!params.has('travel') || !Number.isFinite(day) || !isTimeTravelling()) return

  const { seedTravelDay } = await import('./scenarios')
  await seedTravelDay(day, { yesterdayUnfinished: params.has('late') })
  params.delete('travel')
  params.delete('late')
  history.replaceState(null, '', `${window.location.pathname}?${params}`)
}
