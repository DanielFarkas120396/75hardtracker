import { act, fireEvent, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { pokeLine } from '../../../content/microcopy'
import { freshDatabase } from '../../../db/__tests__/fixtures'
import { TASK_IDS } from '../../../logic/dayCompletion'
import type { Menace } from '../../../logic/menace'
import type { TaskId } from '../../../logic/types'
import { useDuck } from '../DuckHeader'

const completionOf = (missing: TaskId[]) =>
  Object.fromEntries(TASK_IDS.map((task) => [task, !missing.includes(task)])) as Record<TaskId, boolean>

const TAPPING: Menace = { level: 'tapping', reason: 'close' }

/** The duck and his caption, as the hero lays them out. */
function DuckHeader(props: Parameters<typeof useDuck>[0]) {
  const { duck, caption } = useDuck(props)
  return (
    <>
      {duck}
      {caption}
    </>
  )
}

describe('DuckHeader', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  afterEach(() => {
    vi.useRealTimers()
  })

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

  it('keeps his line up for good, in a live caption VoiceOver reads', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    render(<DuckHeader menace={TAPPING} missing={['reading']} completion={completionOf(['reading'])} dayNumber={3} onLunge={vi.fn()} />)
    const line = screen.getByText("Tick. Tock. You're cutting it close.")
    expect(line.closest('[aria-live="polite"]')).not.toBeNull()

    await act(async () => vi.advanceTimersByTime(60_000))
    expect(screen.getByText("Tick. Tock. You're cutting it close.")).toBeInTheDocument()
  })

  it('stops greeting once something is logged, and speaks up for an unfinished yesterday', () => {
    const calm = { menace: { level: 'watching', reason: 'plenty' } as Menace, missing: [...TASK_IDS], completion: completionOf([...TASK_IDS]), dayNumber: 3, name: 'Daniel', onLunge: vi.fn() }
    const { rerender } = render(<DuckHeader {...calm} started />)
    expect(screen.getByText('Started. Not finished.')).toBeInTheDocument()

    rerender(<DuckHeader {...calm} yesterdayOpen />)
    expect(screen.getByText("Yesterday's still open. Noon.")).toBeInTheDocument()
  })

  it("says the player's name when the day starts", () => {
    render(
      <DuckHeader
        menace={{ level: 'watching', reason: 'plenty' }}
        missing={[...TASK_IDS]}
        completion={completionOf([...TASK_IDS])}
        dayNumber={3}
        name="Daniel"
        onLunge={vi.fn()}
      />,
    )
    expect(screen.getByText("New day, Daniel. I'm watching.")).toBeInTheDocument()
  })

  it('shows an announcement pushed from outside', async () => {
    const props = { menace: TAPPING, missing: ['reading'] as TaskId[], completion: completionOf(['reading']), dayNumber: 3, onLunge: vi.fn() }
    const { rerender } = render(<DuckHeader {...props} />)
    rerender(<DuckHeader {...props} announcement={{ text: '22:30. Not a minute later.', reaction: 'relax', id: 1 }} />)
    expect(await screen.findByText('22:30. Not a minute later.')).toBeInTheDocument()
  })
})
