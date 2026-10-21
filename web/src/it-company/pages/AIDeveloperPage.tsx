import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import * as api from '../../lib/api'
import { canViewITCompany } from '../access'
import { TaskPanel, TaskHistoryItem, type MockTask } from '../components/TaskPanel'
import { PlanPanel, type MockPlanStep } from '../components/PlanPanel'
import { PatchPreviewPanel, type MockPatch } from '../components/PatchPreviewPanel'
import { BuildPanel, type MockBuild } from '../components/BuildPanel'
import { ChecksPanel, type MockCheck } from '../components/ChecksPanel'
import { PullRequestPanel, type MockPR } from '../components/PullRequestPanel'

// ── Mock workspace state ────────────────────────────────────────────────────

const MOCK_TASKS: MockTask[] = [
  {
    id: 'mock-003',
    title: 'Добавить экспорт отчётов в PDF',
    prompt:
      'Реализовать возможность экспорта списка заявок в PDF-файл через кнопку в TicketListPage. Поддержать фильтры, которые уже выбраны на странице. Формат: A4 с заголовком, таблицей и постраничной нумерацией.',
    status: 'IN_PROGRESS',
    createdAt: '2026-06-17T09:00:00Z',
    updatedAt: '2026-06-17T09:47:00Z',
  },
  {
    id: 'mock-002',
    title: 'Добавить SLA-таймер на карточку заявки',
    prompt:
      'На карточке заявки показывать оставшееся время SLA в виде счётчика. Если SLA просрочен — подсвечивать красным.',
    status: 'DONE',
    createdAt: '2026-06-15T14:00:00Z',
    updatedAt: '2026-06-15T17:22:00Z',
  },
  {
    id: 'mock-001',
    title: 'Оптимизировать запрос board по статусам',
    prompt:
      'Запрос GET /board грузит все заявки и группирует в JS. Перенести группировку на сторону БД через Prisma groupBy.',
    status: 'DONE',
    createdAt: '2026-06-10T10:30:00Z',
    updatedAt: '2026-06-10T12:05:00Z',
  },
]

const MOCK_PLAN: MockPlanStep[] = [
  {
    id: 1,
    text: 'Проанализировать структуру TicketListPage и текущие фильтры',
    status: 'done',
    files: ['web/src/views/TicketListPage.tsx'],
  },
  {
    id: 2,
    text: 'Установить pdf-lib и добавить типы в package.json',
    status: 'done',
    files: ['web/package.json'],
  },
  {
    id: 3,
    text: 'Создать утилиту generateTicketsPdf с шаблоном A4',
    status: 'done',
    files: ['web/src/lib/pdfExport.ts'],
  },
  {
    id: 4,
    text: 'Добавить кнопку «Экспорт PDF» и хук usePdfExport',
    status: 'in_progress',
    detail: 'Пишу хук usePdfExport, интегрирую с текущими фильтрами страницы…',
  },
  {
    id: 5,
    text: 'Написать тесты для pdf-генератора (vitest)',
    status: 'pending',
  },
  {
    id: 6,
    text: 'Обновить CHANGELOG и документацию компонента',
    status: 'pending',
  },
]

