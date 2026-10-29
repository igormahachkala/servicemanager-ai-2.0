import type { OnSiteArrivalState, OnSiteShiftFilter, OnSiteSort } from '../../lib/api'
import { ON_SITE_SORT_OPTIONS, ON_SITE_STATE_OPTIONS } from './onSiteDisplay'

export type OnSiteFilterValue = {
  state: '' | OnSiteArrivalState
  shift: '' | OnSiteShiftFilter
  name: string
  sort: OnSiteSort
}

type Props = {
  surface: 'desktop' | 'mobile'
  value: OnSiteFilterValue
  onChange: (next: OnSiteFilterValue) => void
}

export function OnSiteFilters({ surface, value, onChange }: Props) {
  const patch = (part: Partial<OnSiteFilterValue>) => onChange({ ...value, ...part })
  const shellClass = surface === 'mobile' ? 'mobileCard mobileForm' : 'panel'

  return (
    <div className={shellClass} style={{ marginBottom: 12, display: 'grid', gap: 10 }}>
      <label>
        Состояние
        <select value={value.state} onChange={(event) => patch({ state: event.target.value as OnSiteFilterValue['state'] })}>
          <option value="">Все состояния</option>
          {ON_SITE_STATE_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
      </label>
      <label>
        Смена
        <select value={value.shift} onChange={(event) => patch({ shift: event.target.value as OnSiteFilterValue['shift'] })}>
          <option value="">Любая смена</option>
          <option value="open">Открыта</option>
          <option value="closed">Закрыта</option>
        </select>
      </label>
      <label>
        Имя техника
        <input value={value.name} onChange={(event) => patch({ name: event.target.value })} placeholder="Имя" />
      </label>
      <label>
        Сортировка
        <select value={value.sort} onChange={(event) => patch({ sort: event.target.value as OnSiteSort })}>
          {ON_SITE_SORT_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
      </label>
    </div>
  )
}
