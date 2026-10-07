import { useId, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { SAVE_FAILED_LINE } from '../../content/microcopy'
import { profileRepo } from '../../db/repositories/profileRepo'
import { useProfile } from '../../hooks/useProfile'
import { cleanText, isValidName, isValidWhy, NAME_MAX_LENGTH, WHY_MAX_LENGTH, type Profile } from '../../logic/profile'

/** Settings → Profile: the name the duck uses and the reason he quotes back. */
export function ProfileSection() {
  const profile = useProfile()
  return profile ? <ProfileForm profile={profile} /> : null
}

function ProfileForm({ profile }: { profile: Profile }) {
  const nameId = useId()
  const whyId = useId()
  const [name, setName] = useState(profile.name)
  const [why, setWhy] = useState(profile.why)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const changed = cleanText(name) !== profile.name || cleanText(why) !== profile.why
  const valid = isValidName(name) && isValidWhy(why)

  const save = async () => {
    setSaving(true)
    try {
      const result = await profileRepo.save({ name, why })
      setStatus(result.ok ? 'Saved.' : SAVE_FAILED_LINE)
    } catch {
      setStatus(SAVE_FAILED_LINE)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-card bg-surface p-4 ring-1 ring-ink/10 dark:ring-0">
      <h2 className="font-rounded text-lg font-bold text-ink">Profile</h2>

      <label htmlFor={nameId} className="mt-3 block font-rounded text-sm font-bold text-ink">
        Name
      </label>
      <input
        id={nameId}
        type="text"
        value={name}
        maxLength={NAME_MAX_LENGTH}
        autoComplete="given-name"
        onChange={(e) => {
          setName(e.target.value)
          setStatus(null)
        }}
        className="mt-1 min-h-touch w-full rounded-xl bg-canvas px-3 font-rounded font-bold text-ink"
      />
      <p className="mt-1 text-xs text-ink-muted">Up to {NAME_MAX_LENGTH} characters.</p>

      <label htmlFor={whyId} className="mt-3 block font-rounded text-sm font-bold text-ink">
        Why you're doing this
      </label>
      <textarea
        id={whyId}
        rows={2}
        value={why}
        maxLength={WHY_MAX_LENGTH}
        onChange={(e) => {
          setWhy(e.target.value)
          setStatus(null)
        }}
        className="mt-1 w-full resize-none rounded-xl bg-canvas p-3 font-rounded font-bold text-ink"
      />

      <Button
        variant="secondary"
        className="mt-3 w-full"
        onClick={() => void save()}
        disabled={saving || !changed || !valid}
      >
        {saving ? 'Saving…' : 'Save'}
      </Button>
      {status && (
        <p role="status" className="mt-2 text-sm font-semibold text-ink-muted">
          {status}
        </p>
      )}
    </section>
  )
}
