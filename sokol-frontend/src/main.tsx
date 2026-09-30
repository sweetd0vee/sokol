import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { installClientErrorHandlers } from './utils/clientObservability'

installClientErrorHandlers()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary
      title="Приложение остановилось"
      description="Непредвиденная ошибка остановила интерфейс. Обновите страницу, чтобы продолжить."
      reloadOnError
    >
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
