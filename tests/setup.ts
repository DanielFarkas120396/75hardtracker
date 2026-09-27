// An in-memory IndexedDB for the database tests; must load before Dexie.
import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// The Lottie player needs a canvas, which jsdom lacks (loading it prints jsdom's "not implemented"
// error), so screens that show the streak flame get a still stand-in. FlameStreak's own tests mock it themselves.
vi.mock('lottie-web/build/player/lottie_light', () => ({
  default: { loadAnimation: () => ({ play() {}, goToAndStop() {}, destroy() {} }) },
}))
