import { fireEvent, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { DayEntry } from '../../../db/types'
import { RULESETS } from '../../../logic/rulesets'
import type { DayTaskData } from '../../../logic/types'
import { taskCompletionMap } from '../../../logic/dayCompletion'
import { TaskBoard } from '../TaskBoard'

const entry: DayEntry = {
  id: 1,
  challengeId: 1,
  dayNumber: 3,
  date: '2026-10-05',
  water_ml: 0,
  pages_read: 0,
  dietFollowed: false,
  noAlcohol: false,
  completed: false,
}

const empty: DayTaskData = { water_ml: 0, pages_read: 0, dietFollowed: false, noAlcohol: false, hasPhoto: false, workouts: [] }

function board(data: DayTaskData, extra: Partial<Parameters<typeof TaskBoard>[0]> = {}) {
  const rules = RULESETS.hard
  return (
    <TaskBoard
      entry={{ ...entry, mood: extra.entry?.mood, notes: extra.entry?.notes }}
      data={data}
      completion={taskCompletionMap(data, rules)}
      rules={rules}
      onOpen={() => {}}
      {...extra}
    />
  )
}

describe('TaskBoard', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
    URL.createObjectURL = vi.fn(() => 'blob:photo')
    URL.revokeObjectURL = vi.fn()
  })

  it('shows the five open tasks, a tile each, quickest to finish first, named for VoiceOver without the dots', () => {
    render(board(empty))

    expect(screen.getByRole('button', { name: 'Workouts, 0 of 2, 45 min each' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Diet, 2 to tick' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Water, 0 / 3.8 L' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reading, 0 of 10 pages' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Photo, No photo yet' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Mood/ })).not.toBeInTheDocument()
    // Two minutes each for diet and the photo, 20 for the pages, 90 for two workouts, 228 for the water.
    const order = screen.getAllByRole('button', { name: /^(Workouts|Diet|Water|Reading|Photo),/ }).map((b) => b.getAttribute('aria-label')!.split(',')[0])
    expect(order).toEqual(['Diet', 'Photo', 'Reading', 'Workouts', 'Water'])
    // Five tiles: the last one, alone, takes the whole row.
    expect(screen.getByRole('button', { name: /^Water,/ }).parentElement!.parentElement!).toHaveClass('col-span-2')
  })

  it('folds done tasks into chips with their summary, above the open tiles', () => {
    const onOpen = vi.fn()
    render(board({ ...empty, water_ml: 3800, pages_read: 12 }, { bookTitle: 'Atomic Habits', onOpen }))

    for (const name of ['Water, 3.8 L, done', 'Reading, 12 pages, Atomic Habits, done']) {
      expect(screen.getByRole('button', { name })).toHaveClass('rounded-full')
    }
    const tiles = screen.getAllByRole('button', { name: /^(Workouts|Diet|Photo),/ }).map((b) => b.getAttribute('aria-label')!.split(',')[0])
    expect(tiles).toEqual(['Diet', 'Photo', 'Workouts'])
    expect(screen.getByRole('button', { name: /^Workouts,/ }).parentElement!.parentElement!).toHaveClass('col-span-2')

    fireEvent.click(screen.getByRole('button', { name: 'Water, 3.8 L, done' }))
    expect(onOpen).toHaveBeenCalledWith('water')
  })

  it('re-sorts the open tiles as a task gets closer to done', () => {
    // 1.2 L left is 72 minutes: the water now comes before two workouts (90).
    render(board({ ...empty, water_ml: 2600 }))
    const order = screen.getAllByRole('button', { name: /^(Workouts|Water),/ }).map((b) => b.getAttribute('aria-label')!.split(',')[0])
    expect(order).toEqual(['Water', 'Workouts'])
  })

  it('fills the progress bar of a task under way', () => {
    render(board({ ...empty, water_ml: 1900 }))
    const bars = screen.getAllByTestId('progress')
    // Reading, workouts and water have bars, in that order; diet and photo don't.
    expect(bars).toHaveLength(3)
    expect(bars[2]).toHaveStyle({ width: '50%' })
  })

  it('shows the photo itself on the done photo chip', () => {
    const { container } = render(board({ ...empty, hasPhoto: true }, { photo: new Blob(['x'], { type: 'image/jpeg' }) }))
    expect(screen.getByRole('button', { name: 'Photo, Taken, done' })).toHaveClass('rounded-full')
    expect(container.querySelector('img')).toBeInTheDocument()
  })

  it('opens the tapped task', () => {
    const onOpen = vi.fn()
    render(board(empty, { onOpen }))
    fireEvent.click(screen.getByRole('button', { name: /^Water/ }))
    expect(onOpen).toHaveBeenCalledWith('water')
  })

  it('shows a shortcut on the tiles that have one, and drops it once the task is done', () => {
    const onPress = vi.fn()
    const quickActions = {
      water: { label: 'Add 250 ml', icon: 'plus' as const, text: '250 ml', onPress },
      photo: { label: 'Take photo', icon: 'photo' as const, onPress: () => {} },
    }
    const { rerender } = render(board(empty, { quickActions }))

    expect(screen.getByRole('button', { name: 'Add 250 ml' })).toHaveTextContent('250 ml')
    expect(screen.getByRole('button', { name: 'Take photo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Add the/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add 250 ml' }))
    expect(onPress).toHaveBeenCalledTimes(1)

    rerender(board({ ...empty, water_ml: 3800 }, { quickActions }))
    expect(screen.queryByRole('button', { name: 'Add 250 ml' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Water, 3.8 L, done' })).toBeInTheDocument()
  })

  it('when it is urgent, edges the open tiles: red on what no longer fits before midnight', () => {
    render(board({ ...empty, water_ml: 3800, hasPhoto: true }, { urgent: true, minutesLeft: 60 }))

    // Two workouts (90 min) don't fit in the hour left; the diet does.
    expect(screen.getByRole('button', { name: /^Workouts,/ }).parentElement!).toHaveClass('ring-danger-ink')
    expect(screen.getByRole('button', { name: /^Diet,/ }).parentElement!).toHaveClass('ring-ink/30')
  })

  it('keeps the open tiles plain when it is not urgent', () => {
    render(board(empty))
    expect(screen.getByRole('button', { name: /^Workouts,/ }).parentElement!).not.toHaveClass('ring-2')
  })

  it('shows only chips once everything is done', () => {
    const all: DayTaskData = {
      water_ml: 3800,
      pages_read: 10,
      dietFollowed: true,
      noAlcohol: true,
      hasPhoto: true,
      workouts: [
        { durationMin: 45, isOutdoor: true },
        { durationMin: 45, isOutdoor: false },
      ],
    }
    render(board(all))
    expect(screen.getAllByRole('button', { name: /, done$/ })).toHaveLength(5)
    expect(screen.queryByTestId('progress')).not.toBeInTheDocument()
  })
})
