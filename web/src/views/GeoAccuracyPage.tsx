import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import * as api from '../lib/api'
import { GeoAccuracyCellDetail } from '../components/geo-accuracy/GeoAccuracyCellDetail'
import { GeoAccuracyChart } from '../components/geo-accuracy/GeoAccuracyChart'
import { GeoAccuracyLegend } from '../components/geo-accuracy/GeoAccuracyLegend'
import { GeoAccuracyMap } from '../components/geo-accuracy/GeoAccuracyMap'
import { GeoAccuracySettingsModal } from '../components/geo-accuracy/GeoAccuracySettingsModal'
import {
  GEO_ACCURACY_RANGE_KEYS,
  cellKey,
  errorMessage,
  normalizeBuckets,
  normalizeCells,
  normalizeSettings,
  type GeoAccuracyRangeKey,
} from '../components/geo-accuracy/geoAccuracyModel'

export function GeoAccuracyPage() {
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const isAdmin = meQ.data?.role === 'PLATFORM_ADMIN'

  const companiesQ = useQuery({
    queryKey: ['platform-companies'],
    queryFn: api.companies,
    enabled: isAdmin,
  })
  const bucketsQ = useQuery({
    queryKey: ['geo-accuracy-buckets'],
    queryFn: async () => normalizeBuckets(await api.geoAccuracyBuckets()),
    enabled: isAdmin,
  })
  const settingsQ = useQuery({
    queryKey: ['geo-accuracy-settings'],
    queryFn: async () => normalizeSettings(await api.geoAccuracySettings()),
    enabled: isAdmin,
  })

  const [companyId, setCompanyId] = useState('')
  const [enabledKeys, setEnabledKeys] = useState<GeoAccuracyRangeKey[]>(() => [...GEO_ACCURACY_RANGE_KEYS])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const cellsQ = useQuery({
    queryKey: ['geo-accuracy-cells', companyId],
    queryFn: async () => normalizeCells(await api.geoAccuracyCells(companyId)),
    enabled: isAdmin && companyId !== '',
  })

  const providers = useMemo(
    () =>
      (companiesQ.data ?? [])
        .filter((company) => company.type === 'PROVIDER')
        .sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [companiesQ.data],
  )
  const enabled = useMemo(() => new Set(enabledKeys), [enabledKeys])
  const cells = useMemo(() => (companyId ? (cellsQ.data ?? []) : []), [companyId, cellsQ.data])
  const selected = cells.find((cell) => cellKey(cell.bounds) === selectedKey) ?? null

  if (meQ.isLoading) return <div className="panel">Проверяем доступ...</div>
  if (meQ.data?.role !== 'PLATFORM_ADMIN') return <Navigate to={api.getHomeRoute(meQ.data?.role)} replace />

  function toggleRange(key: GeoAccuracyRangeKey) {
    setEnabledKeys((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]))
  }

  function selectCompany(nextCompanyId: string) {
    setCompanyId(nextCompanyId)
    setSelectedKey(null)
  }

  const settings = settingsQ.data ?? null

  return (
    <div>
      <div className="row" style={{ alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Точность геолокации</h1>
        <button type="button" onClick={() => setSettingsOpen(true)}>
          Пороги прибытия
        </button>
      </div>
      <p className="muted">
        Частота точности, с которой телефоны сдают координату на открытых сменах.
        {settings
          ? ` Необходимая точность ${settings.accuracyMeters} м. Свежесть ${settings.freshnessMinutes} мин. Радиус ${settings.radiusMeters} м.`
          : ' Пороги ещё не загружены.'}
      </p>

      <div className="panel" style={{ marginBottom: 12 }}>
        <label style={{ maxWidth: 420 }}>
          Компания провайдера
          <select
            value={companyId}
            onChange={(event) => selectCompany(event.target.value)}
            disabled={companiesQ.isLoading}
          >
            <option value="">Выберите компанию провайдера</option>
            {providers.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>
        {!companiesQ.isLoading && providers.length === 0 ? (
          <div className="muted small" style={{ marginTop: 8 }}>
            Компаний провайдера нет.
          </div>
        ) : null}
      </div>

      {companiesQ.isError ? <div className="alert">{errorMessage(companiesQ.error)}</div> : null}
      {bucketsQ.isError ? <div className="alert">{errorMessage(bucketsQ.error)}</div> : null}
      {cellsQ.isError ? <div className="alert">{errorMessage(cellsQ.error)}</div> : null}
      {settingsQ.isError ? <div className="alert">{errorMessage(settingsQ.error)}</div> : null}
      {settingsQ.isSuccess && !settings ? (
        <div className="alert">Пороги пришли в виде, который страница не читает.</div>
      ) : null}

      <GeoAccuracyLegend enabled={enabled} onToggle={toggleRange} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
          gap: 12,
          alignItems: 'start',
        }}
      >
        <GeoAccuracyMap
          companyId={companyId}
          cells={cells}
          enabled={enabled}
          loading={companyId !== '' && cellsQ.isLoading}
          failed={cellsQ.isError && cells.length === 0}
          selectedKey={selectedKey}
          onSelect={(cell) => setSelectedKey(cellKey(cell.bounds))}
        />
        <GeoAccuracyChart buckets={bucketsQ.data ?? null} loading={bucketsQ.isLoading} />
      </div>

      {selected ? (
        <GeoAccuracyCellDetail cell={selected} enabled={enabled} onClose={() => setSelectedKey(null)} />
      ) : null}

      <GeoAccuracySettingsModal open={settingsOpen} settings={settings} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
