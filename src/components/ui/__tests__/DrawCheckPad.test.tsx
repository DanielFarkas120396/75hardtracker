import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DrawCheckPad } from '../DrawCheckPad'

const pad = () => screen.getByRole('button', { name: 'Draw a checkmark.' })
const drawn = () => pad().querySelector('path')?.getAttribute('d')

function setup(disabled = false) {
  const onChange = vi.fn()
  render(
    <>
      <p id="pad-label">Draw a checkmark.</p>
      <DrawCheckPad labelledBy="pad-label" onChange={onChange} disabled={disabled} />
    </>,
  )
  return onChange
}

/** Drags the finger through the given points: down on the first, up on the last. */
function drag(points: [number, number][]) {
  const [first, ...rest] = points
  const last = rest.pop() ?? first
  fireEvent.pointerDown(pad(), { button: 0, clientX: first[0], clientY: first[1] })
  for (const [x, y] of rest) fireEvent.pointerMove(pad(), { clientX: x, clientY: y })
  fireEvent.pointerUp(pad(), { clientX: last[0], clientY: last[1] })
}

/** A checkmark, finger-sampled along its two arms. */
const CHECK: [number, number][] = [
  [40, 100],
  [50, 112],
  [60, 125],
  [70, 137],
  [80, 150],
  [100, 128],
  [120, 106],
  [140, 84],
  [160, 62],
  [180, 40],
]

describe('DrawCheckPad', () => {
  it('counts a drawn checkmark, and says so', () => {
    const onChange = setup()
    drag(CHECK)
    expect(onChange).toHaveBeenLastCalledWith(true)
    expect(screen.getByText('Signed.')).toBeInTheDocument()
  })

  it('refuses a line, keeps it on the pad, and clears it with the cross', () => {
    const onChange = setup()
    drag(CHECK.slice(0, 5))
    expect(onChange).toHaveBeenLastCalledWith(false)
    expect(screen.getByText('Not quite a checkmark. Try again.')).toBeInTheDocument()
    expect(drawn()).toMatch(/^M40\.0 100\.0 L /)

    fireEvent.click(screen.getByRole('button', { name: 'Clear the drawing' }))
    expect(drawn()).toBe('')
    expect(screen.queryByRole('button', { name: 'Clear the drawing' })).not.toBeInTheDocument()
  })

  it('un-checks as soon as a new stroke starts', () => {
    const onChange = setup()
    drag(CHECK)
    fireEvent.pointerDown(pad(), { button: 0, clientX: 10, clientY: 10 })
    expect(onChange).toHaveBeenLastCalledWith(false)
  })

  it('draws the checkmark for Enter or Space, so a keyboard or VoiceOver can sign', () => {
    const onChange = setup()
    fireEvent.keyDown(pad(), { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith(true)
    expect(drawn()).not.toBe('')
  })

  it('holds the page still while a finger draws, and lets it scroll otherwise', () => {
    setup()
    const frame = pad().parentElement as HTMLElement
    expect(fireEvent.touchMove(frame)).toBe(true) // not drawing: the touch keeps its default, a scroll

    fireEvent.pointerDown(pad(), { button: 0, clientX: 40, clientY: 100 })
    expect(fireEvent.touchMove(frame)).toBe(false) // drawing: the scroll is prevented
    fireEvent.pointerUp(pad(), { clientX: 60, clientY: 120 })
    expect(fireEvent.touchMove(frame)).toBe(true)
  })

  it('ignores the finger and the keyboard while disabled', () => {
    const onChange = setup(true)
    drag(CHECK)
    fireEvent.keyDown(pad(), { key: ' ' })
    expect(onChange).not.toHaveBeenCalled()
    expect(pad()).toHaveAttribute('tabindex', '-1')
  })
})
