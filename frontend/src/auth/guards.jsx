import { Navigate, Outlet, useLocation } from 'react-router';
import { Spinner } from '../components/ui';
import { useAuth } from './AuthProvider';

export function FullPageSpinner() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Spinner label="Memuat" />
    </div>
  );
}

/**
 * Requires a session. Until a seeded/reset account picks its own password,
 * only routes with `allowMustChange` are reachable.
 */
export function RequireAuth({ allowMustChange = false, roles }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.mustChangePassword && !allowMustChange) return <Navigate to="/ganti-password" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Login/forgot/reset pages: send signed-in users home. */
export function GuestOnly() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <FullPageSpinner />;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}
