import { Outlet, useLocation } from 'react-router-dom';
import { isCompactFormPath } from '../../constants/paths';
import { AppHeader } from './AppHeader';
import { Sidebar } from './Sidebar';

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
          <Outlet />
        </main>
      </div>
    </div>
  );
}
