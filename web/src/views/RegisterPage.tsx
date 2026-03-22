import { Link } from 'react-router-dom'

export function RegisterPage() {
  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 560, margin: '40px auto' }}>
        <h1 style={{ marginBottom: 8 }}>Публичная регистрация отключена</h1>
        <div className="muted" style={{ marginBottom: 20 }}>
          Новые компании создаются только через PLATFORM_ADMIN в разделе управления компаниями.
        </div>

        <div className="panel" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Что делать дальше</div>
          <div className="muted small">Обратитесь к администратору платформы, чтобы он создал компанию и первого администратора компании.</div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <Link to="/login">Перейти ко входу</Link>
        </div>
      </div>
    </div>
  )
}