import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import { addDaysISO, dateForDayNumber, formatShortDay, todayISO } from '../../../lib/dates'
import { SocialOccasionSheet } from '../SocialOccasionSheet'

/** A Strong challenge that started today (so today is Day 1), optionally with social days already declared. */
async function setup({ socialDays }: { socialDays?: number[] } = {}) {
  const start = todayISO()
  const challengeId = await addChallenge({
    startDate: start,
    attemptNumber: 1,
    status: 'active',
    variant: 'strong',
    ...(socialDays ? { socialDays } : {}),
  })
  const challenge = (await db.challenges.get(challengeId))!
  const onDeclared = vi.fn()
  const onClose = vi.fn()
  render(
    <SocialOccasionSheet
      open
      challenge={challenge}
      today={start}
      todayDayNumber={1}
      onClose={onClose}
      onDeclared={onDeclared}
    />,
  )
  return { challenge, start, onDeclared, onClose }
}

function pickDate(dateISO: string) {
  fireEvent.change(screen.getByLabelText('Day'), { target: { value: dateISO } })
}

describe('SocialOccasionSheet', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the title, the help line and a date range from tomorrow to Day 75', async () => {
    const { start } = await setup()

    expect(screen.getByRole('heading', { name: 'Plan a social occasion' })).toBeInTheDocument()
    expect(
      screen.getByText('Tomorrow at the earliest, one per week. On that day a drink is allowed — the diet still counts.'),
    ).toBeInTheDocument()
    const input = screen.getByLabelText('Day') as HTMLInputElement
    expect(input.min).toBe(addDaysISO(start, 1))
    expect(input.max).toBe(dateForDayNumber(start, 75))
  })

  it('declares tomorrow and reports the new day number', async () => {
    const { challenge, start, onDeclared } = await setup()

    pickDate(addDaysISO(start, 1))
    fireEvent.click(screen.getByRole('button', { name: 'Declare' }))

    await waitFor(() => expect(onDeclared).toHaveBeenCalledWith(2))
    expect((await db.challenges.get(challenge.id))?.socialDays).toEqual([2])
  })

  it('refuses declaring today', async () => {
    const { start } = await setup()

    pickDate(start)
    fireEvent.click(screen.getByRole('button', { name: 'Declare' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Declare it the day before at the latest.')
  })

  it('refuses a second day in a week that already has one', async () => {
    const { start } = await setup({ socialDays: [2] })

    pickDate(dateForDayNumber(start, 3))
    fireEvent.click(screen.getByRole('button', { name: 'Declare' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Week 1 already has one: Day 2.')
  })

  it('lists a declared upcoming day and cancels it directly, without a confirmation', async () => {
    const { challenge, start } = await setup({ socialDays: [2] })
    const label = `${formatShortDay(dateForDayNumber(start, 2))} · Day 2`

    expect(screen.getByText(label)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Day 2' }))

    expect(screen.queryByText(/Cancel today's occasion/)).not.toBeInTheDocument()
    await waitFor(async () => expect((await db.challenges.get(challenge.id))?.socialDays).toBeUndefined())
  })

  it("labels today's declared row \"Today · Day N\"", async () => {
    await setup({ socialDays: [1] })

    expect(screen.getByText('Today · Day 1')).toBeInTheDocument()
  })

  it("tapping today's Cancel shows a confirmation instead of cancelling", async () => {
    const { challenge } = await setup({ socialDays: [1] })

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Day 1' }))

    expect(
      screen.getByText("Cancel today's occasion? You can't declare today again, and a drink today would break your diet."),
    ).toBeInTheDocument()
    expect((await db.challenges.get(challenge.id))?.socialDays).toEqual([1])
  })

  it('"Keep it" restores the row without cancelling', async () => {
    const { challenge } = await setup({ socialDays: [1] })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Day 1' }))

    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }))

    expect(screen.getByText('Today · Day 1')).toBeInTheDocument()
    expect((await db.challenges.get(challenge.id))?.socialDays).toEqual([1])
  })

  it('"Cancel it" removes the day', async () => {
    const { challenge } = await setup({ socialDays: [1] })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Day 1' }))

    fireEvent.click(screen.getByRole('button', { name: 'Cancel it' }))

    await waitFor(async () => expect((await db.challenges.get(challenge.id))?.socialDays).toBeUndefined())
  })
})
