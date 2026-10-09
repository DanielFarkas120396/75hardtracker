import { act, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { RULESETS } from '../../../logic/rulesets'
import type { DayTaskData } from '../../../logic/types'
import type { FillEngine } from '../fills/painter'
import { FillEngineContext } from '../fills/useFillEngine'
import { TaskTile } from '../TaskTile'
import { fakeEngine, type FakeHandle } from './fakeFillEngine'

const empty: DayTaskData = { water_ml: 0, pages_read: 0, dietFollowed: false, noAlcohol: false, hasPhoto: false, workouts: [] }

describe('TaskTile', () => {
  let handles: FakeHandle[]
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })
  beforeEach(() => {
    handles = []
  })

  const tile = (data: DayTaskData, engine: FillEngine | null) => (
    <FillEngineContext.Provider value={engine}>
      <TaskTile task="water" data={data} rules={RULESETS.hard} complete={false} urgency="none" onSettledAt={() => {}} onOpen={() => {}} />
    </FillEngineContext.Provider>
  )

  it('keeps the thin bar when there is no fill', () => {
    render(tile({ ...empty, water_ml: 1900 }, null))
    expect(screen.getByTestId('progress')).toHaveStyle({ width: '50%' })
  })

  it('counts the water up with its fill, then tells the day as it is', () => {
    const engine = fakeEngine(handles)
    const { rerender } = render(tile({ ...empty, water_ml: 1000 }, engine))
    expect(screen.queryByTestId('progress')).not.toBeInTheDocument()
    expect(screen.getByText('1 / 3.8 L')).toBeInTheDocument()

    rerender(tile({ ...empty, water_ml: 2000 }, engine))
    // The fill still shows a litre: so does the line.
    expect(screen.getByText('1 / 3.8 L')).toBeInTheDocument()
    act(() => handles[0].show(0.4))
    expect(screen.getByText('1.5 / 3.8 L')).toBeInTheDocument()
    act(() => handles[0].finish())
    expect(screen.getByText('2 / 3.8 L')).toBeInTheDocument()
  })

  it('writes the status in the ink colour over a fill', () => {
    render(tile({ ...empty, water_ml: 1000 }, fakeEngine(handles)))
    expect(screen.getByText('1 / 3.8 L')).toHaveClass('text-ink')
    expect(screen.getByText('1 / 3.8 L')).not.toHaveClass('text-ink-muted')
  })
})
