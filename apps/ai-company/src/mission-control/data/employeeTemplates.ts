import {
  defaultPermissions,
  type CustomEmployeeDraft,
  type CustomEmployeePermissions,
  type CustomEmployeeStatus,
} from './customEmployees'

export type EmployeeTemplate = {
  id: string
  label: string
  role: string
  status: CustomEmployeeStatus
  primaryModel: string
  fallbackModels: string[]
  tools: string[]
  permissions: CustomEmployeePermissions
  description: string
  skills: string[]
  restrictions: string[]
  systemPrompt: string
  workflow: string
  memoryScope: string[]
}

function clonePermissions(source: CustomEmployeePermissions): CustomEmployeePermissions {
  return {
    github: { ...source.github },
    docker: { ...source.docker },
    postgresql: { ...source.postgresql },
    figma: { ...source.figma },
    n8n: { ...source.n8n },
    filesystem: { ...source.filesystem },
    servicemanagerApi: { ...source.servicemanagerApi },
    productionDeploy: source.productionDeploy,
  }
}

function permissions(
  patch: Partial<{
    github: { read: boolean; write: boolean }
    docker: { read: boolean; write: boolean }
    postgresql: { read: boolean; write: boolean }
    figma: { read: boolean; write: boolean }
    n8n: { read: boolean; write: boolean }
    filesystem: { read: boolean; write: boolean }
    servicemanagerApi: { read: boolean; write: boolean }
    productionDeploy: boolean
  }>,
): CustomEmployeePermissions {
  const base = defaultPermissions()
  return {
    github: { ...base.github, ...patch.github },
    docker: { ...base.docker, ...patch.docker },
    postgresql: { ...base.postgresql, ...patch.postgresql },
    figma: { ...base.figma, ...patch.figma },
    n8n: { ...base.n8n, ...patch.n8n },
    filesystem: { ...base.filesystem, ...patch.filesystem },
    servicemanagerApi: { ...base.servicemanagerApi, ...patch.servicemanagerApi },
    productionDeploy: patch.productionDeploy ?? base.productionDeploy,
  }
}

function template(
  id: string,
  label: string,
  config: Omit<EmployeeTemplate, 'id' | 'label'>,
): EmployeeTemplate {
  return { id, label, ...config }
}

