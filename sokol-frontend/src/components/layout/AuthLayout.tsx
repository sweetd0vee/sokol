import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[rgb(245,245,245)] px-4 dark:bg-slate-900">
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  );
}
