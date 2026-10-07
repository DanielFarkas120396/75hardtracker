// An in-memory IndexedDB for the database tests; must load before Dexie.
import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// The Lottie player needs a canvas, which jsdom lacks (loading it prints jsdom's "not implemented"
// error), so screens that show the streak flame get a still stand-in. FlameStreak's own tests mock it themselves.
vi.mock('lottie-web/build/player/lottie_light', () => ({
  default: { loadAnimation: () => ({ play() {}, goToAndStop() {}, destroy() {} }) },
}))

// jsdom has no IntersectionObserver, which framer-motion's `whileInView` needs (the deal's Hold
// button fades in when scrolled to). The stand-in reports every element as in view at once.
if (typeof window !== 'undefined' && !('IntersectionObserver' in window)) {
  class InViewObserver {
    constructor(private readonly callback: IntersectionObserverCallback) {}
    observe(target: Element) {
      this.callback([{ target, isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry], this as never)
    }
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
  vi.stubGlobal('IntersectionObserver', InViewObserver)
}
