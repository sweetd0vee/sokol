import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LoadingState } from '../ui/StateMessage';

export function AdminGuard() {
  const { isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingState />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/checks" replace />;
  }

  return <Outlet />;
}
