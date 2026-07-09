/**
 * Markdown handoff payload for Owner → Cursor manual paste (110C).
 */

import { formatCursorRulesForPrompt } from '../cursorAutomation/cursorAutomationRules'
import type { CursorHandoffFromChatContext } from './cursorHandoffFromChatTypes'
import { assertHandoffMarkdownSafe, sanitizeCursorHandoffText } from './cursorHandoffFromChatDetect'

const DEFAULT_REPO = 'servicemanager-ai-2.0'
const DEFAULT_BASE_BRANCH = 'ai-company-flow'
const DEFAULT_SCOPE = ['apps/ai-company/**', 'docs/ai-company/**']

function inferFileScope(ownerPrompt: string): string[] {
  const scopes = [...DEFAULT_SCOPE]
  if (/frontend|ui|react|tsx|mobile|css/i.test(ownerPrompt)) {
    scopes.push(
      'apps/ai-company/src/components/**',
      'apps/ai-company/src/pages/**',
      'apps/ai-company/src/mobile/**',
      'apps/ai-company/src/styles/**',
    )
  }
  if (/backend|nest|prisma/i.test(ownerPrompt)) {
    scopes.push('backend/**')
  }
  if (/doc|документ|readme/i.test(ownerPrompt)) {
    scopes.push('docs/**')
  }
  if (/i18n|locale|перевод/i.test(ownerPrompt)) {
    scopes.push('apps/ai-company/src/i18n/**')
  }
  return [...new Set(scopes)]
}

function inferBranch(ownerPrompt: string): string {
  const match = ownerPrompt.match(/branch[:\s]+([a-z0-9/_-]+)/i)
  if (match?.[1]) return match[1]
  const ruMatch = ownerPrompt.match(/ветк[аи][:\s]+([a-z0-9/_-]+)/i)
  if (ruMatch?.[1]) return ruMatch[1]
  return DEFAULT_BASE_BRANCH
}

function inferGoal(ownerPrompt: string): string {
  const cleaned = ownerPrompt
    .replace(/^(сделай|передай|пусть|подготовь)\s+[^.!?]*cursor[:\s]*/i, '')
    .trim()
  return cleaned || ownerPrompt.trim()
}

function inferTitle(goal: string): string {
  const short = goal.slice(0, 96).trim()
  return short.length < goal.length ? `${short}…` : short
}

function buildContextBlock(ownerPrompt: string, context: CursorHandoffFromChatContext): string {
  const recent =
    context.recentOwnerMessages.length > 0
      ? context.recentOwnerMessages
          .slice(-4)
          .map((line) => `- ${sanitizeCursorHandoffText(line)}`)
          .join('\n')
      : '- (нет предыдущих сообщений Owner в этом чате)'

  return `Owner запросил внешнее исполнение через **Cursor** (инструмент, не сотрудник).

**Цифровой сотрудник:** ${context.employeeCodename} — подготовил handoff после решения Owner.

**Исходное сообщение Owner:**
> ${sanitizeCursorHandoffText(ownerPrompt)}

**Недавний контекст чата:**
${recent}

**Runtime V1:** без Cursor API; Owner вставляет prompt в Cursor / Cursor Automation вручную.
**Ollama:** same-origin \`/runtime/ollama\` или env config — без прямых IP в handoff.`
}

export function buildCursorHandoffFromChatMarkdown(input: {
  ownerPrompt: string
  context: CursorHandoffFromChatContext
}): { markdown: string; goal: string; title: string; fileScope: string[]; workingBranch: string } {
  const goal = sanitizeCursorHandoffText(inferGoal(input.ownerPrompt))
  const title = inferTitle(goal)
  const fileScope = inferFileScope(input.ownerPrompt)
  const workingBranch = inferBranch(input.ownerPrompt)
  const rules = formatCursorRulesForPrompt()

  const forbidden = [
    'Реальный вызов Cursor API из AI Company Runtime V1',
    'Hardcoded IP (http://192.*, http://83.*) и прямые Ollama IP в UI/handoff',
    'Деплой на сервер или ручные правки на production',
    'Превращение provider в owner тикета; cross-tenant доступ вне companyId',
    'Force push в main/master',
    'Коммит .env, секретов, credentials',
    'Превращение Cursor в цифрового сотрудника',
  ]

  const checks = [
    'npm --prefix apps/ai-company run build',
    'graphify update apps/ai-company (после изменений кода)',
    'Backend build → frontend build (если затронут backend)',
    'Не ломать technician / linked-client / impersonation / inspection flows',
  ]

  const commitRules = [
    'Один commit на задачу, если Owner не указал иначе',
    'Commit message — complete sentence, focus on why',
    'Не commit без явного запроса Owner',
    'Не amend после push; не skip hooks',
    'Не включать .env и секреты',
  ]

  const reportFormat = [
    'Task — что сделано и зачем',
    'Files — список изменённых файлов',
    'Changes — кратко по каждому файлу',
    'Constraints — multi-tenant, ticket owner = CLIENT, что не тронуто',
    'Checks — результаты сборки',
    'Expected result — что Owner получит после merge',
    'Что осталось для V2',
  ]

  const expectedResult = `Owner вставляет handoff в Cursor, получает PR/изменения локально, затем сообщает MAX в чате результат (V2: автоматический ingest).

После выполнения Cursor Owner возвращает summary в MAX Chat или создаёт follow-up задачу MAX для review/integration.`

  const markdown = `# Cursor Handoff — ${title}

## Цель
${goal}

## Контекст
${buildContextBlock(input.ownerPrompt, input.context)}

## Файлы / зоны проекта
${fileScope.map((item) => `- \`${item}\``).join('\n')}

## Что нельзя трогать
${forbidden.map((item) => `- ${item}`).join('\n')}

## Expected result
${expectedResult}

## Checks
${checks.map((item) => `- ${item}`).join('\n')}

## Branch
- **Repository:** \`${DEFAULT_REPO}\` (monorepo root — relative paths only)
- **Base branch:** \`${DEFAULT_BASE_BRANCH}\`
- **Working branch:** \`${workingBranch}\`

## Commit rules
${commitRules.map((item) => `- ${item}`).join('\n')}

## Report format
${reportFormat.map((item) => `- ${item}`).join('\n')}

## .cursor/rules
${rules}

---
**Tool:** Cursor Automation (external executor — not an AI Company employee)
**Delivery:** manual_v1 — Owner copies this markdown into Cursor; no external API calls from AI Company.
**Prepared by:** MAX (digital employee) after Owner decision in chat.
`

  assertHandoffMarkdownSafe(markdown)

  return { markdown, goal, title, fileScope, workingBranch }
}
