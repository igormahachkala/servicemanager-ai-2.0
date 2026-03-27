import { Link } from 'react-router-dom'

export function RequestAccessPage() {
  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 560, margin: '40px auto' }}>
        <h1 style={{ marginBottom: 12 }}>Связаться с поддержкой</h1>
        <p className="muted" style={{ marginBottom: 16 }}>
          Самостоятельное создание компаний отключено. Если вам нужен доступ для новой компании или вы хотите оставить заявку в поддержку, свяжитесь с командой ServiceManager.AI.
        </p>

        <div className="panel" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Подключение новой компании</div>
          <div className="muted small" style={{ marginBottom: 12 }}>
            Платформенный администратор создаёт компанию и первого администратора вручную. В письме укажите название компании, город и контактное лицо.
          </div>
          <a href="mailto:support@servicemanager.ai?subject=Company%20provisioning%20request" style={{ textDecoration: 'none' }}>
            <button type="button">Запросить подключение</button>
          </a>
        </div>

        <div className="panel" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Заявка в поддержку</div>
          <div className="muted small" style={{ marginBottom: 12 }}>
            Если вам нужна помощь, demo-доступ или вы хотите оставить быстрый запрос, используйте тот же канал поддержки. Этот публичный intake flow не создаёт компанию и не требует логина.
          </div>
          <a href="mailto:support@servicemanager.ai?subject=Support%20request" style={{ textDecoration: 'none' }}>
            <button type="button" className="ghost">Оставить заявку</button>
          </a>
        </div>

        <Link to="/login" style={{ textDecoration: 'none' }}>
          <button type="button" className="ghost">Вернуться ко входу</button>
        </Link>
      </div>
    </div>
  )
}