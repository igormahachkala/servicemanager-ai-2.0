export type Team = {
  id: string
  departmentId: string
  name: string
  description: string
  leadEmployeeId: string | null
  members: string[]
}
