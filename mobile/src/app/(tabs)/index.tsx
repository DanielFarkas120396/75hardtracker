import { useIsFocused } from 'expo-router'
import { ScreenFocusContext } from '../../today/TaskBoard'
import { Today } from '../../today/TodayScreen'

/** The Today tab. Its fills rest while another tab is in front. */
export default function TodayRoute() {
  return (
    <ScreenFocusContext.Provider value={useIsFocused()}>
      <Today />
    </ScreenFocusContext.Provider>
  )
}
