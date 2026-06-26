export type HandoffPackage = {
  projectContext: string
  taskContext: string
  currentState: string
  files: string[]
  constraints: string[]
  commands: string[]
  acceptanceCriteria: string[]
  expectedResponseFormat: string
}

export type BuildHandoffPackageInput = {
  projectTitle: string
  projectSummary: string
  workspaceName: string
  taskTitle: string | null
  taskDescription: string | null
  currentState: string
  files: string[]
  constraints: string[]
  commands: string[]
  acceptanceCriteria: string[]
  expectedResponseFormat: string
}

export function buildHandoffPackage(input: BuildHandoffPackageInput): HandoffPackage {
  const taskContext = input.taskTitle
    ? `${input.taskTitle}${input.taskDescription ? ` — ${input.taskDescription}` : ''}`
    : 'No linked delivery task — handoff scoped to project workspace.'

  return {
    projectContext: `${input.projectTitle}. ${input.projectSummary} Workspace: ${input.workspaceName}.`,
    taskContext,
    currentState: input.currentState,
    files: input.files,
    constraints: input.constraints,
    commands: input.commands,
    acceptanceCriteria: input.acceptanceCriteria,
    expectedResponseFormat: input.expectedResponseFormat,
  }
}
