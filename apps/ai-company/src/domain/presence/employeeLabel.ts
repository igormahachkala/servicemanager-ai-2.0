import { agents } from '../../mission-control/data/mock'
import { loadCustomEmployees } from '../../mission-control/data/customEmployees'
import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'

export function resolveEmployeeLabel(employeeId: string): { name: string; codename: string } {
  const canonicalId = resolveCanonicalEmployeeId(employeeId)

  const custom =
    loadCustomEmployees().find((item) => item.id === canonicalId) ??
    loadCustomEmployees().find((item) => item.id === employeeId)
  if (custom) {
    return { name: custom.name, codename: custom.codename }
  }

  const agent = agents.find((item) => item.id === canonicalId)
  if (agent) {
    return { name: agent.codename, codename: agent.codename }
  }

  return { name: employeeId, codename: employeeId }
}
