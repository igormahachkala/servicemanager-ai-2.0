import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LanguageProvider } from './i18n'
import App from './App'
import './styles/design-system.css'
import './styles/layout.css'
import './styles/navigation.css'
import './styles/projects.css'
import './styles/presence.css'
import './styles/execution.css'
import './styles/canvas.css'
import './styles/toolExecution.css'
import './styles/handoff.css'
import './styles/employeeWorkspace.css'
import './styles/workday.css'
import './styles/operating-day.css'
import './styles/kickoff.css'
import './styles/visual-lab.css'
import './styles/task-results.css'
import './styles/living-company.css'
import './styles/memory-evolution.css'
import './styles/runtime-monitor.css'
import './styles/max-worker-loop.css'
import './styles/guided-experience.css'
import './styles/context-empty-state.css'
import './styles/employee-timeline.css'
import './styles/polish-v2.css'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
)
