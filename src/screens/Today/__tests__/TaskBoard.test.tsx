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

  it('shows the five tasks, a tile each, named for VoiceOver without the dots', () => {
    render(board(empty))

    expect(screen.getByRole('button', { name: 'Workouts, 0 of 2, 45 min each' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Diet, 2 to tick' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Water, 0 / 3.8 L' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reading, 0 of 10 pages' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Photo, No photo yet' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Mood/ })).not.toBeInTheDocument()
    // Five tiles: the photo, last and alone, takes the whole row.
    expect(screen.getByRole('button', { name: /^Photo,/ }).parentElement!.parentElement!).toHaveClass('col-span-2')
  })

  it('marks done tiles with their summary', () => {
    render(board({ ...empty, water_ml: 3800, pages_read: 12 }, { bookTitle: 'Atomic Habits' }))

    expect(screen.getByRole('button', { name: 'Water, 3.8 L, done' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reading, 12 pages, Atomic Habits, done' })).toBeInTheDocument()
    expect(screen.queryByTestId('burst')).not.toBeInTheDocument()
    // One quiet mark: a neutral icon box, the tick on its corner.
    expect(screen.getByRole('button', { name: 'Water, 3.8 L, done' }).firstElementChild).toHaveClass('text-ink-muted')
  })

  it('fills the progress bar of a task under way', () => {
    render(board({ ...empty, water_ml: 1900 }))
    const bars = screen.getAllByTestId('progress')
    // Workouts, water and reading have bars; diet and photo don't.
    expect(bars).toHaveLength(3)
    expect(bars[1]).toHaveStyle({ width: '50%' })
  })

  it('shows the photo itself on the done photo tile', () => {
    const { container } = render(board({ ...empty, hasPhoto: true }, { photo: new Blob(['x'], { type: 'image/jpeg' }) }))
    expect(screen.getByRole('button', { name: 'Photo, Taken, done' })).toBeInTheDocument()
    expect(container.querySelector('img')).toBeInTheDocument()
  })

  it('opens the tapped task', () => {
    const onOpen = vi.fn()
    render(board(empty, { onOpen }))
    fireEvent.click(screen.getByRole('button', { name: /^Water/ }))
    expect(onOpen).toHaveBeenCalledWith('water')
  })

  it('shows a shortcut on the tiles that have one, and hides it once the task is done', () => {
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

  it('bursts when a task turns done after mount, not when it mounts done', () => {
    const { rerender } = render(board({ ...empty, water_ml: 3800 }))
    expect(screen.queryByTestId('burst')).not.toBeInTheDocument()

    rerender(board({ ...empty, water_ml: 3800, pages_read: 10 }))
    expect(screen.getByTestId('burst')).toBeInTheDocument()
  })

  it('quiets a done tile, and keeps the task colour on the open ones', () => {
    render(board({ ...empty, water_ml: 3800 }))

    const doneTile = screen.getByRole('button', { name: 'Water, 3.8 L, done' }).parentElement!
    expect(doneTile).toHaveClass('bg-surface')
    expect(doneTile).not.toHaveClass('bg-blue-light')
    expect(screen.getByRole('button', { name: /^Reading,/ }).parentElement!).toHaveClass('bg-yellow-light')
  })

  it('when it is urgent, folds the done tasks into chips and lifts the open tiles, quickest first', () => {
    const onOpen = vi.fn()
    render(board({ ...empty, water_ml: 3800, hasPhoto: true }, { urgent: true, minutesLeft: 60, onOpen }))

    for (const name of ['Water, 3.8 L, done', 'Photo, Taken, done']) {
      expect(screen.getByRole('button', { name })).toHaveClass('rounded-full')
    }
    const tiles = screen.getAllByRole('button', { name: /^(Workouts|Diet|Reading),/ }).map((b) => b.getAttribute('aria-label')!.split(',')[0])
    expect(tiles).toEqual(['Diet', 'Reading', 'Workouts'])
    // A red edge only on what no longer fits in the hour left: two workouts don't, the diet does.
    expect(screen.getByRole('button', { name: /^Workouts,/ }).parentElement!).toHaveClass('ring-danger-ink')
    expect(screen.getByRole('button', { name: /^Diet,/ }).parentElement!).toHaveClass('ring-ink/30')

    fireEvent.click(screen.getByRole('button', { name: 'Water, 3.8 L, done' }))
    expect(onOpen).toHaveBeenCalledWith('water')
  })

  it('gives the last open task the whole width when it is urgent', () => {
    const allButReading: DayTaskData = {
      water_ml: 3800,
      pages_read: 0,
      dietFollowed: true,
      noAlcohol: true,
      hasPhoto: true,
      workouts: [
        { durationMin: 45, isOutdoor: true },
        { durationMin: 45, isOutdoor: false },
      ],
    }
    render(board(allButReading, { urgent: true }))

    expect(screen.getByRole('button', { name: /^Reading,/ }).parentElement!.parentElement!).toHaveClass('col-span-2')
  })

  it('keeps the five tiles when it is urgent but everything is done', () => {
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
    render(board(all, { urgent: true }))
    expect(screen.getByRole('button', { name: /^Workouts,.*done$/ })).not.toHaveClass('rounded-full')
  })
})
