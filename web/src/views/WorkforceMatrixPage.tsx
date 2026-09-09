import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import './WorkforceMatrixPage.css'

/**
 * SMA-WORKFORCE-MONTHLY-MATRIX-106D — «Сотрудники / Рабочее время».
 *
 * Сотрудник × День × Месяц по исправленному журналу смен (106A + 106B).
 *
 * Осознанно НЕ показывает: оплачиваемые часы, норму, переработку и недоработку. Ни политики
 * обеда, ни дневной нормы в системе пока нет, поэтому такие числа были бы выдуманы. Все итоги
 * ниже — наблюдаемые факты, и подписаны именно так.
 */

const MONTH_NAMES = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
]

function currentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

/** Минуты → «8:14». Ноль минут остаётся видимым нулём, а не прочерком. */
function hhmm(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

function dayNumber(dateKey: string) {
  return Number(dateKey.slice(8, 10))
}

function isWeekend(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return wd === 0 || wd === 6
}

function employeeName(user: api.WorkforceMatrixEmployee['user']) {
  return [user.lastName, user.firstName].filter(Boolean).join(' ').trim() || user.email
}

/** Время в часовом поясе компании — сервер отдаёт мгновения в UTC. */
function localTime(iso: string | null | undefined, timezone?: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      timeZone: timezone || 'UTC',
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return new Date(iso).toISOString()
  }
}

/** Роли с каноническим правом USERS_MANAGE. Подсказка интерфейса — решает бэкенд. */
const CORRECTION_ROLES = ['ADMIN', 'MASTER', 'DISPATCHER', 'NETWORK_DIRECTOR']

const CELL_TITLE: Record<api.WorkforceMatrixCellState, string> = {
  none: 'Нет смены',
  open: 'Смена открыта',
  closed: 'Смена закрыта вручную',
  auto_closed: 'Закрыта автоматически',
}

