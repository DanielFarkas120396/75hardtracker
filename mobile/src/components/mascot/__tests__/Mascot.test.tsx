import { act, render, screen } from '@testing-library/react-native'
import { AccessibilityInfo } from 'react-native'
import type { DuckArt } from '../DuckArt'
import { Mascot } from '../Mascot'

// The art is a drawing (see DuckArt.test.tsx). Here a probe stands in for it, to read what the
// duck's frame loop asks it to draw.
jest.mock('../DuckArt', () => ({
  DuckArt: (props: React.ComponentProps<typeof DuckArt>) => {
    const { Text: Probe } = jest.requireActual<typeof import('react-native')>('react-native')
    return (
      <Probe testID="duck" accessibilityLabel={props.label}>
        {JSON.stringify({ size: props.size, transforms: props.transforms })}
      </Probe>
    )
  },
}))

type Drawn = Pick<React.ComponentProps<typeof DuckArt>, 'size' | 'transforms'>
const drawn = (): Drawn => JSON.parse(screen.getByTestId('duck').props.children as string) as Drawn
const frames = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms)
  })

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

it('says who he is and how he feels', async () => {
  await render(<Mascot mood="watching" />)
  expect(screen.getByLabelText('The duck, watching you')).toBeOnTheScreen()
})

it('is silent to screen readers when decorative', async () => {
  await render(<Mascot mood="watching" decorative />)
  expect(screen.queryByLabelText('The duck, watching you')).toBeNull()
})

it('is drawn at the size asked', async () => {
  await render(<Mascot mood="content" size={96} />)
  expect(drawn().size).toBe(96)
})

it('moves: a tapping duck is not where he was half a second ago', async () => {
  await render(<Mascot mood="tapping" />)
  await frames(100)
  const before = JSON.stringify(drawn().transforms)
  await frames(500)
  expect(JSON.stringify(drawn().transforms)).not.toBe(before)
})

it('holds his pose when the phone asks for reduced motion', async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true)
  await render(<Mascot mood="tapping" />)
  await frames(1500)
  const settled = JSON.stringify(drawn().transforms)
  await frames(700)
  expect(JSON.stringify(drawn().transforms)).toBe(settled)
})

it('takes on a new mood', async () => {
  const view = await render(<Mascot mood="watching" />)
  await view.rerender(<Mascot mood="triumphant" />)
  expect(screen.getByLabelText('The duck, knife held high')).toBeOnTheScreen()
  await frames(1500)
  const raised = drawn().transforms.leftWing
  await view.rerender(<Mascot mood="watching" />)
  await frames(1500)
  expect(drawn().transforms.leftWing).not.toBe(raised)
})

it('stops his frame loop when he leaves the screen', async () => {
  const cancel = jest.spyOn(global, 'cancelAnimationFrame')
  const view = await render(<Mascot mood="watching" />)
  await frames(50)
  await view.unmount()
  expect(cancel).toHaveBeenCalled()
})
