import { act, fireEvent, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { pokeLine } from '../../../content/microcopy'
import { freshDatabase } from '../../../db/__tests__/fixtures'
import { TASK_IDS } from '../../../logic/dayCompletion'
import type { Menace } from '../../../logic/menace'
import type { TaskId } from '../../../logic/types'
import { CATCHPHRASES } from '../../../content/microcopy'
import { CHATTER_MAX_MS, FIRST_LINE_DELAY_MS, SPEECH_MS, useDuck } from '../DuckHeader'

const completionOf = (missing: TaskId[]) =>
  Object.fromEntries(TASK_IDS.map((task) => [task, !missing.includes(task)])) as Record<TaskId, boolean>

const TAPPING: Menace = { level: 'tapping', reason: 'close' }

/** The duck and his speech bubble, as the hero lays them out. */
function DuckHeader(props: Parameters<typeof useDuck>[0]) {
  const { duck, speech } = useDuck(props)
  return (
    <>
      {duck}
      {speech}
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

  it('says the line for his menace, a beat after Today opens', async () => {
    render(<DuckHeader menace={TAPPING} missing={['reading']} completion={completionOf(['reading'])} dayNumber={3} onLunge={vi.fn()} />)
    expect(screen.queryByText("Tick. Tock. You're cutting it close.")).not.toBeInTheDocument()
    expect(await screen.findByText("Tick. Tock. You're cutting it close.")).toBeInTheDocument()
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

  it('speaks for a few seconds, falls quiet, then says a catchphrase on his own', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    render(<DuckHeader menace={TAPPING} missing={['reading']} completion={completionOf(['reading'])} dayNumber={3} onLunge={vi.fn()} />)

    await act(async () => vi.advanceTimersByTime(FIRST_LINE_DELAY_MS))
    const line = screen.getByText("Tick. Tock. You're cutting it close.")
    expect(line.closest('[aria-live="polite"]')).not.toBeNull() // VoiceOver hears him

    await act(async () => vi.advanceTimersByTime(SPEECH_MS + 500))
    expect(screen.queryByText("Tick. Tock. You're cutting it close.")).not.toBeInTheDocument()

    await act(async () => vi.advanceTimersByTime(CHATTER_MAX_MS))
    const said = screen.getByRole('paragraph').textContent
    expect(CATCHPHRASES.tapping).toContain(said)
  })

  it('falls quiet after a reaction', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    render(<DuckHeader menace={TAPPING} missing={['reading']} completion={completionOf(['reading'])} dayNumber={3} onLunge={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Poke the duck' }))
    expect(screen.getByText(pokeLine(0))).toBeInTheDocument()

    await act(async () => vi.advanceTimersByTime(SPEECH_MS))
    expect(screen.queryByText(pokeLine(0))).not.toBeInTheDocument()
  })

  it('stops greeting once something is logged, and speaks up for an unfinished yesterday', async () => {
    const calm = { menace: { level: 'watching', reason: 'plenty' } as Menace, missing: [...TASK_IDS], completion: completionOf([...TASK_IDS]), dayNumber: 3, name: 'Daniel', onLunge: vi.fn() }
    const { rerender } = render(<DuckHeader {...calm} started />)
    expect(await screen.findByText('Started. Not finished.')).toBeInTheDocument()

    rerender(<DuckHeader {...calm} yesterdayOpen />)
    expect(await screen.findByText("Yesterday's still open. Noon.")).toBeInTheDocument()
  })

  it("says the player's name when the day starts", async () => {
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
    expect(await screen.findByText("New day, Daniel. I'm watching.")).toBeInTheDocument()
  })

  it('shows an announcement pushed from outside', async () => {
    const props = { menace: TAPPING, missing: ['reading'] as TaskId[], completion: completionOf(['reading']), dayNumber: 3, onLunge: vi.fn() }
    const { rerender } = render(<DuckHeader {...props} />)
    rerender(<DuckHeader {...props} announcement={{ text: '22:30. Not a minute later.', reaction: 'relax', id: 1 }} />)
    expect(await screen.findByText('22:30. Not a minute later.')).toBeInTheDocument()
  })
})
