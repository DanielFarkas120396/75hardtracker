import { worldForDay } from '../screens/Journey/worlds'

/**
 * Where today sits in the Journey's worlds, for Today's hero: the world's
 * name and the days left in it, today included ("Hell · 7 days to escape").
 */
export function worldProgressLine(dayNumber: number): string {
  const world = worldForDay(dayNumber)
  const left = world.lastDay - dayNumber + 1
  if (left <= 1) return `${world.name} · ${world.id === 'heaven' ? 'the very last day' : 'last day here'}`
  const goal = world.id === 'hell' ? 'to escape' : world.id === 'heaven' ? 'to the top' : 'to the next world'
  return `${world.name} · ${left} days ${goal}`
}
