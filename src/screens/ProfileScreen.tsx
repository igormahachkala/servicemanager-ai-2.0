import { useState, useEffect } from 'react'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import * as api from '../api/client'

type Contour = 'mobile' | 'management'

function initials(name: string, email: string): string {
  const n = name.trim()
  if (n) { const p = n.split(/\s+/); return (p[0]?.[0] || '').toUpperCase() + (p[1]?.[0] || '').toUpperCase() }
  return (email[0] || '?').toUpperCase()
}
const roleLabelMap: Record<string, string> = { TECHNICIAN: 'Техник', CLIENT: 'Клиент', ADMIN: 'Администратор', MASTER: 'Мастер', DISPATCHER: 'Диспетчер', NETWORK_DIRECTOR: 'Директор сети', TERRITORIAL_MANAGER: 'Терр. менеджер', PLATFORM_ADMIN: 'Платформа' }

// Профиль (живой режим): визуал 1:1 из Figma Make, данные из GET /auth/me.
export function ProfileScreen({ role, onRoleChange, contour, onContourChange, onOpenCompany, onOpenSettings, onBack, onLogout }: {
  role: string
  onRoleChange: (r: string) => void
  contour: Contour
  onContourChange: (c: Contour) => void
  onOpenCompany: () => void
  onOpenSettings: () => void
  onBack: () => void
  onLogout: () => void
}) {
  const [me, setMe] = useState<api.Me | null>(null)
  useEffect(() => { api.me().then(setMe).catch(() => {}) }, [])

  const name = me ? [me.firstName, me.lastName].filter(Boolean).join(' ').trim() : ''
  const email = me?.email || ''
  const realRole = me?.role || role
  const roleLabel = roleLabelMap[realRole] || realRole
  const roleBadge = realRole === 'TECHNICIAN' ? 'bg-blue-100 text-blue-700' : realRole === 'CLIENT' ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="bg-white border-b border-slate-100 flex-shrink-0 flex items-center gap-2 px-3 py-2.5">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 active:bg-slate-200"><IconChevronLeft size={18} className="text-slate-700" /></button>
        <h1 className="text-[15px] font-bold text-slate-900">Профиль</h1>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {/* Шапка профиля */}
        <div className="bg-white px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-md flex-shrink-0"><span className="text-white text-[22px] font-bold">{me ? initials(name, email) : '—'}</span></div>
            <div>
              {/* TODO: lastName/avatarUrl в API пустые → показываем firstName/инициалы */}
              <p className="text-[18px] font-bold text-slate-900">{name || email || 'Пользователь'}</p>
              <p className="text-[12px] text-slate-400">{email || '—'}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${roleBadge}`}>{roleLabel}</span>
                <span className="text-[11px] font-bold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">{contour === 'mobile' ? '📱 Мобильный' : '🖥 Управление'}</span>
              </div>
            </div>
          </div>
          {me?.companyName && <p className="text-[11px] text-slate-400 mt-3">{me.companyName}</p>}
        </div>

        {/* Переключить режим */}
        <div className="bg-white px-5 py-4 border-b border-slate-100 mt-3">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Переключить режим</p>
          <div className="flex flex-col gap-2">
            {([['mobile', '📱 Мобильная работа', 'Управление заявками, обходы, чеки'], ['management', '🖥 Управление компанией', 'Аналитика, объекты, сотрудники']] as const).map(([k, l, sub]) => (
              <button key={k} onClick={() => onContourChange(k)} className={`flex items-start gap-3 px-4 py-3.5 rounded-2xl border text-left transition-all ${contour === k ? 'bg-blue-50 border-blue-300' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${contour === k ? 'border-blue-600' : 'border-slate-300'}`}>{contour === k && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}</div>
                <div><p className={`text-[13px] font-bold ${contour === k ? 'text-blue-700' : 'text-slate-700'}`}>{l}</p><p className="text-[11px] text-slate-400">{sub}</p></div>
              </button>
            ))}
          </div>
        </div>

        {/* Меню: Компания / Настройки */}
        <div className="bg-white mt-3 border-b border-slate-100">
          {[['🏢', 'Компания', onOpenCompany], ['⚙️', 'Настройки', onOpenSettings]].map(([icon, label, fn], i, arr) => (
            <button key={label as string} onClick={fn as () => void} className={`w-full flex items-center gap-3 px-5 py-4 active:bg-slate-50 transition-colors ${i < arr.length - 1 ? 'border-b border-slate-50' : ''}`}>
              <span className="text-[18px] w-7 text-center">{icon as string}</span>
              <span className="flex-1 text-[14px] font-medium text-slate-700 text-left">{label as string}</span>
              <IconChevronRight size={14} className="text-slate-300" />
            </button>
          ))}
        </div>

        {/* Демо: смена роли */}
        <div className="bg-amber-50 mx-4 mt-3 rounded-2xl border border-amber-200 px-4 py-3">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-2">Демо: переключить роль</p>
          <div className="flex gap-2">
            {(['TECHNICIAN', 'CLIENT', 'ADMIN'] as const).map(r => (
              <button key={r} onClick={() => onRoleChange(r)} className={`flex-1 text-[10px] font-bold py-2 rounded-xl border transition-all active:scale-95 ${role === r ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                {{ TECHNICIAN: 'Техник', CLIENT: 'Клиент', ADMIN: 'Админ' }[r]}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-amber-500 mt-1.5">Меняет доступные действия в карточке заявки</p>
        </div>

        {/* Выйти */}
        <div className="bg-white mt-3"><button onClick={onLogout} className="w-full flex items-center gap-3 px-5 py-4 active:bg-red-50 transition-colors"><span className="text-[18px] w-7 text-center">🚪</span><span className="flex-1 text-[14px] font-medium text-red-600 text-left">Выйти из системы</span></button></div>
        <div className="h-6" />
      </div>
    </div>
  )
}

export default ProfileScreen
