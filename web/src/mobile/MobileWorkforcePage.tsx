import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'

import * as api from '../lib/api'
import { mobilePath } from './mobileRoute'

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10)
}

function duration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours ? `${hours} ч ${rest} мин` : `${rest} мин`
}

function employeeName(user: api.WorkShiftItem['user']) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
}

export function MobileWorkforcePage() {
  const location = useLocation()
  const [from, setFrom] = useState(() => dateInput(new Date(Date.now() - 6 * 86_400_000)))
  const [to, setTo] = useState(() => dateInput(new Date()))
  const reportQ = useQuery({
    queryKey: ['workforce-report', from, to],
    queryFn: () => api.workforceReport({
      from: new Date(`${from}T00:00:00`).toISOString(),
      to: new Date(`${to}T23:59:59.999`).toISOString(),
    }),
  })
  const report = reportQ.data

  return (
    <>
      <div className="mobileTicketDetailsToolbar">
        <Link to={mobilePath(location.pathname, '/settings')} className="mobileDetailsBackLink">Настройки</Link>
      </div>
      <div className="mobileSection">
        <div className="mobileSectionTitle">Смены сотрудников</div>
        <div className="mobileCard mobileForm">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label>С даты<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
            <label>По дату<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          </div>
        </div>

        {reportQ.isLoading ? <div className="mobileNotice">Загрузка…</div> : null}
        {reportQ.isError ? <div className="mobileNotice mobileNoticeError">{(reportQ.error as Error).message}</div> : null}

        {report ? (
          <>
            <div className="mobileCard mobileProfileStats">
              <div className="mobileProfileStat"><div className="mobileProfileStatValue">{report.summary.shifts}</div><div className="mobileProfileStatLabel">Смен</div></div>
              <div className="mobileProfileStat"><div className="mobileProfileStatValue">{report.summary.employees}</div><div className="mobileProfileStatLabel">Сотрудников</div></div>
              <div className="mobileProfileStat"><div className="mobileProfileStatValue">{duration(report.summary.workMinutes)}</div><div className="mobileProfileStatLabel">По заявкам</div></div>
            </div>
            {report.employees.map((row) => (
              <div className="mobileCard" key={row.user.id}>
                <div className="mobileProfileSectionLabel">{employeeName(row.user)}</div>
                <div className="mobileProfileInfoRow"><span className="mobileMeta">Смены</span><span>{row.shifts}</span></div>
                <div className="mobileProfileInfoRow"><span className="mobileMeta">В сменах</span><span>{duration(row.shiftMinutes)}</span></div>
                <div className="mobileProfileInfoRow"><span className="mobileMeta">По заявкам</span><span>{duration(row.workMinutes)}</span></div>
                <div className="mobileProfileInfoRow"><span className="mobileMeta">Заявки</span><span>{row.tickets}</span></div>
              </div>
            ))}
            {report.employees.length === 0 ? <div className="mobileNotice">За выбранный период смен нет.</div> : null}
          </>
        ) : null}
      </div>
    </>
  )
}
