import { TechnicianMapBoard } from '../components/technician-map/TechnicianMapBoard'

export function TechnicianMapPage() {
  return (
    <div>
      <h1>Карта техников</h1>
      <p className="muted">Техники с открытой сменой и время последней точки.</p>
      <TechnicianMapBoard surface="desktop" />
    </div>
  )
}
