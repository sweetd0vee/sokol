import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

type AdminGuardProps = {
  children: React.ReactNode;
};

/** Restricts route to admin role; auditors are redirected to checks. */
export function AdminGuard({ children }: AdminGuardProps) {
  const { isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-gray-500">
        Загрузка...
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/checks" replace />;
  }

  return <>{children}</>;
}
