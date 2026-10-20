import { Link, useParams, useSearchParams } from 'react-router-dom'

export function PublicQuickRequestSuccessPage() {
  const { token = '' } = useParams()
  const [params] = useSearchParams()
  const ticketNumber = params.get('ticketNumber') || params.get('ticketId') || ''
  const companyName = params.get('companyName') || 'ServiceManager.AI'

  return (
    <div className="page" style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
      <div className="card" style={{ maxWidth: 520, margin: '24px auto', display: 'grid', gap: 16 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: '#ecfdf5',
            color: '#047857',
            display: 'grid',
            placeItems: 'center',
            fontSize: 28,
            fontWeight: 800,
          }}
        >
          ✓
        </div>

        <div>
          <h1 style={{ marginBottom: 8 }}>Заявка отправлена</h1>
          <div className="muted">
            Мы передали запрос в сервисную команду {companyName}. С вами свяжутся по телефону, который вы указали.
          </div>
        </div>

        {ticketNumber ? (
          <div className="panel" style={{ padding: 16 }}>
            <div className="muted small" style={{ marginBottom: 6 }}>Номер заявки</div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '0.06em' }}>{ticketNumber}</div>
          </div>
        ) : null}

        <div style={{ display: 'grid', gap: 10 }}>
          <Link to={'/r/' + token} style={{ textDecoration: 'none' }}>
            <button type="button" style={{ width: '100%' }}>Создать ещё одну заявку</button>
          </Link>
          <Link to={'/r/' + token} style={{ textDecoration: 'none' }}>
            <button type="button" className="ghost" style={{ width: '100%' }}>Сканировать снова</button>
          </Link>
        </div>
      </div>
    </div>
  )
}