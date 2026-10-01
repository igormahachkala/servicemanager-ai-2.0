import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { AppRoutes } from './router'
import { AppToastHost } from './components/AppToastHost'
import { PushServiceWorkerBridge } from './components/PushServiceWorkerBridge'
import { ApiRequestError } from './lib/api'
import { isDynamicImportFailure, MOBILE_CHUNK_RECOVERY_MESSAGE } from './lib/lazyRouteFailure'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiRequestError && error.status === 404) return false
        return failureCount < 1
      },
      refetchOnWindowFocus: false,
      staleTime: 5000,
    },
  },
})

function ErrorFallback(props: FallbackProps) {
  const chunkFailure = isDynamicImportFailure(props.error)
  return (
    <div className="page">
      <div className="card">
        <h1>Интерфейс упал</h1>
        <div className="alert">
          {chunkFailure
            ? MOBILE_CHUNK_RECOVERY_MESSAGE
            : props.error instanceof Error
              ? props.error.message
              : String(props.error)}
        </div>
        {/*
          resetErrorBoundary только перемонтирует React-дерево. После падения
          dynamic import или битого состояния маршрута этого мало: /auth/me
          снова уходит, а экран остаётся пустым. Полная перезагрузка поднимает
          приложение заново, как кнопка «Повторить» у LazyRouteFailure.
        */}
        <button
          type="button"
          onClick={() => {
            window.location.reload()
          }}
          style={{ marginTop: 12 }}
        >
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
