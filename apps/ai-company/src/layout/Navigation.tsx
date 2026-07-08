import { OwnerNavigation } from './OwnerNavigation'

export function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return <OwnerNavigation onNavigate={onNavigate} />
}
