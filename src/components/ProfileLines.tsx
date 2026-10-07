import { useProfile } from '../hooks/useProfile'

interface LineProps {
  className?: string
}

/** "Hey {name}": the first line of Today's header. Nothing without a profile. */
export function Greeting({ className = '' }: LineProps) {
  const profile = useProfile()
  if (!profile) return null
  return <p className={`font-rounded text-sm font-bold text-ink ${className}`}>Hey {profile.name}</p>
}

/** The player's reason, quoted: a discreet daily reminder on Today. Nothing without a profile. */
export function WhyQuote({ className = '' }: LineProps) {
  const profile = useProfile()
  if (!profile) return null
  return <p className={`line-clamp-2 font-rounded text-sm italic text-ink-muted ${className}`}>“{profile.why}”</p>
}

/** "You said: “…”": the reason, quoted back at a hard moment. Nothing without a profile. */
export function YouSaid({ className = '' }: LineProps) {
  const profile = useProfile()
  if (!profile) return null
  return <p className={`font-rounded text-sm italic text-ink-muted ${className}`}>You said: “{profile.why}”</p>
}
