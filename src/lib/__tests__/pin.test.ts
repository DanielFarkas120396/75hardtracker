import { describe, expect, it } from 'vitest'
import { FREE_ATTEMPTS, hashPin, isTooSimplePin, isValidPin, verifyPin, waitAfterFailures } from '../pin'

// Few rounds keep the tests fast; the app uses PIN_ITERATIONS.
const FAST = 1_000

describe('isValidPin', () => {
  it('takes exactly 6 digits', () => {
    expect(isValidPin('482915')).toBe(true)
    expect(isValidPin('48291')).toBe(false)
    expect(isValidPin('4829150')).toBe(false)
    expect(isValidPin('48a915')).toBe(false)
  })
})

describe('isTooSimplePin', () => {
  it('refuses repeated digits and straight runs, not ordinary PINs', () => {
    for (const pin of ['000000', '111111', '123456', '654321', '345678']) expect(isTooSimplePin(pin)).toBe(true)
    for (const pin of ['482915', '112233', '135791', '121212']) expect(isTooSimplePin(pin)).toBe(false)
  })
})

describe('hashPin / verifyPin', () => {
  it('never keeps the PIN itself, and recognises it again', async () => {
    const stored = await hashPin('482915', FAST)
    expect(JSON.stringify(stored)).not.toContain('482915')
    expect(await verifyPin('482915', stored)).toBe(true)
    expect(await verifyPin('482916', stored)).toBe(false)
    expect(await verifyPin('48291', stored)).toBe(false)
  })

  it('salts each PIN, so the same PIN never looks the same twice', async () => {
    const [a, b] = await Promise.all([hashPin('482915', FAST), hashPin('482915', FAST)])
    expect(a.hash).not.toBe(b.hash)
    expect(a.salt).not.toBe(b.salt)
  })
})

describe('waitAfterFailures', () => {
  it('lets 5 wrong PINs go, then makes you wait longer and longer', () => {
    expect(FREE_ATTEMPTS).toBe(5)
    expect(waitAfterFailures(4)).toBe(0)
    expect(waitAfterFailures(5)).toBe(30_000)
    expect(waitAfterFailures(6)).toBe(60_000)
    expect(waitAfterFailures(7)).toBe(300_000)
    expect(waitAfterFailures(8)).toBe(900_000)
    expect(waitAfterFailures(9)).toBe(3_600_000)
    expect(waitAfterFailures(30)).toBe(3_600_000)
  })
})
