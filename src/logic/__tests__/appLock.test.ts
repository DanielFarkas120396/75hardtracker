import { describe, expect, it } from 'vitest'
import { sameHash, shouldRelock, wrongPinLine } from '../appLock'

describe('the app lock rules', () => {
  it('counts the tries left, then says nothing once the wait starts', () => {
    expect(wrongPinLine(1)).toBe('Wrong PIN. 4 tries left before a wait.')
    expect(wrongPinLine(4)).toBe('Wrong PIN. 1 try left before a wait.')
    expect(wrongPinLine(5)).toBeNull()
  })

  it('compares fingerprints whole', () => {
    expect(sameHash('abc', 'abc')).toBe(true)
    expect(sameHash('abc', 'abd')).toBe(false)
    expect(sameHash('abc', 'abcd')).toBe(false)
  })

  it('locks again only after more than a minute away', () => {
    expect(shouldRelock(null, 100_000)).toBe(false)
    expect(shouldRelock(0, 60_000)).toBe(false)
    expect(shouldRelock(0, 60_001)).toBe(true)
  })
})
