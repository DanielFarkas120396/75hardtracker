import { dailyRuleLines, DAY_END_LINE, NO_REMINDERS_LINE, stakesLine } from '../../content/variants'
import type { Challenge } from '../../db/types'
import { rulesFor } from '../../logic/rulesets'

/** The attempt's rules, in the deal's words, for checking them after onboarding. */
export function RulesSection({ challenge }: { challenge: Challenge }) {
  const rules = rulesFor(challenge)
  return (
    <section className="flex flex-col gap-4 rounded-card bg-surface p-4 ring-1 ring-ink/10 dark:ring-0">
      <div>
        <h2 className="font-rounded font-bold text-ink">Every day</h2>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-muted marker:text-world-ink">
          {dailyRuleLines(rules).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <Rule title="Missing a day">{stakesLine(rules)}</Rule>
      <Rule title="When a day ends">{DAY_END_LINE}</Rule>
      <Rule title="Reminders">{NO_REMINDERS_LINE}</Rule>
    </section>
  )
}

function Rule({ title, children }: { title: string; children: string }) {
  return (
    <div>
      <h2 className="font-rounded font-bold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-ink-muted">{children}</p>
    </div>
  )
}