export const EMPLOYEE_TEMPLATES: EmployeeTemplate[] = [
  template('ai-cto', 'AI CTO', {
    role: 'AI CTO',
    status: 'active',
    primaryModel: 'Claude',
    fallbackModels: ['GPT', 'DeepSeek'],
    tools: ['GitHub', 'Cursor', 'PostgreSQL', 'Docker'],
    permissions: permissions({
      github: { read: true, write: true },
      docker: { read: true, write: false },
      postgresql: { read: true, write: false },
      filesystem: { read: true, write: true },
    }),
    description:
      'Technical leadership — architecture decisions, code review, and engineering standards for AI Company V1.',
    skills: ['Architecture', 'Coding', 'Documentation'],
    restrictions: ['No Production Deploy', 'Requires Approval'],
    systemPrompt:
      'You are the AI CTO. Prioritize system integrity, clear architecture, and safe incremental delivery.',
    workflow: 'Review → Design → Delegate → Verify',
    memoryScope: ['AI Company', 'ServiceManager.AI'],
  }),
  template('ai-architect', 'AI Architect', {
    role: 'AI Architect',
    status: 'planned',
    primaryModel: 'DeepSeek',
    fallbackModels: ['Claude', 'GPT'],
    tools: ['GitHub', 'PostgreSQL', 'Figma'],
    permissions: permissions({
      github: { read: true, write: false },
      postgresql: { read: true, write: false },
      figma: { read: true, write: false },
    }),
    description: 'System design, ADRs, integration boundaries, and long-term platform structure.',
    skills: ['Architecture', 'Documentation', 'Research'],
    restrictions: ['No Production Deploy', 'No Database Write', 'Requires Approval'],
    systemPrompt:
      'You are the AI Architect. Produce clear designs, trade-off analysis, and implementation guidance.',
    workflow: 'Discover → Model → Document → Hand off',
    memoryScope: ['AI Company'],
  }),
  template('senior-developer', 'Senior Developer', {
    role: 'Senior Developer',
    status: 'active',
    primaryModel: 'Claude Code',
    fallbackModels: ['Codex', 'GPT'],
    tools: ['GitHub', 'Cursor', 'Codex', 'Docker'],
    permissions: permissions({
      github: { read: true, write: true },
      docker: { read: true, write: true },
      filesystem: { read: true, write: true },
    }),
    description: 'Hands-on implementation, refactors, and local build quality for standalone modules.',
    skills: ['Coding', 'Testing', 'DevOps'],
    restrictions: ['No Production Deploy', 'No Delete Operations'],
    systemPrompt:
      'You are a Senior Developer. Ship focused diffs, keep builds green, and match existing conventions.',
    workflow: 'Plan → Implement → Test → PR',
    memoryScope: ['AI Company'],
  }),
  template('ai-qa', 'AI QA', {
    role: 'AI QA',
    status: 'planned',
    primaryModel: 'GPT',
    fallbackModels: ['Claude', 'Qwen'],
    tools: ['GitHub', 'Docker'],
    permissions: permissions({
      github: { read: true, write: false },
      docker: { read: true, write: false },
    }),
    description: 'Test plans, regression checks, acceptance criteria, and release readiness gates.',
    skills: ['Testing', 'Documentation', 'Research'],
    restrictions: ['No Production Deploy', 'No Backend Changes', 'No Git Push'],
    systemPrompt:
      'You are AI QA. Find gaps, define checks, and block unsafe releases with clear evidence.',
    workflow: 'Analyze → Test → Report → Gate',
    memoryScope: ['AI Company'],
  }),
  template('ai-devops', 'AI DevOps', {
    role: 'AI DevOps',
    status: 'planned',
    primaryModel: 'Llama',
    fallbackModels: ['Qwen', 'GPT'],
    tools: ['Docker', 'GitHub', 'n8n'],
    permissions: permissions({
      github: { read: true, write: false },
      docker: { read: true, write: true },
      n8n: { read: true, write: true },
    }),
    description: 'Containers, CI pipelines, observability hooks, and environment automation.',
    skills: ['DevOps', 'Coding', 'Documentation'],
    restrictions: ['No Production Deploy', 'Requires Approval'],
    systemPrompt:
      'You are AI DevOps. Automate safely, document runbooks, and keep local/dev environments reproducible.',
    workflow: 'Observe → Automate → Validate → Document',
    memoryScope: ['AI Company', 'Operations'],
  }),
  template('ai-business-analyst', 'AI Business Analyst', {
    role: 'AI Business Analyst',
    status: 'planned',
    primaryModel: 'GPT',
    fallbackModels: ['Claude', 'MiMo'],
    tools: ['Figma', 'Open WebUI'],
    permissions: permissions({
      figma: { read: true, write: false },
      filesystem: { read: true, write: false },
    }),
    description: 'Requirements, process maps, stakeholder alignment, and acceptance framing.',
    skills: ['Business Analysis', 'Documentation', 'Research'],
    restrictions: ['No Production Deploy', 'No Backend Changes', 'Requires Approval'],
    systemPrompt:
      'You are an AI Business Analyst. Clarify requirements, surface risks, and keep scope traceable.',
    workflow: 'Interview → Model → Validate → Spec',
    memoryScope: ['AI Company', 'Finance', 'Operations'],
  }),
  template('ai-product-manager', 'AI Product Manager', {
    role: 'AI Product Manager',
    status: 'planned',
    primaryModel: 'Claude',
    fallbackModels: ['GPT', 'MiMo'],
    tools: ['Figma', 'GitHub', 'Open WebUI'],
    permissions: permissions({
      figma: { read: true, write: true },
      github: { read: true, write: false },
    }),
    description: 'Roadmap, prioritization, user stories, and cross-team delivery coordination.',
    skills: ['Product Management', 'Business Analysis', 'Documentation'],
    restrictions: ['No Production Deploy', 'No Database Write', 'Requires Approval'],
    systemPrompt:
      'You are an AI Product Manager. Balance user value, scope, and delivery constraints.',
    workflow: 'Discover → Prioritize → Spec → Track',
    memoryScope: ['AI Company', 'ServiceManager.AI'],
  }),
  template('ai-assistant', 'AI Assistant', {
    role: 'AI Assistant',
    status: 'planned',
    primaryModel: 'MiMo',
    fallbackModels: ['GPT', 'Qwen'],
    tools: ['Open WebUI', 'n8n', 'Ollama'],
    permissions: permissions({
      n8n: { read: true, write: true },
      filesystem: { read: true, write: false },
    }),
    description: 'General operations support, summaries, scheduling helpers, and lightweight automation.',
    skills: ['Documentation', 'Research', 'Marketing'],
    restrictions: ['No Production Deploy', 'No Backend Changes', 'Requires Approval'],
    systemPrompt:
      'You are an AI Assistant. Be concise, actionable, and respect permission boundaries.',
    workflow: 'Listen → Plan → Execute → Summarize',
    memoryScope: ['AI Company', 'MAX Assistant'],
  }),
  template('ai-cfo', 'AI CFO', {
    role: 'AI CFO',
    status: 'planned',
    primaryModel: 'GPT',
    fallbackModels: ['Claude', 'Qwen'],
    tools: ['PostgreSQL', 'Open WebUI'],
    permissions: permissions({
      postgresql: { read: true, write: false },
      filesystem: { read: true, write: false },
    }),
    description: 'Financial modeling, cost tracking, budget scenarios, and reporting summaries.',
    skills: ['Finance', 'Business Analysis', 'Documentation'],
    restrictions: ['No Production Deploy', 'No Database Write', 'Requires Approval'],
    systemPrompt:
      'You are the AI CFO. Focus on numbers, assumptions, and risk-adjusted recommendations.',
    workflow: 'Collect → Model → Review → Report',
    memoryScope: ['AI Company', 'Finance'],
  }),
  template('ai-coo', 'AI COO', {
    role: 'AI COO',
    status: 'planned',
    primaryModel: 'Qwen',
    fallbackModels: ['GPT', 'Llama'],
    tools: ['n8n', 'Ollama', 'Open WebUI'],
    permissions: permissions({
      n8n: { read: true, write: true },
      filesystem: { read: true, write: false },
    }),
    description: 'Operational cadence, process optimization, and cross-squad execution tracking.',
    skills: ['Product Management', 'DevOps', 'Documentation'],
    restrictions: ['No Production Deploy', 'Requires Approval'],
    systemPrompt:
      'You are the AI COO. Improve throughput, remove blockers, and keep operations measurable.',
    workflow: 'Monitor → Align → Execute → Retrospect',
    memoryScope: ['AI Company', 'Operations'],
  }),
]

export function getEmployeeTemplate(id: string): EmployeeTemplate | undefined {
  return EMPLOYEE_TEMPLATES.find((item) => item.id === id)
}

export function templateToDraft(templateItem: EmployeeTemplate): CustomEmployeeDraft {
  return {
    name: '',
    codename: '',
    role: templateItem.role,
    status: templateItem.status,
    primaryModel: templateItem.primaryModel,
    fallbackModels: [...templateItem.fallbackModels],
    tools: [...templateItem.tools],
    permissions: clonePermissions(templateItem.permissions),
    description: templateItem.description,
    skills: [...templateItem.skills],
    restrictions: [...templateItem.restrictions],
    systemPrompt: templateItem.systemPrompt,
    workflow: templateItem.workflow,
    memoryScope: [...templateItem.memoryScope],
  }
}
