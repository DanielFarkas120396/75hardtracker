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

/** The first day of each world, the last day, and the victory (any day past 75). */
export const TIME_TRAVEL_STOPS: readonly { day: number; label: string }[] = [
  { day: 1, label: 'Hell' },
  { day: 11, label: 'The Wasteland' },
  { day: 23, label: 'The Dark Forest' },
  { day: 38, label: 'The Meadows' },
  { day: 51, label: 'The Mountains' },
  { day: 65, label: 'Heaven' },
  { day: 75, label: 'The last day' },
  { day: 76, label: 'Victory' },
]

export function timeTravelUrl(day: number): string {
  return `/?db=${TIME_TRAVEL_DB}&travel=${day}`
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
  await seedTravelDay(day)
  params.delete('travel')
  history.replaceState(null, '', `${window.location.pathname}?${params}`)
}
