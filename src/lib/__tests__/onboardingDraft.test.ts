import { beforeEach, describe, expect, it } from 'vitest'
import { draftKey, loadDraft, saveDraft, type OnboardingDraft } from '../onboardingDraft'

const db = 'HardTrackerDB-test'
const draft: OnboardingDraft = { step: 'challenge', name: 'Dan', variant: null, why: '', startChoice: 'today', pickedDate: '' }

describe('onboardingDraft', () => {
  beforeEach(() => localStorage.clear())

  it('keeps a draft with no challenge picked yet', () => {
    saveDraft(db, draft)
    expect(loadDraft(db)).toEqual(draft)
  })

  it('still loads a draft saved before "no challenge" existed', () => {
    localStorage.setItem(draftKey(db), JSON.stringify({ ...draft, variant: 'hard' }))
    expect(loadDraft(db)).toEqual({ ...draft, variant: 'hard' })
  })

  it('ignores a draft with an unknown challenge', () => {
    localStorage.setItem(draftKey(db), JSON.stringify({ ...draft, variant: 'extreme' }))
    expect(loadDraft(db)).toBeNull()
  })
})
