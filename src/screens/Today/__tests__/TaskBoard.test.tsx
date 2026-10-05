import { fireEvent, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { DayEntry } from '../../../db/types'
import { RULESETS } from '../../../logic/rulesets'
import type { DayTaskData } from '../../../logic/types'
import { taskCompletionMap, missingTasks } from '../../../logic/dayCompletion'
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
      missing={missingTasks(data, rules)}
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

  it('shows six tiles named by their task and status, and how many are left', () => {
    render(board(empty))

    expect(screen.getByText('5 tasks left')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Workouts, 0 of 2 · 45 min each' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Diet, 2 to tick' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Water, 0 / 3.8 L' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reading, 0 of 10 pages' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Photo, No photo yet' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mood & notes, How was today?' })).toBeInTheDocument()
  })

  it('marks done tiles with their summary, and counts them off', () => {
    render(board({ ...empty, water_ml: 3800, pages_read: 12 }, { bookTitle: 'Atomic Habits' }))

    expect(screen.getByText('3 tasks left')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Water, 3.8 L, done' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reading, 12 pages · Atomic Habits, done' })).toBeInTheDocument()
    expect(screen.queryByTestId('burst')).not.toBeInTheDocument()
  })

  it('shows the mood on its tile', () => {
    render(board(empty, { entry: { ...entry, mood: 5 } }))
    expect(screen.getByRole('button', { name: 'Mood & notes, 😄 Great' })).toBeInTheDocument()
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
    fireEvent.click(screen.getByRole('button', { name: /^Mood/ }))
    expect(onOpen).toHaveBeenCalledWith('notes')
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
    expect(screen.queryByRole('button', { name: /^Add 1 page/ })).not.toBeInTheDocument()

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
})
