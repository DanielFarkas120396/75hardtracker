import { describe, expect, it } from 'vitest'
import { initialPhases, landedCount, phasesReducer, settling, type Completion } from '../boardPhases'

const none: Completion = { workouts: false, diet: false, water: false, reading: false, photo: false }
const waterDone: Completion = { ...none, water: true }

describe('board phases', () => {
  it('opens with done tasks as chips already', () => {
    expect(initialPhases(waterDone).water).toBe('chip')
    expect(initialPhases(waterDone).diet).toBe('tile')
  })

  it('without animation, a task that gets done is a chip at once', () => {
    const state = phasesReducer(initialPhases(none), { type: 'sync', completion: waterDone, animate: false })
    expect(state.water).toBe('chip')
  })

  it('with animation, a done task stays a tile until its fill is full, glows, then shrinks into its chip', () => {
    let state = phasesReducer(initialPhases(none), { type: 'sync', completion: waterDone, animate: true })
    expect(state.water).toBe('tile')
    state = phasesReducer(state, { type: 'full', task: 'water' })
    expect(state.water).toBe('full')
    state = phasesReducer(state, { type: 'morph', task: 'water' })
    expect(state.water).toBe('morphing')
    expect(settling(state, waterDone)).toBe(true)
    expect(landedCount(state)).toBe(0)
    state = phasesReducer(state, { type: 'landed', task: 'water' })
    expect(state.water).toBe('chip')
    expect(settling(state, waterDone)).toBe(false)
    expect(landedCount(state)).toBe(1)
  })

  it('turns any phase back into a tile when the task is undone', () => {
    for (const phase of ['full', 'morphing', 'chip'] as const) {
      const state = phasesReducer({ ...initialPhases(none), water: phase }, { type: 'sync', completion: none, animate: true })
      expect(state.water).toBe('tile')
    }
  })

  it('ignores events out of turn, and keeps the same state when nothing changes', () => {
    const state = initialPhases(none)
    expect(phasesReducer(state, { type: 'morph', task: 'water' })).toBe(state)
    expect(phasesReducer(state, { type: 'landed', task: 'water' })).toBe(state)
    expect(phasesReducer(state, { type: 'sync', completion: none, animate: true })).toBe(state)
  })
})
