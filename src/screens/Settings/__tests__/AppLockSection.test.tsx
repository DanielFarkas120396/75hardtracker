import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { freshDatabase } from '../../../db/__tests__/fixtures'
import { AppLockSection } from '../AppLockSection'

describe('AppLockSection', () => {
  beforeEach(freshDatabase)

  it('explains when Face ID is not available here (no WebAuthn, as in this test browser)', async () => {
    render(<AppLockSection />)
    expect(await screen.findByText(/Face ID isn't available here/)).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'Lock with Face ID' })).not.toBeInTheDocument()
  })
})
