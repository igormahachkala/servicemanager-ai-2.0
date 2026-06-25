import type { ModelRoute } from '../../domain/runtime/runtimeStorage'
import { getModelById } from '../../domain/runtime/runtimeStorage'
import { useI18n } from '../../i18n'

export function ModelRouteMatrix({ routes }: { routes: ModelRoute[] }) {
  const { t } = useI18n()

  if (routes.length === 0) {
    return (
      <div className="mcRuntimeEmpty">
        <div className="mcRuntimeEmptyTitle">{t.runtimeEngine.noRoutesTitle}</div>
        <p className="mcRuntimeEmptyDesc">{t.runtimeEngine.noRoutesDescription}</p>
      </div>
    )
  }

  return (
    <div className="mcRuntimeRouteMatrix">
      <table className="mcTable">
        <thead>
          <tr>
            <th>{t.runtimeEngine.routeName}</th>
            <th>{t.runtimeEngine.taskType}</th>
            <th>{t.runtimeEngine.preferredModel}</th>
            <th>{t.runtimeEngine.fallbackModels}</th>
            <th>{t.runtimeEngine.priority}</th>
          </tr>
        </thead>
        <tbody>
          {routes.map((route) => (
            <tr key={route.id}>
              <td>{route.name}</td>
              <td className="mcMono">{route.taskType}</td>
              <td className="mcMono">
                {getModelById(route.preferredModelId)?.name ?? route.preferredModelId}
              </td>
              <td className="mcMono">
                {route.fallbackModelIds
                  .map((id) => getModelById(id)?.name ?? id)
                  .join(', ') || t.common.empty}
              </td>
              <td className="mcMono">{route.priority}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
