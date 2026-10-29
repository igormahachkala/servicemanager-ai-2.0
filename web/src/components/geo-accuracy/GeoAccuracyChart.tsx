import { bucketColor, type GeoAccuracyBucketView } from './geoAccuracyModel'

type Props = {
  buckets: GeoAccuracyBucketView[] | null
  loading: boolean
}

export function GeoAccuracyChart({ buckets, loading }: Props) {
  const max = buckets ? Math.max(...buckets.map((item) => item.count), 0) : 0

  return (
    <section className="panel" aria-label="Диаграмма точности">
      <h2 style={{ margin: '0 0 6px', fontSize: 16 }}>Диаграмма</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        Столбцы считаются по всей платформе. Клетки карты считаются по выбранной компании провайдера.
      </p>

      {loading ? <div className="muted">Считаем столбцы.</div> : null}

      {!loading && !buckets ? <div className="muted">Столбцы не загрузились.</div> : null}

      {buckets ? (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, minWidth: 640 }}>
            {buckets.map((item) => {
              const pct = max === 0 ? 0 : (item.count / max) * 100
              return (
                <div
                  key={item.key}
                  style={{
                    flex: '1 0 64px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    minWidth: 64,
                  }}
                >
                  <div
                    style={{
                      height: 160,
                      width: '70%',
                      maxWidth: 48,
                      background: '#f1f5f9',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'flex-end',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: `${pct}%`,
                        background: bucketColor(item.key),
                        borderRadius: 6,
                        minHeight: item.count > 0 ? 2 : 0,
                      }}
                    />
                  </div>
                  <div style={{ fontWeight: 700, marginTop: 8 }}>{item.count.toLocaleString('ru-RU')}</div>
                  <div className="small" style={{ textAlign: 'center', marginTop: 4 }}>
                    {item.label}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </section>
  )
}
