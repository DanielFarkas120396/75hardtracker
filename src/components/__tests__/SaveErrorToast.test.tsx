import { act, render, screen } from '@testing-library/react'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { SaveErrorToast } from '../SaveErrorToast'

function unhandledRejection(reason: unknown) {
  const event = new Event('unhandledrejection')
  Object.assign(event, { reason })
  act(() => {
    window.dispatchEvent(event)
  })
}

describe('SaveErrorToast', () => {
  it('stays hidden until a write fails', () => {
    render(<SaveErrorToast />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('says so when the database refuses a write', () => {
    render(<SaveErrorToast />)
    unhandledRejection(new Dexie.QuotaExceededError('full'))
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't save that.")
  })

  it('says so when the browser reports a full disk', () => {
    render(<SaveErrorToast />)
    unhandledRejection(new DOMException('full', 'QuotaExceededError'))
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('ignores failures that have nothing to do with saving', () => {
    render(<SaveErrorToast />)
    unhandledRejection(new Error('audio is locked'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
