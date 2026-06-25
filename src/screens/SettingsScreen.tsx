import { useState } from 'react'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'

// Настройки (1:1 из Figma Make). Toggles — локальный state (в API нет).
export function SettingsScreen({ onBack }: { onBack: () => void }) {
  // TODO: notif/max/darkMode — нет в API, локальный state
  const [notif, setNotif] = useState(true)
  const [maxEnabled, setMaxEnabled] = useState(true)
  const [darkMode, setDarkMode] = useState(false)
  const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
    <button onClick={onToggle} className={`w-11 h-6 rounded-full transition-all flex-shrink-0 ${on ? 'bg-blue-600' : 'bg-slate-200'}`}><div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform mx-0.5 ${on ? 'translate-x-5' : ''}`} /></button>
  )
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="bg-white border-b border-slate-100 flex-shrink-0 flex items-center gap-2 px-3 py-2.5">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 active:bg-slate-200"><IconChevronLeft size={18} className="text-slate-700" /></button>
        <h1 className="text-[15px] font-bold text-slate-900">Настройки</h1>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="bg-white mt-3 rounded-2xl mx-4 border border-slate-100 overflow-hidden">
          {[{ icon: '🔔', label: 'Уведомления', sub: 'Push-уведомления о заявках', on: notif, fn: () => setNotif(p => !p) }, { icon: '🤖', label: 'MAX Ассистент', sub: 'ИИ-помощник для работы', on: maxEnabled, fn: () => setMaxEnabled(p => !p) }, { icon: '🌙', label: 'Тёмная тема', sub: 'Изменить оформление', on: darkMode, fn: () => setDarkMode(p => !p) }].map((item, i, arr) => (
            <div key={item.label} className={`flex items-center gap-3 px-4 py-3.5 ${i < arr.length - 1 ? 'border-b border-slate-50' : ''}`}>
              <span className="text-[20px] w-8 text-center">{item.icon}</span>
              <div className="flex-1 min-w-0"><p className="text-[13px] font-semibold text-slate-800">{item.label}</p><p className="text-[11px] text-slate-400">{item.sub}</p></div>
              <Toggle on={item.on} onToggle={item.fn} />
            </div>
          ))}
        </div>
        <div className="bg-white mt-3 rounded-2xl mx-4 border border-slate-100 overflow-hidden">
          {[{ icon: '🌐', label: 'Язык', val: 'Русский' }, { icon: '🆘', label: 'Поддержка', val: '' }].map((item, i, arr) => (
            <div key={item.label} className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer active:bg-slate-50 ${i < arr.length - 1 ? 'border-b border-slate-50' : ''}`}>
              <span className="text-[20px] w-8 text-center">{item.icon}</span>
              <span className="flex-1 text-[13px] font-semibold text-slate-800">{item.label}</span>
              <div className="flex items-center gap-2">{item.val && <span className="text-[12px] text-slate-400">{item.val}</span>}<IconChevronRight size={14} className="text-slate-300" /></div>
            </div>
          ))}
        </div>
        <div className="bg-white mt-3 rounded-2xl mx-4 border border-slate-100 px-4 py-4">
          <p className="text-[12px] text-slate-400 text-center">ServiceManager.AI · Версия 2.0.1</p>
          <p className="text-[10px] text-slate-300 text-center mt-0.5">Mobile UX V2 Final</p>
        </div>
        <div className="h-6" />
      </div>
    </div>
  )
}

export default SettingsScreen
