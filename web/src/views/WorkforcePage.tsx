import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'

function dayInput(date: Date) {
  return date.toISOString().slice(0, 10)
}

function duration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours > 0 ? `${hours} ч ${rest} мин` : `${rest} мин`
}

function employeeName(user: api.WorkShiftItem['user']) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
}

export function WorkforcePage() {
  const queryClient = useQueryClient()
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const [from, setFrom] = useState(() => dayInput(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)))
  const [to, setTo] = useState(() => dayInput(new Date()))
  const [autoCloseTime, setAutoCloseTime] = useState('19:00')
  const [message, setMessage] = useState('')

  const reportQ = useQuery({
    queryKey: ['workforce-report', from, to],
    queryFn: () => api.workforceReport({
      from: new Date(`${from}T00:00:00`).toISOString(),
      to: new Date(`${to}T23:59:59.999`).toISOString(),
    }),
  })

  const settingsValue = reportQ.data?.company.shiftAutoCloseTime
  useEffect(() => {
    if (settingsValue) setAutoCloseTime(settingsValue)
  }, [settingsValue])

  const settingsM = useMutation({
    mutationFn: () => api.updateWorkforceSettings(autoCloseTime),
    onMutate: () => setMessage(''),
    onSuccess: async () => {
      setMessage('Время автозакрытия сохранено.')
      await queryClient.invalidateQueries({ queryKey: ['workforce-report'] })
      await queryClient.invalidateQueries({ queryKey: ['workforce-me'] })
    },
    onError: (e: unknown) => setMessage(e instanceof Error ? e.message : String(e)),
  })

  const report = reportQ.data
  return (
    <div>
      <h1>Смены и трудозатраты</h1>
      <p className="muted">Фактическое рабочее время сотрудников и время, зафиксированное по заявкам.</p>

      <div className="panel" style={{ marginBottom: 12 }}>
        <div className="grid2" style={{ alignItems: 'end' }}>
          <label>С даты<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>По дату<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
      </div>

      {reportQ.isLoading ? <div className="panel">Загрузка…</div> : null}
      {reportQ.isError ? <div className="alert">{(reportQ.error as Error)?.message || 'Не удалось загрузить смены'}</div> : null}

      {report ? (
        <>
          <div className="grid2" style={{ marginBottom: 12 }}>
            <div className="panel"><div className="muted small">Смены</div><div style={{ fontSize: 28, fontWeight: 800 }}>{report.summary.shifts}</div></div>
            <div className="panel"><div className="muted small">Сотрудники</div><div style={{ fontSize: 28, fontWeight: 800 }}>{report.summary.employees}</div></div>
            <div className="panel"><div className="muted small">Время смен</div><div style={{ fontSize: 28, fontWeight: 800 }}>{duration(report.summary.shiftMinutes)}</div></div>
            <div className="panel"><div className="muted small">По заявкам</div><div style={{ fontSize: 28, fontWeight: 800 }}>{duration(report.summary.workMinutes)}</div></div>
          </div>

          <div className="panel" style={{ marginBottom: 12, overflowX: 'auto' }}>
            <h3>По сотрудникам</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th align="left">Сотрудник</th><th align="right">Смен</th><th align="right">В сменах</th><th align="right">По заявкам</th><th align="right">Заявок</th></tr></thead>
              <tbody>
                {report.employees.map((row) => (
                  <tr key={row.user.id}>
                    <td>{employeeName(row.user)}</td><td align="right">{row.shifts}</td><td align="right">{duration(row.shiftMinutes)}</td><td align="right">{duration(row.workMinutes)}</td><td align="right">{row.tickets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.employees.length === 0 ? <div className="muted small">За период смен нет.</div> : null}
          </div>

          {meQ.data?.role === 'ADMIN' ? (
            <div className="panel">
              <h3>Настройки смен</h3>
              <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
                <label>Автозакрытие<input type="time" value={autoCloseTime} onChange={(e) => setAutoCloseTime(e.target.value)} /></label>
                <button type="button" disabled={settingsM.isPending} onClick={() => settingsM.mutate()}>{settingsM.isPending ? 'Сохраняем…' : 'Сохранить'}</button>
              </div>
              <div className="muted small" style={{ marginTop: 8 }}>Часовой пояс: {report.company.timezone || 'UTC'}.</div>
              {message ? <div className="muted small" style={{ marginTop: 8 }}>{message}</div> : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
