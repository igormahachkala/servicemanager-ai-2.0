/**
 * Entry point. With VITE_AI_COMPANY_SERVER_STATE=1 (office server build) the
 * shared company state is pulled from the server BEFORE any app module loads —
 * stores read localStorage at import time, so the order matters. The app
 * itself lives in bootstrapApp.tsx and is imported only after that.
 */
import { bootstrapServerState } from './sync/serverStateSync'

const serverState = import.meta.env.VITE_AI_COMPANY_SERVER_STATE === '1'

void bootstrapServerState(serverState)
  .catch((error) => console.warn('[server-state] bootstrap failed, running local only', error))
  .finally(() => {
    void import('./bootstrapApp')
  })
