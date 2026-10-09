import { TASK_IDS } from '../../../logic/dayCompletion'
import type { TaskId } from '../../../logic/types'

/** Where a task is on the board: an open tile, a full tile about to go, shrinking into its chip, or a chip. */
export type Phase = 'tile' | 'full' | 'morphing' | 'chip'
export type Phases = Record<TaskId, Phase>
export type Completion = Record<TaskId, boolean>

export type PhaseEvent =
  /** The day changed. Without animation a done task is a chip at once; with it, it waits for its fill. */
  | { type: 'sync'; completion: Completion; animate: boolean }
  /** A done task's fill has filled its tile. */
  | { type: 'full'; task: TaskId }
  /** The full tile's glow is over: it starts shrinking into its chip. */
  | { type: 'morph'; task: TaskId }
  | { type: 'landed'; task: TaskId }

/** Opening the board: done tasks are chips already, and nothing animates. */
export function initialPhases(completion: Completion): Phases {
  return Object.fromEntries(TASK_IDS.map((task) => [task, completion[task] ? 'chip' : 'tile'])) as Phases
}

export function phasesReducer(state: Phases, event: PhaseEvent): Phases {
  const next = { ...state }
  switch (event.type) {
    case 'sync':
      for (const task of TASK_IDS) {
        if (!event.completion[task]) next[task] = 'tile'
        else if (!event.animate) next[task] = 'chip'
      }
      break
    case 'full':
      if (state[event.task] === 'tile') next[event.task] = 'full'
      break
    case 'morph':
      if (state[event.task] === 'full') next[event.task] = 'morphing'
      break
    case 'landed':
      if (state[event.task] === 'morphing') next[event.task] = 'chip'
      break
  }
  return TASK_IDS.every((task) => next[task] === state[task]) ? state : next
}

/** Chips on the board: what the gauge counts. */
export const landedCount = (phases: Phases) => TASK_IDS.filter((task) => phases[task] === 'chip').length

/** Some done task hasn't reached its chip yet: "Day complete!" waits. */
export const settling = (phases: Phases, completion: Completion) => TASK_IDS.some((task) => completion[task] && phases[task] !== 'chip')
