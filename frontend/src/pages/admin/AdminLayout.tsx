import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { Skeleton } from '@heroui/react';
import { getAdminMe } from '../../lib/admin';
import { useAsyncData } from '../../lib/useAsyncData';
import { useLoginRedirect } from '../../lib/useLoginRedirect';
import { EmptyMessage } from '../../components/ui/EmptyMessage';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

/**
 * Garde d'accès de toute la section `/admin`.
 *
 * La vérification passe par le serveur (`GET /admin/me`) et non par la session
 * du navigateur : c'est le backend qui décide, la SPA ne fait qu'afficher sa
 * réponse. Tant qu'elle n'est pas arrivée, on montre un squelette — rien du
 * contenu admin n'est rendu (`<Outlet />` seulement en cas de succès).
 */
export function AdminLayout() {
  const redirectToLogin = useLoginRedirect();
  const { data: access, error } = useAsyncData(
    getAdminMe,
    [],
    'Impossible de vérifier les droits admin',
  );

  // Une redirection est un effet de bord : elle ne peut pas se faire pendant le
  // rendu, d'où le `useEffect`. La page d'administration demandée est retenue
  // (`?retour=`) : une session expirée y ramène après connexion.
  useEffect(() => {
    if (access === 'unauthorized') {
      redirectToLogin();
    }
  }, [access, redirectToLogin]);

  if (error) return <ErrorMessage>{error}</ErrorMessage>;

  // Connecté, mais pas administrateur : refus explicite, pas de redirection.
  if (access === 'forbidden') {
    return <EmptyMessage>Accès réservé aux administrateurs.</EmptyMessage>;
  }

  // Chargement, ou redirection vers la connexion déjà lancée.
  if (access !== 'ok') {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
    );
  }

  return <Outlet />;
}
