import { useIsFocused } from 'expo-router'
import { useEffect } from 'react'
import { dropCameraRequest } from '../../gallery/cameraRequest'
import { ScreenFocusContext } from '../../today/TaskBoard'
import { Today } from '../../today/TodayScreen'

/** The Today tab. Its fills rest while another tab is in front. */
export default function TodayRoute() {
  const focused = useIsFocused()
  // The Gallery's camera request is for this visit only: one Today didn't take (before Day 1, Victory) goes with it.
  useEffect(() => {
    if (!focused) dropCameraRequest()
  }, [focused])
  return (
    <ScreenFocusContext.Provider value={focused}>
      <Today />
    </ScreenFocusContext.Provider>
  )
}
