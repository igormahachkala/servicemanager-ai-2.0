import type { HandoffPackage } from '../../domain/handoff'
import { useI18n } from '../../i18n'

export function HandoffPackageView({ handoffPackage }: { handoffPackage: HandoffPackage }) {
  const { t } = useI18n()

  return (
    <div className="acHandoffPackageView">
      <section className="acHandoffPackageSection">
        <h4>{t.handoffEngine.package.projectContext}</h4>
        <p>{handoffPackage.projectContext}</p>
      </section>
      <section className="acHandoffPackageSection">
        <h4>{t.handoffEngine.package.taskContext}</h4>
        <p>{handoffPackage.taskContext}</p>
      </section>
      <section className="acHandoffPackageSection">
        <h4>{t.handoffEngine.package.currentState}</h4>
        <p>{handoffPackage.currentState}</p>
      </section>
      <PackageList title={t.handoffEngine.package.files} items={handoffPackage.files} mono />
      <PackageList title={t.handoffEngine.package.constraints} items={handoffPackage.constraints} />
      <PackageList title={t.handoffEngine.package.commands} items={handoffPackage.commands} mono />
      <PackageList title={t.handoffEngine.package.acceptanceCriteria} items={handoffPackage.acceptanceCriteria} />
      <section className="acHandoffPackageSection">
        <h4>{t.handoffEngine.package.expectedResponseFormat}</h4>
        <p>{handoffPackage.expectedResponseFormat}</p>
      </section>
    </div>
  )
}

function PackageList(props: { title: string; items: string[]; mono?: boolean }) {
  if (props.items.length === 0) return null
  return (
    <section className="acHandoffPackageSection">
      <h4>{props.title}</h4>
      <ul className={props.mono ? 'acHandoffPackageList mcMono' : 'acHandoffPackageList'}>
        {props.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}
