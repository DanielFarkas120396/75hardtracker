import { renderHook, act } from '@testing-library/react-native'
import { AccessibilityInfo } from 'react-native'
import * as Reanimated from 'react-native-reanimated'
import { ScreenFocusContext } from '../../today/TaskBoard'
import { rotateAbout, translateX, useLoopClock } from '../loop'

afterEach(() => jest.restoreAllMocks())

describe('the matrices react-native-svg animates (its native side knows only `matrix`)', () => {
  it('slides along x', () => {
    expect(translateX(-16)).toEqual([1, 0, 0, 1, -16, 0])
  })

  it('turns about a point, which stays put', () => {
    const [a, b, c, d, e, f] = rotateAbout(90, 85, 0)
    const at = (x: number, y: number) => [a * x + c * y + e, b * x + d * y + f]
    expect(at(85, 0).map((v) => Math.round(v * 1e6) / 1e6)).toEqual([85, 0])
    expect(at(95, 0).map((v) => Math.round(v * 1e6) / 1e6)).toEqual([85, 10])
  })
})

describe('the loop clock', () => {
  it('runs only with its tab in front and motion allowed, and stills at 0 otherwise', async () => {
    const setActive = jest.fn()
    jest.spyOn(Reanimated, 'useFrameCallback').mockReturnValue({ setActive, isActive: false, callbackId: 1 })
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
    let focused = true
    const wrapper = ({ children }: { children: React.ReactNode }) => <ScreenFocusContext.Provider value={focused}>{children}</ScreenFocusContext.Provider>
    const hook = await renderHook(() => useLoopClock(), { wrapper })
    await act(async () => {})
    expect(setActive).toHaveBeenLastCalledWith(true)

    focused = false
    await hook.rerender({})
    expect(setActive).toHaveBeenLastCalledWith(false)
    expect(hook.result.current.value).toBe(0)
  })
})
