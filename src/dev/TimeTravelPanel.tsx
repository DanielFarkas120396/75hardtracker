import { isTimeTravelling, TIME_TRAVEL_STOPS, timeTravelUrl } from './timeTravel'

/** Dev only (Settings → Developer): jump to any world of the climb, in a scratch copy of the app. */
export function TimeTravelPanel() {
  const travelling = isTimeTravelling()

  return (
    <section className="rounded-card bg-surface p-4 shadow-sm ring-1 ring-ink/10 dark:ring-0">
      <p className="text-sm text-ink-muted">
        Opens the app on that day, in a separate test copy: every earlier day done, today untouched. Your real data
        stays as it is. Only in the dev server.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {TIME_TRAVEL_STOPS.map((stop) => (
          <a
            key={`${stop.day}${stop.late ? '-late' : ''}`}
            href={timeTravelUrl(stop.day, stop.late)}
            className="flex min-h-touch flex-col justify-center rounded-2xl bg-world-soft px-3 py-2 font-rounded text-world-ink"
          >
            <span className="font-display text-lg leading-none tracking-wide">
              {stop.day > 75 ? 'Victory' : `Day ${stop.day}`}
            </span>
            <span className="text-xs font-bold text-ink-muted">{stop.label}</span>
          </a>
        ))}
      </div>
      {travelling && (
        <a
          href="/"
          className="mt-3 flex min-h-touch items-center justify-center rounded-2xl bg-canvas font-rounded font-bold text-ink"
        >
          Back to my real data
        </a>
      )}
    </section>
  )
}