const MOCK_PATCHES: MockPatch[] = [
  {
    filename: 'web/src/views/TicketListPage.tsx',
    additions: 14,
    deletions: 1,
    lines: [
      { type: 'hunk', text: '@@ -1,6 +1,7 @@' },
      { type: 'add', text: "import { usePdfExport } from '../hooks/usePdfExport'" },
      { type: 'context', text: 'import { useQuery } from "@tanstack/react-query"' },
      { type: 'context', text: '' },
      { type: 'hunk', text: '@@ -42,6 +43,11 @@' },
      { type: 'context', text: '  const tickets = ticketsQ.data || []' },
      { type: 'context', text: '' },
      { type: 'add', text: '  const { exportPdf, isPending: isExporting } = usePdfExport({' },
      { type: 'add', text: '    tickets,' },
      { type: 'add', text: '    filters: activeFilters,' },
      { type: 'add', text: '  })' },
      { type: 'add', text: '' },
      { type: 'context', text: '  return (' },
      { type: 'context', text: '    <div>' },
      { type: 'hunk', text: '@@ -67,6 +73,13 @@' },
      { type: 'context', text: '          <h2>Заявки</h2>' },
      { type: 'remove', text: '          <div />' },
      { type: 'add', text: '          <button' },
      { type: 'add', text: '            type="button"' },
      { type: 'add', text: '            onClick={exportPdf}' },
      { type: 'add', text: '            disabled={isExporting || tickets.length === 0}' },
      { type: 'add', text: '          >' },
      { type: 'add', text: '            {isExporting ? "Генерируем PDF…" : "Экспорт PDF"}' },
      { type: 'add', text: '          </button>' },
    ],
  },
  {
    filename: 'web/src/lib/pdfExport.ts',
    additions: 48,
    deletions: 0,
    lines: [
      { type: 'hunk', text: '@@ -0,0 +1,48 @@' },
      { type: 'add', text: "import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'" },
      { type: 'add', text: "import type { TicketListItem } from './api'" },
      { type: 'add', text: '' },
      { type: 'add', text: 'export async function generateTicketsPdf(tickets: TicketListItem[]) {' },
      { type: 'add', text: '  const doc = await PDFDocument.create()' },
      { type: 'add', text: '  const font = await doc.embedFont(StandardFonts.Helvetica)' },
      { type: 'add', text: '  const page = doc.addPage([595, 842]) // A4' },
      { type: 'add', text: '  const { width, height } = page.getSize()' },
      { type: 'add', text: '' },
      { type: 'add', text: '  page.drawText("Список заявок", { x: 50, y: height - 60,' },
      { type: 'add', text: '    size: 20, font, color: rgb(0.07, 0.07, 0.07) })' },
      { type: 'add', text: '  // … таблица заявок …' },
      { type: 'add', text: '' },
      { type: 'add', text: '  return doc.saveAsBase64({ dataUri: true })' },
      { type: 'add', text: '}' },
    ],
  },
]

const MOCK_BUILD: MockBuild = {
  status: 'running',
  branch: 'ai/pdf-export-tickets',
  commit: 'a4f2c1d',
  duration: '1m 12s',
  steps: [
    { name: 'Install dependencies', status: 'pass', duration: '18s' },
    { name: 'TypeScript typecheck', status: 'pass', duration: '22s' },
    { name: 'Vite build', status: 'running', detail: 'bundling…' },
    { name: 'Unit tests (vitest)', status: 'pending' },
  ],
}

const MOCK_CHECKS: MockCheck[] = [
  { name: 'TypeScript', status: 'pass', detail: '0 errors' },
  { name: 'ESLint', status: 'pass', detail: '0 warnings' },
  { name: 'Vite Build', status: 'running', detail: 'bundling…' },
  { name: 'Unit Tests', status: 'pending' },
  { name: 'Lighthouse CI', status: 'pending' },
]

const MOCK_PR: MockPR = {
  title: 'feat(tickets): add PDF export for ticket list',
  body: `## Summary
- Добавлена кнопка «Экспорт PDF» в TicketListPage
- Создан хук \`usePdfExport\` и утилита \`generateTicketsPdf\`
- Экспорт учитывает текущие фильтры (статус, локация, период)
- Формат: A4, таблица с нумерацией страниц

## Test plan
- [ ] Открыть список заявок, нажать «Экспорт PDF»
- [ ] Проверить фильтрацию — PDF должен отражать активные фильтры
- [ ] Проверить пустой список — кнопка задизейблена

🤖 Generated by AI Developer`,
  branch: 'ai/pdf-export-tickets',
  baseBranch: 'main',
  additions: 62,
  deletions: 1,
  filesChanged: 3,
  status: 'draft',
  labels: ['ai-generated', 'feature', 'tickets'],
}

// ── Panel collapse state ────────────────────────────────────────────────────

type PanelKey = 'task' | 'plan' | 'patch' | 'build' | 'checks' | 'pr'

