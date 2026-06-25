import { useMemo, useState } from 'react'
import { PageHeader, Panel } from '../components/ui'
import { ToolCard } from '../components/tools/ToolCard'
import { ToolProviderCard } from '../components/tools/ToolProviderCard'
import { TOOL_CATEGORIES } from '../data/toolCategories'
import { TOOL_PROVIDERS } from '../data/toolProviders'
import type { ToolRegistryCategory } from '../data/toolCategories'
import type { ToolRegistryProvider } from '../data/toolProviders'
import type { ToolConnectionStatus } from '../data/tools'
import { useTools } from '../hooks/useTools'
import { useI18n } from '../../i18n'

export function ToolsCatalogPage() {
  const { t } = useI18n()
  const { stats, byProvider, filterTools } = useTools()
  const [category, setCategory] = useState<ToolRegistryCategory | 'all'>('all')
  const [provider, setProvider] = useState<ToolRegistryProvider | 'all'>('all')
  const [status, setStatus] = useState<ToolConnectionStatus | 'all'>('all')

  const filtered = useMemo(
    () => filterTools({ category, provider, status }),
    [filterTools, category, provider, status],
  )

  return (
    <>
      <PageHeader title={t.pages.toolsRegistry} description={t.toolRegistry.pageDescription} />

      <div className="mcGrid4" style={{ marginBottom: 16 }}>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.toolRegistry.stats.registered}</div>
          <div className="mcMetricValue">{stats.total}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.toolRegistry.stats.connected}</div>
          <div className="mcMetricValue">{stats.connected}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.toolRegistry.stats.categories}</div>
          <div className="mcMetricValue">{stats.categories}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.toolRegistry.stats.providers}</div>
          <div className="mcMetricValue">{stats.providers}</div>
        </div>
      </div>

      <Panel title={t.toolRegistry.providersTitle}>
        <div className="mcToolProviderGrid">
          {TOOL_PROVIDERS.map((item) => (
            <ToolProviderCard key={item} provider={item} tools={byProvider[item]} />
          ))}
        </div>
      </Panel>

      <Panel title={t.toolRegistry.catalogTitle} right={<span className="mcMono mcMuted">{filtered.length} {t.toolRegistry.toolsCount}</span>}>
        <div className="mcToolFilters">
          <label className="mcField mcToolFilterField">
            <span className="mcFieldLabel">{t.toolRegistry.filters.category}</span>
            <select
              className="mcInput"
              value={category}
              onChange={(event) => setCategory(event.target.value as ToolRegistryCategory | 'all')}
            >
              <option value="all">{t.common.all}</option>
              {TOOL_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {t.toolRegistry.categories[item]}
                </option>
              ))}
            </select>
          </label>

          <label className="mcField mcToolFilterField">
            <span className="mcFieldLabel">{t.toolRegistry.filters.provider}</span>
            <select
              className="mcInput"
              value={provider}
              onChange={(event) => setProvider(event.target.value as ToolRegistryProvider | 'all')}
            >
              <option value="all">{t.common.all}</option>
              {TOOL_PROVIDERS.map((item) => (
                <option key={item} value={item}>
                  {t.toolRegistry.providers[item]}
                </option>
              ))}
            </select>
          </label>

          <label className="mcField mcToolFilterField">
            <span className="mcFieldLabel">{t.toolRegistry.filters.connection}</span>
            <select
              className="mcInput"
              value={status}
              onChange={(event) => setStatus(event.target.value as ToolConnectionStatus | 'all')}
            >
              <option value="all">{t.common.all}</option>
              {(Object.keys(t.toolRegistry.connectionStatus) as ToolConnectionStatus[]).map((item) => (
                <option key={item} value={item}>
                  {t.toolRegistry.connectionStatus[item]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mcToolGrid">
          {filtered.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </Panel>

      <p className="mcToolRegistryNote">{t.toolRegistry.architectureNote}</p>
    </>
  )
}
