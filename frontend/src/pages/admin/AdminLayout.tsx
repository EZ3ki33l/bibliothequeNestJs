import { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router';
import { getAdminMe } from '../../lib/admin';

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

  if (error) return <p>{error}</p>;
  if (forbidden) return <p>Accès réservé aux administrateurs.</p>;
  if (!ready) return <p>Chargement…</p>;

  return (
    <div>
      <p>
        <Link to="/">Accueil</Link>
        {' · '}
        <Link to="/admin">Dashboard</Link>
      </p>
      <Outlet />
    </div>
  );
}
