import {
  GEO_ACCURACY_LABEL,
  GEO_ACCURACY_MISSING_COLOR,
  GEO_ACCURACY_MISSING_KEY,
  GEO_ACCURACY_RANGE_COLOR,
  GEO_ACCURACY_RANGE_KEYS,
  type GeoAccuracyRangeKey,
} from './geoAccuracyModel'

type Props = {
  enabled: ReadonlySet<GeoAccuracyRangeKey>
  onToggle: (key: GeoAccuracyRangeKey) => void
}

export function GeoAccuracyLegend({ enabled, onToggle }: Props) {
  return (
    <fieldset
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 12,
        margin: '0 0 12px',
        minWidth: 0,
      }}
    >
      <legend style={{ padding: '0 6px', fontWeight: 700 }}>Диапазоны</legend>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {GEO_ACCURACY_RANGE_KEYS.map((key) => {
          const on = enabled.has(key)
          return (
            <label
              key={key}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                borderRadius: 999,
                border: '1px solid #e5e7eb',
                background: on ? '#fff' : '#f8fafc',
                color: on ? '#111827' : '#6b7280',
              }}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => onToggle(key)}
                aria-label={`${GEO_ACCURACY_LABEL[key]} на карте`}
                style={{ width: 16, height: 16, margin: 0, padding: 0 }}
              />
              <span
                aria-hidden="true"
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: GEO_ACCURACY_RANGE_COLOR[key],
                  flex: '0 0 auto',
                }}
              />
              <span>{GEO_ACCURACY_LABEL[key]}</span>
            </label>
          )
        })}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            borderRadius: 999,
            border: '1px solid #e5e7eb',
            background: '#f8fafc',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: GEO_ACCURACY_MISSING_COLOR,
              flex: '0 0 auto',
            }}
          />
          <span>{GEO_ACCURACY_LABEL[GEO_ACCURACY_MISSING_KEY]}</span>
          <span className="muted small">клетку не красит</span>
        </span>
      </div>
      <p className="muted small" style={{ margin: '10px 0 0' }}>
        Цвет клетки берётся у включённого диапазона с наибольшим числом. Два равных максимума оставляют клетку без заливки.
        Выключенный диапазон из цвета и из подсказки уходит. Столбцы диаграммы остаются все.
      </p>
    </fieldset>
  )
}
