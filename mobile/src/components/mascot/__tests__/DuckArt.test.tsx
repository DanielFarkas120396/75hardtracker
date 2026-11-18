import { createRig, poseToTransforms } from '@logic/duckRig'
import { render, screen } from '@testing-library/react-native'
import { DuckArt } from '../DuckArt'

const pose = createRig({ mood: 'content', reducedMotion: true, random: () => 0.5 }).step(0)
const art = (label?: string) => <DuckArt size={96} transforms={poseToTransforms(pose)} opacities={pose} label={label} />

it('draws with the rig’s pose and carries its name', async () => {
  await render(art('The duck, satisfied'))
  expect(screen.getByLabelText('The duck, satisfied')).toBeOnTheScreen()
  expect(screen.getByRole('image')).toBeOnTheScreen()
})

it('is silent to screen readers without a name', async () => {
  await render(art())
  expect(screen.queryByRole('image')).toBeNull()
})
