import { OnSiteBoard } from '../components/on-site/OnSiteBoard'

export function OnSitePage() {
  return (
    <div>
      <h1>На точках</h1>
      <p className="muted">Исполнители с активным назначением и прибытие на точку заявки.</p>
      <OnSiteBoard surface="desktop" />
    </div>
  )
}
