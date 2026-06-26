import { AI_PHOTO_LAB_CONTROL_ROOM_PATH } from '../projects/aiPhotoLabControlRoom'
import { AI_PHOTO_LAB_PROJECT_ID } from '../projects/aiPhotoLabIds'
import type {
  VisualLabBrowserState,
  VisualLabDerivedState,
  VisualLabFileChange,
  VisualLabSession,
  VisualLabTestStep,
  VisualLabTimelineEntry,
} from './visualLab'
import { VISUAL_LAB_SESSION_ID } from './visualLab'

const LOGIN_BUTTON_TSX = `import { useState } from 'react'

type Props = {
  onSubmit: (email: string) => void
}

export function LoginButton({ onSubmit }: Props) {
  const [email, setEmail] = useState('')

  return (
    <form className="login-form" onSubmit={(e) => { e.preventDefault(); onSubmit(email) }}>
      <input
        data-testid="login-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="owner@company.local"
      />
      <button data-testid="login-submit" type="submit" className="login-submit">
        Sign in
      </button>
    </form>
  )
}
`

const LOGIN_TEST_TS = `import { test, expect } from '@playwright/test'

test.describe('AI Photo Lab login', () => {
  test('owner can sign in from landing page', async ({ page }) => {
    await page.goto('/login')
    await page.getByTestId('login-email').fill('owner@company.local')
    await page.getByTestId('login-submit').click()
    await expect(page).toHaveURL(/dashboard/)
  })
})
`

const BASE_BROWSER: VisualLabBrowserState = {
  url: 'http://localhost:5173/login',
  title: 'AI Photo Lab — Sign in',
  showLoginButton: false,
  loginButtonLabel: 'Sign in',
  cursor: null,
  highlights: [],
  clicks: [],
}

const BASE_TEST_STEPS: VisualLabTestStep[] = [
  { id: 'step-open', label: 'Open /login route', status: 'pending' },
  { id: 'step-fill', label: 'Fill login email field', status: 'pending' },
  { id: 'step-click', label: 'Click Sign in button', status: 'pending' },
  { id: 'step-assert', label: 'Assert dashboard redirect', status: 'pending' },
]

function offsetIso(seconds: number): string {
  return new Date(Date.now() - (120 - seconds) * 1000).toISOString()
}

function buildTimeline(): VisualLabTimelineEntry[] {
  return [
    {
      id: 'vl-01',
      at: offsetIso(0),
      kind: 'test_started',
      label: 'Test started',
      detail: 'playwright — login.spec.ts',
    },
    {
      id: 'vl-02',
      at: offsetIso(8),
      kind: 'file_changed',
      label: 'File changed',
      detail: 'src/components/auth/LoginButton.tsx',
    },
    {
      id: 'vl-03',
      at: offsetIso(14),
      kind: 'terminal_line',
      label: 'Terminal',
      detail: 'npm run test:e2e -- login.spec.ts',
    },
    {
      id: 'vl-04',
      at: offsetIso(22),
      kind: 'button_added',
      label: 'Button added',
      detail: 'Sign in CTA rendered in preview',
    },
    {
      id: 'vl-05',
      at: offsetIso(30),
      kind: 'cursor_move',
      label: 'Cursor moved',
      detail: 'Hover login email field',
    },
    {
      id: 'vl-06',
      at: offsetIso(38),
      kind: 'highlight',
      label: 'Highlighted UI element',
      detail: 'input[data-testid="login-email"]',
    },
    {
      id: 'vl-07',
      at: offsetIso(46),
      kind: 'click',
      label: 'Clicked login',
      detail: 'button[data-testid="login-submit"]',
    },
    {
      id: 'vl-08',
      at: offsetIso(54),
      kind: 'screenshot',
      label: 'Screenshot captured',
      detail: 'login-flow-after-click.png',
    },
    {
      id: 'vl-09',
      at: offsetIso(62),
      kind: 'terminal_line',
      label: 'Terminal',
      detail: '1 passed (login.spec.ts)',
    },
    {
      id: 'vl-10',
      at: offsetIso(70),
      kind: 'build_passed',
      label: 'Build passed',
      detail: 'vite build — 0 errors',
    },
  ]
}

function buildFileChanges(): VisualLabFileChange[] {
  return [
    {
      path: 'src/components/auth/LoginButton.tsx',
      summary: 'Added Sign in button with data-testid hook',
      addedLines: [
        '<button data-testid="login-submit" type="submit" className="login-submit">',
        '  Sign in',
        '</button>',
      ],
    },
  ]
}

