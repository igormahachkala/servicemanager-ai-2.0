import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../lib/api'
import { canAccessManagementDesktop, managementHomePath } from '../lib/navigation'
import { ClientContourCard } from './ClientContourCard'
import { mobilePath } from './mobileRoute'

type ManagementLink = {
  id: string
  label: string
  hint: string
  to: string
}

const WORKFORCE_ROLES = new Set<api.Role>(['ADMIN', 'MASTER', 'DISPATCHER', 'NETWORK_DIRECTOR', 'TERRITORIAL_MANAGER'])
const INSPECTION_TEMPLATE_ROLES = new Set<api.Role>(['PLATFORM_ADMIN', 'ADMIN', 'DISPATCHER', 'MASTER', 'NETWORK_DIRECTOR'])

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function ManagementIcon({ id }: { id: string }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  if (id === 'desktop') {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="6" height="8" rx="1" />
        <rect x="4" y="16" width="6" height="4" rx="1" />
        <rect x="14" y="4" width="6" height="4" rx="1" />
        <rect x="14" y="12" width="6" height="8" rx="1" />
      </svg>
    )
  }
  if (id === 'companies' || id === 'company') {
    return (
      <svg {...common}>
        <path d="M3 21h18" />
        <path d="M5 21V7l8 -4v18" />
        <path d="M19 21V11l-6 -4" />
      </svg>
    )
  }
  if (id === 'employees' || id === 'workforce') {
    return (
      <svg {...common}>
        <circle cx="9" cy="7" r="3" />
        <path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        <path d="M21 21v-2a4 4 0 0 0 -3 -3.85" />
      </svg>
    )
  }
  if (id === 'locations' || id === 'categories' || id === 'specializations') {
    return (
      <svg {...common}>
        <path d="M12 21s-6 -5.33 -6 -10a6 6 0 1 1 12 0c0 4.67 -6 10 -6 10z" />
        <circle cx="12" cy="11" r="2" />
      </svg>
    )
  }
  if (id === 'permissions' || id === 'access') {
    return (
      <svg {...common}>
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    )
  }
  if (id === 'inspection' || id === 'inspectionTemplates') {
    return (
      <svg {...common}>
        <path d="M9 5h6" />
        <path d="M9 3h6a2 2 0 0 1 2 2v1h1a2 2 0 0 1 2 2v11a2 2 0 0 1 -2 2H6a2 2 0 0 1 -2 -2V8a2 2 0 0 1 2 -2h1V5a2 2 0 0 1 2 -2z" />
        <path d="M9 14l2 2l4 -5" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  )
}

function canOpenCompanySettings(role?: api.Role | null) {
  return !!role && role !== 'TECHNICIAN' && role !== 'STAFF'
}

