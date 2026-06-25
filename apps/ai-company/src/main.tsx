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
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
)
