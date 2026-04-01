export type NavItem = {
  id: string
  label: string
  to: string
}

export type NavSection = {
  id: string
  label: string
  items: NavItem[]
}

export type ShellNavigationConfig = {
  sidebar: NavSection[]
  topbar: NavItem[]
}

export const platformNavigation: ShellNavigationConfig = {
  sidebar: [
    {
      id: 'platform',
      label: 'Платформа',
      items: [
        { id: 'companies', label: 'Компании', to: '/companies' },
        { id: 'contracts', label: 'Контракты', to: '/service-contracts' },
      ],
    },
  ],
  topbar: [
    { id: 'companies', label: 'Компании', to: '/companies' },
    { id: 'contracts', label: 'Контракты', to: '/service-contracts' },
  ],
}

export const tenantNavigation: ShellNavigationConfig = {
  sidebar: [
    {
      id: 'operations',
      label: 'Операции',
      items: [
        { id: 'board', label: 'Доска', to: '/board' },
        { id: 'inspection-runs', label: 'Обходы', to: '/inspection/runs' },
        { id: 'analytics', label: 'Аналитика', to: '/analytics' },
      ],
    },
    {
      id: 'company',
      label: 'Компания',
      items: [
        { id: 'company', label: 'Компания', to: '/company' },
        { id: 'locations', label: 'Локации', to: '/locations' },
        { id: 'employees', label: 'Сотрудники', to: '/employees' },
      ],
    },
    {
      id: 'settings',
      label: 'Настройки',
      items: [
        { id: 'categories', label: 'Категории', to: '/problem-categories' },
        { id: 'specializations', label: 'Специализации', to: '/specializations' },
        { id: 'inspection-templates', label: 'Шаблоны обхода', to: '/inspection/templates' },
        { id: 'settings', label: 'Настройки', to: '/settings' },
      ],
    },
  ],
  topbar: [
    { id: 'board', label: 'Доска', to: '/board' },
    { id: 'inspection-runs', label: 'Обходы', to: '/inspection/runs' },
    { id: 'analytics', label: 'Аналитика', to: '/analytics' },
    { id: 'company', label: 'Компания', to: '/company' },
    { id: 'create-ticket', label: 'Создать заявку', to: '/tickets/new' },
  ],
}
