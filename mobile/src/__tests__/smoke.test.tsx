// Tests live outside src/app: every file in there is a route.
import { render, screen } from '@testing-library/react-native'
import Index from '../app/index'

it('opens', async () => {
  await render(<Index />)
  expect(screen.getByText('Companion')).toBeOnTheScreen()
})
