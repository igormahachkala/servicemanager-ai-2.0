import { agents } from '../../mission-control/data/mock'
import { loadCustomEmployees } from '../../mission-control/data/customEmployees'

export function resolveEmployeeLabel(employeeId: string): { name: string; codename: string } {
  const custom = loadCustomEmployees().find((item) => item.id === employeeId)
  if (custom) {
    return { name: custom.name, codename: custom.codename }
  }

  const agent = agents.find((item) => item.id === employeeId)
  if (agent) {
    return { name: agent.codename, codename: agent.codename }
  }

  return { name: employeeId, codename: employeeId }
}
