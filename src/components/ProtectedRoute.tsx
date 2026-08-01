import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/types/database';
import { Spinner } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: UserRole[] }) {
  const { session, profile, loading, signOut } = useAuth();

  if (loading) return <Spinner label="Checking your session…" />;
  if (!session) return <Navigate to="/login" replace />;

  if (profile && !profile.is_active) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h1 className="text-xl font-semibold text-ink">Account disabled</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your account has been disabled by an administrator. Contact them if you believe this is a mistake.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>
    );
  }

  if (roles && profile && !roles.includes(profile.role)) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h1 className="text-xl font-semibold text-ink">Access restricted</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your role ({profile.role.replace('_', ' ')}) doesn't have permission to view this page.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
