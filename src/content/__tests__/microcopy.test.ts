import { describe, expect, it } from 'vitest'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { TASK_IDS } from '../../logic/dayCompletion'
import { mascotLine, taskCheer } from '../microcopy'

describe('taskCheer', () => {
  it('rotates, so consecutive days get different cheers', () => {
    for (const task of TASK_IDS) expect(taskCheer(task, 2)).not.toBe(taskCheer(task, 1))
  })

  it('has a cheer short enough for the one-line pill on every challenge day', () => {
    for (const task of TASK_IDS) {
      for (let day = 1; day <= CHALLENGE_LENGTH; day++) {
        const cheer = taskCheer(task, day)
        expect(cheer).toBeTruthy()
        expect(cheer.length).toBeLessThanOrEqual(28)
      }
    }
  })
})

describe('mascotLine', () => {
  it('cheers a perfect day', () => {
    expect(mascotLine([])).toMatch(/perfect day/i)
  })

  it('names the last task left', () => {
    expect(mascotLine(['photo'])).toMatch(/photo/)
    expect(mascotLine(['water'])).toMatch(/water/)
  })

  it('greets an untouched day, then counts progress', () => {
    expect(mascotLine(TASK_IDS)).toMatch(/let's go/i)
    expect(mascotLine(['water', 'reading'])).toBe('3 down, 2 to go!')
  })
})