export function WorkforceMatrixPage() {
  const qc = useQueryClient()
  const [month, setMonth] = useState(currentMonthKey())
  const [selected, setSelected] = useState<{ userId: string; date: string } | null>(null)

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const canCorrect = CORRECTION_ROLES.includes(String(meQ.data?.role || ''))

  const matrixQ = useQuery({
    queryKey: ['workforce-matrix', month],
    queryFn: () => api.workforceMatrix({ month }),
  })

  const matrix = matrixQ.data
  const days = matrix?.month.days ?? []

  const selectedEmployee = useMemo(
    () => matrix?.employees.find((e) => e.user.id === selected?.userId) ?? null,
    [matrix, selected],
  )
  const selectedCell = useMemo(
    () => selectedEmployee?.days.find((d) => d.date === selected?.date) ?? null,
    [selectedEmployee, selected],
  )
  const selectedShifts = useMemo(
    () => (selectedCell ? matrix!.shifts.filter((s) => selectedCell.shiftIds.includes(s.id)) : []),
    [matrix, selectedCell],
  )

  return (
    <div className="wfMatrixPage">
      <div className="row">
        <div>
          <h1 style={{ marginBottom: 4 }}>Сотрудники / Рабочее время</h1>
          <div className="muted small">
            Табель по журналу смен. Показаны отработанные часы по завершённым сменам.
          </div>
        </div>
        <div className="wfMonthPicker">
          <button className="ghost" onClick={() => setMonth(shiftMonth(month, -1))}>←</button>
          <span className="wfMonthLabel">{monthLabel(month)}</span>
          <button className="ghost" onClick={() => setMonth(shiftMonth(month, 1))}>→</button>
        </div>
      </div>

      {matrix && (!matrix.company.timezone || matrix.company.timezone === 'UTC') ? (
        <div className="alert wfTimezoneWarning">
          <b>Часовой пояс компании не настроен (UTC).</b> Дни табеля и границы автозакрытия
          считаются по UTC, поэтому для России границы суток сместятся. Настройте часовой пояс
          компании — это организационный шаг, данные при этом не меняются.
        </div>
      ) : null}

      {matrixQ.isError ? (
        <div className="alert">{(matrixQ.error as Error)?.message || 'Не удалось загрузить табель'}</div>
      ) : null}
      {matrixQ.isLoading ? <div className="muted">Загружаем табель…</div> : null}

      {matrix ? (
        <>
          <div className="wfSummary">
            <div className="panel">
              <div className="muted small">Часы по завершённым сменам</div>
              <div className="wfSummaryValue">{hhmm(matrix.totals.closedShiftMinutes)}</div>
              <div className="muted small">Не оплачиваемые часы: обед и норма не настроены</div>
            </div>
            <div className="panel">
              <div className="muted small">Завершённых смен</div>
              <div className="wfSummaryValue">{matrix.totals.closedShifts}</div>
            </div>
            <div className="panel">
              <div className="muted small">Закрыты автоматически</div>
              <div className="wfSummaryValue">{matrix.totals.autoClosedShifts}</div>
              <div className="muted small">Требуют проверки, но не обязательно ошибочны</div>
            </div>
            <div className="panel">
              <div className="muted small">Исправлено</div>
              <div className="wfSummaryValue">{matrix.totals.correctedShifts}</div>
            </div>
            <div className="panel">
              <div className="muted small">Открытых смен сейчас</div>
              <div className="wfSummaryValue">{matrix.totals.openShifts}</div>
              <div className="muted small">В часы месяца не входят</div>
            </div>
          </div>

          <div className="panel wfMatrixPanel">
            {matrix.employees.length === 0 ? (
              <div className="muted">За выбранный месяц смен нет.</div>
            ) : (
              <div className="wfMatrixScroll">
                <table className="wfMatrix">
                  <thead>
                    <tr>
                      <th className="wfEmployeeCol">Сотрудник</th>
                      {days.map((d) => (
                        <th key={d} className={isWeekend(d) ? 'wfDay wfWeekend' : 'wfDay'}>
                          {dayNumber(d)}
                        </th>
                      ))}
                      <th className="wfTotalCol">Итого</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.employees.map((employee) => (
                      <tr key={employee.user.id}>
                        <td className="wfEmployeeCol">
                          <div className="wfEmployeeName">{employeeName(employee.user)}</div>
                          <div className="muted small">{employee.user.email}</div>
                        </td>
                        {employee.days.map((cell) => (
                          <td
                            key={cell.date}
                            className={[
                              'wfCell',
                              `wfCell--${cell.state}`,
                              cell.hasCorrection ? 'wfCell--corrected' : '',
                              isWeekend(cell.date) ? 'wfWeekend' : '',
                              cell.state === 'none' ? '' : 'wfCell--clickable',
                            ].filter(Boolean).join(' ')}
                            title={`${CELL_TITLE[cell.state]}${cell.hasCorrection ? ' · исправлено' : ''}`}
                            onClick={() =>
                              cell.state === 'none'
                                ? undefined
                                : setSelected({ userId: employee.user.id, date: cell.date })
                            }
                          >
                            {cell.state === 'none' ? (
                              <span className="wfCellNone">—</span>
                            ) : cell.state === 'open' && cell.durationMinutes === null ? (
                              <span className="wfCellOpen">Открыта</span>
                            ) : (
                              <span className="wfCellValue">
                                {hhmm(cell.durationMinutes)}
                                {cell.state === 'auto_closed' ? <span className="wfFlag" title="Закрыта автоматически"> ⚠</span> : null}
                                {cell.hasCorrection ? <span className="wfFlag" title="Исправлено"> ✎</span> : null}
                              </span>
                            )}
                          </td>
                        ))}
                        <td className="wfTotalCol">
                          <div className="wfEmployeeTotal">{hhmm(employee.totals.closedShiftMinutes)}</div>
                          <div className="muted small">{employee.totals.closedShifts} смен</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="wfLegend muted small">
              <span><b>8:14</b> — часы по завершённой смене</span>
              <span><span className="wfFlag">⚠</span> закрыта автоматически</span>
              <span><span className="wfFlag">✎</span> есть исправление</span>
              <span>Открыта — смена идёт, в часы не входит</span>
              <span>— нет смены</span>
            </div>
          </div>
        </>
      ) : null}

      {selected && selectedEmployee && selectedCell ? (
        <DayDetail
          employeeName={employeeName(selectedEmployee.user)}
          date={selected.date}
          timezone={matrix?.company.timezone}
          shifts={selectedShifts}
          canCorrect={canCorrect}
          onClose={() => setSelected(null)}
          onCorrected={() => {
            qc.invalidateQueries({ queryKey: ['workforce-matrix', month] })
          }}
        />
      ) : null}
    </div>
  )
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Открыта',
  CLOSED: 'Закрыта вручную',
  AUTO_CLOSED: 'Закрыта автоматически',
}

function DayDetail(props: {
  employeeName: string
  date: string
  timezone?: string | null
  shifts: api.WorkforceMatrixShift[]
  canCorrect: boolean
  onClose: () => void
  onCorrected: () => void
}) {
  return (
    <div className="wfDrawerBackdrop" onClick={props.onClose}>
      <aside className="wfDrawer" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <div>
            <h3 style={{ margin: 0 }}>{props.employeeName}</h3>
            <div className="muted small">{props.date}</div>
          </div>
          <button className="ghost" onClick={props.onClose}>Закрыть</button>
        </div>

        {props.shifts.map((shift) => (
          <ShiftDetail
            key={shift.id}
            shift={shift}
            timezone={props.timezone}
            canCorrect={props.canCorrect}
            onCorrected={props.onCorrected}
          />
        ))}
      </aside>
    </div>
  )
}

function ShiftDetail(props: {
  shift: api.WorkforceMatrixShift
  timezone?: string | null
  canCorrect: boolean
  onCorrected: () => void
}) {
  const { shift, timezone } = props
  const [open, setOpen] = useState(false)

  return (
    <div className="panel wfShiftPanel">
      <div className="row" style={{ marginBottom: 8 }}>
        <span className="tag">{STATUS_LABEL[shift.status] || shift.status}</span>
        {shift.effective.isCorrected ? <span className="tag wfTagCorrected">Исправлена</span> : null}
      </div>

      {/*
        «Было» и «Стало» показываются рядом всегда: 106B не переписывает WorkShift, и скрывать
        исходные значения после исправления означало бы потерять смысл аудита.
      */}
      <table className="wfShiftTable">
        <thead>
          <tr><th /><th>Записано системой</th><th>Учитывается</th></tr>
        </thead>
        <tbody>
          <tr>
            <td className="muted small">Начало</td>
            <td>{localTime(shift.effective.recordedOpenedAt, timezone)}</td>
            <td className={shift.effective.correctedFields.includes('openedAt') ? 'wfChanged' : ''}>
              {localTime(shift.effective.effectiveOpenedAt, timezone)}
            </td>
          </tr>
          <tr>
            <td className="muted small">Окончание</td>
            <td>{localTime(shift.effective.recordedClosedAt, timezone)}</td>
            <td className={shift.effective.correctedFields.includes('closedAt') ? 'wfChanged' : ''}>
              {localTime(shift.effective.effectiveClosedAt, timezone)}
            </td>
          </tr>
          <tr>
            <td className="muted small">Длительность</td>
            <td className="muted">—</td>
            <td><b>{hhmm(shift.effective.effectiveDurationMinutes)}</b></td>
          </tr>
        </tbody>
      </table>

      {shift.closeReason ? (
        <div className="muted small">Причина закрытия: {shift.closeReason}</div>
      ) : null}

      {shift.corrections.length > 0 ? (
        <div className="wfCorrectionHistory">
          <div className="muted small" style={{ marginBottom: 6 }}>История исправлений</div>
          {shift.corrections.map((correction) => (
            <div key={correction.id} className="wfCorrectionRow">
              <div className="small">
                {correction.correctedOpenedAt ? `начало → ${localTime(correction.correctedOpenedAt, timezone)}; ` : ''}
                {correction.correctedClosedAt ? `окончание → ${localTime(correction.correctedClosedAt, timezone)}` : ''}
              </div>
              <div className="muted small">
                {correction.reason} · {correction.correctedBy
                  ? [correction.correctedBy.lastName, correction.correctedBy.firstName].filter(Boolean).join(' ') ||
                    correction.correctedBy.email
                  : '—'} · {localTime(correction.createdAt, timezone)}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {props.canCorrect && shift.status !== 'OPEN' ? (
        open ? (
          <CorrectionForm
            shift={shift}
            timezone={timezone}
            onCancel={() => setOpen(false)}
            onDone={() => { setOpen(false); props.onCorrected() }}
          />
        ) : (
          <button className="ghost" onClick={() => setOpen(true)}>Исправить смену</button>
        )
      ) : null}
    </div>
  )
}

/** Значение для <input type="datetime-local"> в часовом поясе компании. */
function toLocalInput(iso: string | null, timezone?: string | null) {
  if (!iso) return ''
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'UTC',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(iso))
    const p = Object.fromEntries(parts.map((x) => [x.type, x.value]))
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
  } catch {
    return ''
  }
}

/** Локальное «стенное» время в мгновение UTC для выбранного пояса. */
function fromLocalInput(value: string, timezone?: string | null): string | null {
  if (!value) return null
  const tz = timezone || 'UTC'
  const naive = Date.parse(value + ':00Z')
  if (Number.isNaN(naive)) return null
  const offsetAt = (instant: number) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
      }).formatToParts(new Date(instant)).map((x) => [x.type, x.value]),
    )
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - instant
  }
  // Два прохода: смещение зависит от мгновения, которое и ищется (важно на переходе на зимнее время).
  const first = naive - offsetAt(naive)
  return new Date(naive - offsetAt(first)).toISOString()
}

function CorrectionForm(props: {
  shift: api.WorkforceMatrixShift
  timezone?: string | null
  onCancel: () => void
  onDone: () => void
}) {
  const { shift, timezone } = props
  const [openedAt, setOpenedAt] = useState('')
  const [closedAt, setClosedAt] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const currentOpened = toLocalInput(shift.effective.effectiveOpenedAt, timezone)
  const currentClosed = toLocalInput(shift.effective.effectiveClosedAt, timezone)

  const m = useMutation({
    mutationFn: async () => {
      if (!openedAt && !closedAt) throw new Error('Укажите новое время начала или окончания')
      if (reason.trim().length < 3) throw new Error('Укажите причину исправления')
      return api.createShiftCorrection(shift.id, {
        correctedOpenedAt: openedAt ? fromLocalInput(openedAt, timezone) ?? undefined : undefined,
        correctedClosedAt: closedAt ? fromLocalInput(closedAt, timezone) ?? undefined : undefined,
        reason: reason.trim(),
      })
    },
    onSuccess: () => props.onDone(),
    onError: (e: any) => setError(e?.message || String(e)),
  })

  return (
    <div className="wfCorrectionForm">
      <div className="muted small" style={{ marginBottom: 8 }}>
        Исправление не переписывает смену: исходные значения сохраняются, добавляется запись
        аудита с автором и причиной.
      </div>

      {error ? <div className="alert">{error}</div> : null}

      <div className="wfCorrectionFields">
        <label>
          <div className="muted small">Новое начало</div>
          <input type="datetime-local" value={openedAt} onChange={(e) => setOpenedAt(e.target.value)} />
          <div className="muted small">Сейчас: {currentOpened || '—'}</div>
        </label>
        <label>
          <div className="muted small">Новое окончание</div>
          <input type="datetime-local" value={closedAt} onChange={(e) => setClosedAt(e.target.value)} />
          <div className="muted small">Сейчас: {currentClosed || '—'}</div>
        </label>
      </div>

      <label>
        <div className="muted small">Причина</div>
        <input
          type="text"
          value={reason}
          placeholder="Например: сотрудник забыл закрыть смену, фактически до 18:07"
          onChange={(e) => setReason(e.target.value)}
        />
      </label>

      {openedAt || closedAt ? (
        <div className="wfBeforeAfter small">
          {openedAt ? <div>Начало: <s>{currentOpened || '—'}</s> → <b>{openedAt}</b></div> : null}
          {closedAt ? <div>Окончание: <s>{currentClosed || '—'}</s> → <b>{closedAt}</b></div> : null}
        </div>
      ) : null}

      <div className="wfCorrectionActions">
        <button onClick={() => m.mutate()} disabled={m.isPending}>
          {m.isPending ? 'Сохраняем…' : 'Сохранить исправление'}
        </button>
        <button className="ghost" onClick={props.onCancel}>Отмена</button>
      </div>
    </div>
  )
}
