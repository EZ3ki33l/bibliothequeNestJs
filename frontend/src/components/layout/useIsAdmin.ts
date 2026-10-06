import { useEffect, useState } from 'react';
import { authClient } from '../../lib/auth';
import { getAdminMe } from '../../lib/admin';

/** Rôle admin de l'utilisateur courant — un seul appel `/admin/me`, partagé par la sidebar et la bottom nav via {@link AppLayout}. */
export function useIsAdmin() {
  const { data: session } = authClient.useSession();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getAdminMe()
      .then((result) => {
        if (!cancelled) setIsAdmin(result === 'ok');
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  return isAdmin;
}