export function buildVisualLabSession(): VisualLabSession {
  return {
    context: {
      sessionId: VISUAL_LAB_SESSION_ID,
      employeeId: 'ag-max',
      employeeCodename: 'MAX',
      employeeRole: 'Senior Developer',
      taskId: 'task-apl-004',
      taskTitle: 'Audit image upload flow',
      taskPriority: 'high',
      executionId: 'exec-task-apl-004',
      executionStatus: 'running',
      projectId: AI_PHOTO_LAB_PROJECT_ID,
      projectTitle: 'AI Photo Lab',
      runtimeRunId: 'run-apl-max-code-audit',
      handoffId: null,
      reportId: 'report-qa-build',
    },
    files: [
      {
        id: 'file-login-button',
        path: 'src/components/auth/LoginButton.tsx',
        language: 'tsx',
        content: LOGIN_BUTTON_TSX,
        active: true,
      },
      {
        id: 'file-login-test',
        path: 'tests/e2e/login.spec.ts',
        language: 'typescript',
        content: LOGIN_TEST_TS,
      },
    ],
    timeline: buildTimeline(),
    terminalLines: [],
    browser: { ...BASE_BROWSER },
    testSteps: BASE_TEST_STEPS.map((item) => ({ ...item })),
    screenshots: [],
    fileChanges: buildFileChanges(),
  }
}

export function deriveVisualLabState(
  session: VisualLabSession,
  activeIndex: number,
): VisualLabDerivedState {
  const slice = session.timeline.slice(0, activeIndex + 1)
  const terminalLines: string[] = []
  let browser: VisualLabBrowserState = {
    ...session.browser,
    showLoginButton: false,
    cursor: null,
    highlights: [],
    clicks: [],
  }
  const testSteps: VisualLabTestStep[] = session.testSteps.map((item) => ({
    ...item,
    status: 'pending' as VisualLabTestStep['status'],
  }))
  const screenshots = [...session.screenshots]
  let latestFileChange: VisualLabFileChange | null = null
  let activeFileId = session.files.find((item) => item.active)?.id ?? session.files[0]?.id ?? ''

  slice.forEach((entry) => {
    switch (entry.kind) {
      case 'test_started':
        testSteps[0] = { ...testSteps[0], status: 'running' }
        terminalLines.push('▶ Starting Playwright test suite — login.spec.ts')
        break
      case 'file_changed':
        activeFileId = 'file-login-button'
        latestFileChange = session.fileChanges[0] ?? null
        terminalLines.push(`✎ Updated ${entry.detail ?? 'LoginButton.tsx'}`)
        break
      case 'terminal_line':
        if (entry.detail) terminalLines.push(`$ ${entry.detail}`)
        break
      case 'button_added':
        browser = {
          ...browser,
          showLoginButton: true,
        }
        terminalLines.push('✓ Preview updated — Sign in button mounted')
        break
      case 'cursor_move':
        browser = {
          ...browser,
          cursor: { x: 42, y: 118 },
        }
        break
      case 'highlight':
        browser = {
          ...browser,
          cursor: { x: 42, y: 118 },
          highlights: [
            {
              id: 'hl-email',
              label: 'login-email',
              top: 96,
              left: 24,
              width: 280,
              height: 36,
            },
          ],
        }
        testSteps[0] = { ...testSteps[0], status: 'passed' }
        testSteps[1] = { ...testSteps[1], status: 'running' }
        break
      case 'click':
        browser = {
          ...browser,
          cursor: { x: 42, y: 168 },
          highlights: [
            {
              id: 'hl-submit',
              label: 'login-submit',
              top: 148,
              left: 24,
              width: 120,
              height: 36,
            },
          ],
          clicks: [
            {
              id: `click-${entry.id}`,
              x: 84,
              y: 166,
              target: entry.detail ?? 'login-submit',
            },
          ],
        }
        testSteps[1] = { ...testSteps[1], status: 'passed' }
        testSteps[2] = { ...testSteps[2], status: 'running' }
        terminalLines.push('→ click button[data-testid="login-submit"]')
        break
      case 'screenshot':
        testSteps[2] = { ...testSteps[2], status: 'passed' }
        testSteps[3] = { ...testSteps[3], status: 'running' }
        screenshots.push({
          id: entry.id,
          label: entry.detail ?? 'screenshot',
          at: entry.at,
        })
        terminalLines.push('📸 screenshot saved — login-flow-after-click.png')
        break
      case 'build_passed':
        testSteps[3] = { ...testSteps[3], status: 'passed' }
        testSteps.forEach((step, index) => {
          if (step.status === 'pending') testSteps[index] = { ...step, status: 'passed' }
        })
        terminalLines.push('✓ BUILD PASSED — vite build completed')
        terminalLines.push('✓ 1 passed (4.2s)')
        break
      default:
        break
    }
  })

  return {
    visibleTimeline: slice,
    visibleTerminalLines: terminalLines,
    browser,
    activeFileId,
    testSteps,
    screenshots,
    latestFileChange,
  }
}

export const VISUAL_LAB_INTEGRATIONS = {
  execution: '/ops/execution',
  runtime: '/ops/runtime/runs/run-apl-max-code-audit',
  handoffs: `/ops/handoffs?project=${encodeURIComponent(AI_PHOTO_LAB_PROJECT_ID)}`,
  reports: '/ops/reports/report-qa-build',
  canvas: `/ops/canvas?projectId=${encodeURIComponent(AI_PHOTO_LAB_PROJECT_ID)}`,
  controlRoom: AI_PHOTO_LAB_CONTROL_ROOM_PATH,
} as const
