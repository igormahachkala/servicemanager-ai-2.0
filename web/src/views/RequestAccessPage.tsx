import { Link } from 'react-router-dom'
import { SupportContactBlock } from '../components/SupportContactBlock'

export function RequestAccessPage() {
  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 560, margin: '40px auto' }}>
        <h1 style={{ marginBottom: 12 }}>Связаться с поддержкой</h1>
        <p className="muted" style={{ marginBottom: 16 }}>
          Самостоятельное создание компаний отключено. Если вам нужен доступ для новой компании, demo или помощь по платформе — напишите в чат поддержки (Telegram или MAX). Платформенный администратор подключит компанию и первого администратора вручную: в сообщении укажите название компании, город и контактное лицо.
        </p>

        <div className="panel" style={{ marginBottom: 16 }}>
          <SupportContactBlock titleTag="h2" />
        </div>

        <Link to="/login" style={{ textDecoration: 'none' }}>
          <button type="button" className="ghost">
            Вернуться ко входу
          </button>
        </Link>
      </div>
    </div>
  )
}
