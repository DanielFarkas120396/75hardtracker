import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary } from '../AppErrorBoundary'
import { StorageErrorScreen } from '../StorageErrorScreen'

function Boom(): never {
  throw new Error('kaboom')
}

describe('StorageErrorScreen', () => {
  it('explains a storage failure in plain words, with the technical detail and a reload button', () => {
    render(<StorageErrorScreen problem="failed" error={new DOMException('The user denied permission.', 'InvalidStateError')} />)
    expect(screen.getByRole('heading', { name: /can’t open your data/i })).toBeInTheDocument()
    expect(screen.getByText(/private browsing/i)).toBeInTheDocument()
    expect(screen.getByText(/InvalidStateError/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })

  it('asks to close other tabs when an upgrade is blocked', () => {
    render(<StorageErrorScreen problem="blocked" />)
    expect(screen.getByText(/close the other 75 hard tabs/i)).toBeInTheDocument()
  })
})

describe('AppErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('replaces a crashed app with a recovery screen offering reload and a backup', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    )
    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument()
    expect(screen.getByText(/kaboom/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /download a backup/i })).toBeInTheDocument()
  })

  it('renders its children when nothing goes wrong', () => {
    render(
      <AppErrorBoundary>
        <p>all good</p>
      </AppErrorBoundary>,
    )
    expect(screen.getByText('all good')).toBeInTheDocument()
  })
})
