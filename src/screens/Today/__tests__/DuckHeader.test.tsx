import { fireEvent, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { pokeLine } from '../../../content/microcopy'
import { freshDatabase } from '../../../db/__tests__/fixtures'
import { TASK_IDS } from '../../../logic/dayCompletion'
import type { Menace } from '../../../logic/menace'
import type { TaskId } from '../../../logic/types'
import { DuckHeader } from '../DuckHeader'

const completionOf = (missing: TaskId[]) =>
  Object.fromEntries(TASK_IDS.map((task) => [task, !missing.includes(task)])) as Record<TaskId, boolean>

const TAPPING: Menace = { level: 'tapping', reason: 'close' }

describe('DuckHeader', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it('says the line for his menace', () => {
    render(<DuckHeader menace={TAPPING} missing={['reading']} completion={completionOf(['reading'])} dayNumber={3} onLunge={vi.fn()} />)
    expect(screen.getByText("Tick. Tock. You're cutting it close.")).toBeInTheDocument()
  })

  it('answers a poke, and lunges on the third quick poke', async () => {
    const onLunge = vi.fn()
    render(<DuckHeader menace={TAPPING} missing={['reading']} completion={completionOf(['reading'])} dayNumber={3} onLunge={onLunge} />)
    const duck = screen.getByRole('button', { name: 'Poke the duck' })

    fireEvent.click(duck)
    expect(await screen.findByText('Hands off. Hands on your water bottle.')).toBeInTheDocument()

    fireEvent.click(duck)
    fireEvent.click(duck)
    expect(await screen.findByText("That's it.")).toBeInTheDocument()
    expect(onLunge).toHaveBeenCalledOnce()
  })

  it('glares when a task is unticked', async () => {
    const onLunge = vi.fn()
    const { rerender } = render(
      <DuckHeader menace={{ level: 'content', reason: 'done' }} missing={[]} completion={completionOf([])} dayNumber={3} onLunge={onLunge} />,
    )
    rerender(<DuckHeader menace={TAPPING} missing={['water']} completion={completionOf(['water'])} dayNumber={3} onLunge={onLunge} />)
    expect(await screen.findByText('I saw that.')).toBeInTheDocument()
  })

  it('does not glare when a new day starts', async () => {
    const onLunge = vi.fn()
    const { rerender } = render(
      <DuckHeader menace={{ level: 'content', reason: 'done' }} missing={[]} completion={completionOf([])} dayNumber={3} onLunge={onLunge} />,
    )
    rerender(
      <DuckHeader menace={{ level: 'watching', reason: 'plenty' }} missing={TASK_IDS} completion={completionOf([...TASK_IDS])} dayNumber={4} onLunge={onLunge} />,
    )
    // The findByText below is the real guard: a glare's line stays up for
    // 2.2s, well past this query's default timeout, so a wrongly fired
    // glare would still show "I saw that." here instead of the day's line.
    expect(await screen.findByText("New day. I'm watching.")).toBeInTheDocument()
    expect(screen.queryByText('I saw that.')).not.toBeInTheDocument()
  })

  it('returns to his menace line once a reaction line expires', async () => {
    render(<DuckHeader menace={TAPPING} missing={['reading']} completion={completionOf(['reading'])} dayNumber={3} onLunge={vi.fn()} />)
    const duck = screen.getByRole('button', { name: 'Poke the duck' })

    fireEvent.click(duck)
    expect(await screen.findByText(pokeLine(0))).toBeInTheDocument()

    // Real timers: faking setTimeout can freeze the AnimatePresence swap.
    expect(await screen.findByText("Tick. Tock. You're cutting it close.", undefined, { timeout: 3000 })).toBeInTheDocument()
  })

  it('shows an announcement pushed from outside', async () => {
    const props = { menace: TAPPING, missing: ['reading'] as TaskId[], completion: completionOf(['reading']), dayNumber: 3, onLunge: vi.fn() }
    const { rerender } = render(<DuckHeader {...props} />)
    rerender(<DuckHeader {...props} announcement={{ text: '22:30. Not a minute later.', reaction: 'relax', id: 1 }} />)
    expect(await screen.findByText('22:30. Not a minute later.')).toBeInTheDocument()
  })
})
