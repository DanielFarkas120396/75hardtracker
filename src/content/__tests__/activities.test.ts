import { describe, expect, it } from 'vitest'
import { ICON_NAMES } from '../../components/icons/icons'
import { WORKOUT_TYPES } from '../../logic/constants'
import { ACTIVITY_ICONS, formatMinutes } from '../activities'

describe('activities', () => {
  it('gives every activity a logo of its own', () => {
    const icons = WORKOUT_TYPES.map((type) => ACTIVITY_ICONS[type])
    expect(new Set(icons).size).toBe(WORKOUT_TYPES.length)
    for (const icon of icons) expect(ICON_NAMES).toContain(icon)
  })

  it('reads training time like the Stats tile', () => {
    expect(formatMinutes(0)).toBe('0 min')
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(60)).toBe('1h 0m')
    expect(formatMinutes(535)).toBe('8h 55m')
  })
})
