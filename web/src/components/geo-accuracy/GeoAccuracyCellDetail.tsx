import {
  GEO_ACCURACY_BUCKET_KEYS,
  GEO_ACCURACY_LABEL,
  bucketColor,
  isRangeSwitchedOff,
  type GeoAccuracyCellView,
  type GeoAccuracyRangeKey,
} from './geoAccuracyModel'

type Props = {
  cell: GeoAccuracyCellView
  enabled: ReadonlySet<GeoAccuracyRangeKey>
  onClose: () => void
}

export function GeoAccuracyCellDetail({ cell, enabled, onClose }: Props) {
  return (
    <section className="panel" aria-label="Счётчики выбранной клетки" style={{ marginTop: 12 }}>
      <div className="row" style={{ alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Счётчики клетки</h2>
        <button type="button" className="ghost" onClick={onClose}>
          Закрыть
        </button>
      </div>
      <div>
        {GEO_ACCURACY_BUCKET_KEYS.map((key) => {
          const switchedOff = isRangeSwitchedOff(key, enabled)
          return (
            <div
              key={key}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                padding: '6px 0',
                borderTop: '1px solid #f1f5f9',
                color: switchedOff ? '#6b7280' : '#111827',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: bucketColor(key),
                    flex: '0 0 auto',
                  }}
                />
                <span>{GEO_ACCURACY_LABEL[key]}</span>
                {switchedOff ? <span className="small">выключен</span> : null}
              </span>
              <strong>{cell.counts[key].toLocaleString('ru-RU')}</strong>
            </div>
          )
        })}
      </div>
    </section>
  )
}
