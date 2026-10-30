import { describe, expect, it } from 'vitest'
import { isInAppBrowser } from '../installPrompt'

const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'

describe('isInAppBrowser', () => {
  it.each([
    ['TikTok', `${SAFARI} musical_ly_37.0.0 BytedanceWebview/d8a21c6`],
    ['Instagram', `${SAFARI} Instagram 350.0.0.0 (iPhone16,1)`],
    ['Facebook', `${SAFARI} [FBAN/FBIOS;FBAV/480.0]`],
    ['Snapchat', `${SAFARI} Snapchat/13.0.0`],
    ['LinkedIn', `${SAFARI} [LinkedInApp]/9.30`],
    ['Pinterest', `${CHROME_ANDROID} Pinterest/12.0`],
    ['X', `${CHROME_ANDROID} Twitter for Android`],
  ])('catches %s', (_, userAgent) => {
    expect(isInAppBrowser(userAgent)).toBe(true)
  })

  it('leaves real browsers alone', () => {
    expect(isInAppBrowser(SAFARI)).toBe(false)
    expect(isInAppBrowser(CHROME_ANDROID)).toBe(false)
  })
})
