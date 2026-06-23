import {
  permissionStateLabel,
  type PermissionCounters,
  type ResolvedPermissionModule,
} from '../../lib/permissions-constructor'

function stateClass(state: string) {
  if (state === 'override') return 'permState permStateOverride'
  if (state === 'inherited') return 'permState permStateInherited'
  if (state === 'denied') return 'permState permStateDenied'
  return 'permState permStateAllowed'
}

export function PermissionCountersStrip({ counters }: { counters: PermissionCounters }) {
  return (
    <div className="permCountersStrip">
      <div className="permCounterCard">
        <div className="permCounterValue">{counters.allowed}</div>
        <div className="permCounterLabel">Разрешено</div>
      </div>
      <div className="permCounterCard">
        <div className="permCounterValue">{counters.denied}</div>
        <div className="permCounterLabel">Не выдано</div>
      </div>
      <div className="permCounterCard">
        <div className="permCounterValue">{counters.inherited}</div>
        <div className="permCounterLabel">От роли</div>
      </div>
      <div className="permCounterCard">
        <div className="permCounterValue">{counters.overrides}</div>
        <div className="permCounterLabel">Overrides</div>
      </div>
    </div>
  )
}

export function PermissionModuleBlocks({ modules }: { modules: ResolvedPermissionModule[] }) {
  return (
    <div className="permModuleGrid">
      {modules.map(({ module, rows, grantedCount, totalCount }) => (
        <section key={module.id} className="permModuleCard">
          <div className="permModuleHeader">
            <div>
              <div className="permModuleTitle">{module.title}</div>
              <div className="permModuleHint">{module.hint}</div>
            </div>
            <div className="permModuleCount">
              {totalCount === 0 ? '—' : `${grantedCount} / ${totalCount}`}
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="permEmptyModule muted small">
              Права модуля пока не описаны в каталоге PBAC.
            </div>
          ) : (
            <ul className="permCodeList">
              {rows.map((row) => (
                <li key={row.code} className="permCodeRow">
                  <div className="permCodeMain">
                    <div className="permCodeTitle">{row.label}</div>
                    <div className="permCodeMeta">{row.code}</div>
                    {row.description ? <div className="permCodeDesc muted small">{row.description}</div> : null}
                  </div>
                  <span className={stateClass(row.state)}>{permissionStateLabel(row.state)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
