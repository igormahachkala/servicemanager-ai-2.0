import { useLocation } from 'react-router-dom'
import { MobileDemoHelper } from '../components/MobileDemoHelper'
import { useMobileDemo } from '../hooks/useMobileDemo'
import { MOBILE_PATHS } from '../navigation/mobileHrefResolver'

export function MobileDemoHelperHost() {
  const { pathname } = useLocation()
  const demo = useMobileDemo()

  if (!demo.enabled || !demo.checklist || pathname.startsWith(MOBILE_PATHS.demo)) {
    return null
  }

  return <MobileDemoHelper checklist={demo.checklist} />
}
