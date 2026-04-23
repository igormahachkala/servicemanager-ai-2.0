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
      id: 'operations',
      label: 'Операции',
      items: [
        { id: 'board', label: 'Board', to: '/board' },
        { id: 'tickets', label: 'Заявки', to: '/tickets' },
        { id: 'employees', label: 'Сотрудники', to: '/employees' },
        { id: 'locations', label: 'Точки', to: '/locations' },
        { id: 'settings', label: 'Настройки', to: '/settings' },
      ],
    },
  ],
  topbar: [
    { id: 'board', label: 'Board', to: '/board' },
    { id: 'tickets', label: 'Заявки', to: '/tickets' },
    { id: 'employees', label: 'Сотрудники', to: '/employees' },
    { id: 'locations', label: 'Точки', to: '/locations' },
    { id: 'settings', label: 'Настройки', to: '/settings' },
  ],
}

export const tenantNavigation: ShellNavigationConfig = {
  sidebar: [
    {
      id: 'operations',
      label: 'Операции',
      items: [
        { id: 'board', label: 'Board', to: '/board' },
        { id: 'tickets', label: 'Заявки', to: '/tickets' },
        { id: 'employees', label: 'Сотрудники', to: '/employees' },
        { id: 'locations', label: 'Точки', to: '/locations' },
        { id: 'settings', label: 'Настройки', to: '/settings' },
      ],
    },
  ],
  topbar: [
    { id: 'board', label: 'Board', to: '/board' },
    { id: 'tickets', label: 'Заявки', to: '/tickets' },
    { id: 'employees', label: 'Сотрудники', to: '/employees' },
    { id: 'locations', label: 'Точки', to: '/locations' },
    { id: 'settings', label: 'Настройки', to: '/settings' },
  ],
}
