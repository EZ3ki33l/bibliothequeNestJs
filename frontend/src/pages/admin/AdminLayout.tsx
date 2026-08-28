import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { Skeleton } from '@heroui/react';
import { getAdminMe } from '../../lib/admin';
import { EmptyMessage } from '../../components/ui/EmptyMessage';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

export function AdminLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getAdminMe()
      .then((result) => {
        if (cancelled) return;
        if (result === 'unauthorized') {
          navigate('/login', { replace: true });
          return;
        }
        if (result === 'forbidden') {
          setForbidden(true);
          return;
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de vérifier les droits admin');
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (forbidden) return <EmptyMessage>Accès réservé aux administrateurs.</EmptyMessage>;
  if (!ready) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
    );
  }

  return <Outlet />;
}