// ── Page ────────────────────────────────────────────────────────────────────

export function AIDeveloperPage() {
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const canView = canViewITCompany(meQ.data)

  const [selectedTaskId, setSelectedTaskId] = useState<string>(MOCK_TASKS[0].id)
  const [collapsed, setCollapsed] = useState<Record<PanelKey, boolean>>({
    task: false,
    plan: false,
    patch: false,
    build: false,
    checks: true,
    pr: false,
  })

  function toggle(key: PanelKey) {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  if (meQ.isLoading) {
    return <div className="muted">Загрузка…</div>
  }
  if (!canView) {
    return (
      <div className="panel" style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Раздел недоступен</div>
        <div className="muted small">Рабочее место AI Developer доступно только администратору платформы.</div>
      </div>
    )
  }

  const selectedTask = MOCK_TASKS.find((t) => t.id === selectedTaskId) || MOCK_TASKS[0]
  const isActiveTask = selectedTask.status === 'IN_PROGRESS'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link to="/it" style={{ color: '#9ca3af', fontSize: 13, textDecoration: 'none' }}>← IT Company</Link>
          </div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>
            AI Developer
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 20,
              background: '#fffbeb',
              border: '1px solid #fde68a',
              fontSize: 12,
              color: '#92400e',
              fontWeight: 600,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#d97706', display: 'inline-block' }} />
            В работе
          </div>
          <span
            style={{
              fontSize: 11,
              padding: '3px 9px',
              borderRadius: 6,
              background: '#f3f4f6',
              color: '#6b7280',
              fontWeight: 500,
              letterSpacing: '0.02em',
            }}
          >
            MOCK
          </span>
        </div>
      </div>

      {/* Two-column layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* Left: History sidebar */}
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            background: '#fff',
            overflow: 'hidden',
            position: 'sticky',
            top: 16,
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              background: '#f9fafb',
              borderBottom: '1px solid #e5e7eb',
              fontSize: 12,
              fontWeight: 700,
              color: '#6b7280',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>⑦ История</span>
            <span style={{ color: '#9ca3af', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
              {MOCK_TASKS.length} задач
            </span>
          </div>
          <div style={{ padding: '6px 6px', display: 'grid', gap: 2 }}>
            {MOCK_TASKS.map((task) => (
              <TaskHistoryItem
                key={task.id}
                task={task}
                selected={task.id === selectedTaskId}
                onClick={() => setSelectedTaskId(task.id)}
              />
            ))}
          </div>
          <div style={{ padding: '10px 12px', borderTop: '1px solid #f3f4f6' }}>
            <button
              type="button"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px dashed #d1d5db',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 13,
                color: '#6b7280',
                fontWeight: 500,
              }}
            >
              + Новая задача
            </button>
          </div>
        </div>

        {/* Right: Workspace */}
        <div style={{ display: 'grid', gap: 10 }}>
          {!isActiveTask && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                fontSize: 13,
                color: '#166534',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>✓</span>
              <span>Задача завершена. Показаны итоговые артефакты.</span>
            </div>
          )}

          <TaskPanel
            task={selectedTask}
            collapsed={collapsed.task}
            onToggle={() => toggle('task')}
          />

          <PlanPanel
            steps={MOCK_PLAN}
            collapsed={collapsed.plan}
            onToggle={() => toggle('plan')}
          />

          <PatchPreviewPanel
            patches={MOCK_PATCHES}
            collapsed={collapsed.patch}
            onToggle={() => toggle('patch')}
          />

          <BuildPanel
            build={MOCK_BUILD}
            collapsed={collapsed.build}
            onToggle={() => toggle('build')}
          />

          <ChecksPanel
            checks={MOCK_CHECKS}
            collapsed={collapsed.checks}
            onToggle={() => toggle('checks')}
          />

          <PullRequestPanel
            pr={MOCK_PR}
            collapsed={collapsed.pr}
            onToggle={() => toggle('pr')}
          />
        </div>
      </div>
    </div>
  )
}