export function MobileSettingsPage() {
  const location = useLocation()
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  const currentScope = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const linked = (params.get('linkedClientCompanyId') || api.getLinkedClientCompanyId(meQ.data)).trim()
    const observer = (params.get('companyId') || api.getObserverCompanyId(meQ.data)).trim()
    return {
      linkedClientCompanyId: linked || undefined,
      companyId: observer || undefined,
    }
  }, [location.search, meQ.data])

  const managementLinks = useMemo<ManagementLink[]>(() => {
    const role = meQ.data?.role
    if (!role) return []

    const links: ManagementLink[] = []
    const scoped = (to: string) => api.appendScopeToPath(to, currentScope, meQ.data)
    const fullAdmin = api.isFullAdminDesktopNavRole(role)

    if (canAccessManagementDesktop(role)) {
      links.push({
        id: 'desktop',
        label: 'Управленческая часть',
        hint: 'Доска, реестр заявок и отчёты',
        to: scoped(managementHomePath(role)),
      })
    }
    if (role === 'PLATFORM_ADMIN') {
      links.push({
        id: 'companies',
        label: 'Компании платформы',
        hint: 'Клиенты, провайдеры и контуры',
        to: scoped('/companies'),
      })
      links.push({
        id: 'permissions',
        label: 'Роли и права',
        hint: 'Матрица разрешений платформы',
        to: scoped('/platform/permissions'),
      })
    }
    if (canOpenCompanySettings(role)) {
      links.push({
        id: 'company',
        label: 'Компания',
        hint: 'Реквизиты, публичная заявка и параметры компании',
        to: scoped('/company'),
      })
    }
    if (fullAdmin) {
      links.push({
        id: 'employees',
        label: 'Сотрудники',
        hint: 'Пользователи и рабочие роли',
        to: scoped('/employees'),
      })
      links.push({
        id: 'locations',
        label: 'Точки и категории',
        hint: 'Объекты, категории проблем и специализации',
        to: scoped('/locations'),
      })
      links.push({
        id: 'access',
        label: 'Конструктор доступа',
        hint: 'Проверка и настройка пользовательского доступа',
        to: scoped('/access-constructor'),
      })
    }
    if (WORKFORCE_ROLES.has(role)) {
      links.push({
        id: 'workforce',
        label: 'Смены сотрудников',
        hint: 'Отчёт по сменам и трудозатратам',
        to: scoped(mobilePath(location.pathname, '/workforce')),
      })
    }
    if (role !== 'STAFF') {
      links.push({
        id: 'inspection',
        label: 'Обходы',
        hint: 'История и выполнение обходов объектов',
        to: scoped(mobilePath(location.pathname, '/inspection')),
      })
    }
    if (INSPECTION_TEMPLATE_ROLES.has(role)) {
      links.push({
        id: 'inspectionTemplates',
        label: 'Шаблоны обходов',
        hint: 'Настройка сценариев обходов в управленческой части',
        to: scoped('/inspection/templates'),
      })
    }

    return links
  }, [currentScope, location.pathname, meQ.data])

  const backHref = api.appendScopeToPath(mobilePath(location.pathname, ''), currentScope, meQ.data)

  return (
    <div className="mobileSection">
      <div className="mobileTicketDetailsToolbar">
        <Link to={backHref} className="mobileDetailsBackLink mobilePatrolBackLink">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Главная
        </Link>
      </div>

      <h1 className="mobileTitle">Настройки</h1>
      <div className="mobileSubtitle">Системные и управленческие разделы</div>

      <ClientContourCard />

      <div className="mobileCard mobileProfileMenu" style={{ marginTop: 8 }}>
        <div className="mobileProfileSectionLabel" style={{ padding: '2px 0 4px' }}>Управление</div>
        {meQ.isLoading ? <div className="mobileMeta">Загружаем доступные разделы…</div> : null}
        {meQ.isError ? (
          <div className="mobileNotice mobileNoticeError">
            {(meQ.error as { message?: string } | null)?.message || String(meQ.error)}
          </div>
        ) : null}
        {!meQ.isLoading && !meQ.isError && managementLinks.length === 0 ? (
          <div className="mobileEmptyState" role="status">
            <div className="mobileEmptyStateTitle">Для вашей роли нет доступных системных разделов</div>
          </div>
        ) : null}
        {managementLinks.map((item) => (
          <Link key={item.id} to={item.to} className="mobileProfileMenuItem">
            <span className="mobileProfileMenuIcon" aria-hidden>
              <ManagementIcon id={item.id} />
            </span>
            <span className="mobileProfileMenuLabel">
              {item.label}
              <span className="mobileFieldHint" style={{ display: 'block', margin: 0, fontWeight: 400 }}>{item.hint}</span>
            </span>
            <span className="mobileProfileMenuChevron" aria-hidden><ChevronRight /></span>
          </Link>
        ))}
      </div>

      <div className="mobileCard" style={{ marginTop: 8, textAlign: 'center' }}>
        <div className="mobileMeta">Сервис Менеджер · Mobile Workspace V1</div>
      </div>
    </div>
  )
}
