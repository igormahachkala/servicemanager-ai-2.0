import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { AppRoutes } from './router'
import { AppToastHost } from './components/AppToastHost'
import { PushServiceWorkerBridge } from './components/PushServiceWorkerBridge'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5000,
    },
  },
})

function ErrorFallback(props: FallbackProps) {
  return (
    <div className="page">
      <div className="card">
        <h1>Интерфейс упал</h1>
        <div className="alert">{props.error instanceof Error ? props.error.message : String(props.error)}</div>
        <button onClick={props.resetErrorBoundary} style={{ marginTop: 12 }}>
          Перезагрузить экран
        </button>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <BrowserRouter>
          <PushServiceWorkerBridge />
          <AppRoutes />
          <AppToastHost />
        </BrowserRouter>
      </ErrorBoundary>
    </QueryClientProvider>
  )
}
