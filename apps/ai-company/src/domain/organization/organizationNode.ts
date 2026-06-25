export type OrganizationNodeKind = 'owner' | 'department' | 'team' | 'employee'

export type OrganizationNode = {
  id: string
  kind: OrganizationNodeKind
  refId: string
  label: string
  subtitle?: string
  parentId: string | null
  sortOrder: number
}

export type OrganizationTreeNode = OrganizationNode & {
  children: OrganizationTreeNode[]
}
