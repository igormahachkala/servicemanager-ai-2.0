import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as api from '../lib/api'

export function RegisterPage() {
  const navigate = useNavigate()

  const [backendUrl, setBackendUrl] = useState(api.getBaseUrl())
  const [companyName, setCompanyName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      api.setBaseUrl(backendUrl)

      const result = await api.register({
        companyName: companyName.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
      })

      api.setToken(result.access_token)
      api.setCompanyLabel(result.user.companyName || result.user.email)
      navigate('/board')
    } catch (err: any) {
      setError(err?.message || 'Не удалось зарегистрироваться')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 560, margin: '40px auto' }}>
        <h1 style={{ marginBottom: 8 }}>Регистрация компании</h1>
        <div className="muted" style={{ marginBottom: 20 }}>
          Создайте компанию, первого администратора и сразу войдите в систему.
        </div>

        {error && (
          <div className="alert" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="form">
          <label>
            URL backend
            <input
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              placeholder="http://localhost:3001"
              disabled={loading}
            />
          </label>

          <label>
            Company name
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Service"
              disabled={loading}
            />
          </label>

          <label>
            First name
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Ivan"
              disabled={loading}
            />
          </label>

          <label>
            Last name
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Petrov"
              disabled={loading}
            />
          </label>

          <label>
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@company.com"
              autoComplete="username"
              disabled={loading}
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              disabled={loading}
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? 'Создаем компанию...' : 'Создать компанию'}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <span className="muted">Уже есть аккаунт? </span>
          <Link to="/login">Войти</Link>
        </div>
      </div>
    </div>
  )
}
