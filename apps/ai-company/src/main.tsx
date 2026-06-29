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
import './styles/kickoff.css'
import './styles/visual-lab.css'
import './styles/task-results.css'
import './styles/polish-v2.css'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
)
