import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { isCompactFormPath } from '../../constants/paths';
import { AppHeader } from './AppHeader';
import { Sidebar } from './Sidebar';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { LoadingState } from '../ui/StateMessage';

export function AppLayout() {
  const location = useLocation();
  const isCompactFormPage = isCompactFormPath(location.pathname);

  return (
    <div className="flex h-full overflow-hidden bg-white">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
        <AppHeader />
        <main
          className={`min-h-0 flex-1 overflow-auto bg-white ${
            isCompactFormPage ? 'px-4 py-4' : 'p-8'
          }`}
        >
          <ErrorBoundary
            key={location.pathname}
            title="Не удалось показать страницу"
            description="Ошибка на этой вкладке. Можно попробовать снова или открыть другой раздел."
          >
            <Suspense fallback={<LoadingState title="Загрузка раздела…" />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
