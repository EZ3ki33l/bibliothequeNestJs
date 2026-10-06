import { useNavigate } from 'react-router';
import { ArrowCircleRightIcon, UserGearIcon } from '@phosphor-icons/react';
import { Button, Skeleton } from '@heroui/react';
import { authClient } from '../../lib/auth';
import Avatar from '../ui/Avatar';
import AuthGroupButton from '../ui/GroupButton';

/** Bloc compte (avatar + déconnexion, ou CTA connexion/inscription) — partagé entre la sidebar desktop et le panneau « Plus » mobile. */
export function AccountBlock() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const currentUser = session?.user ?? null;

  if (isPending && !currentUser) {
    return <Skeleton className="h-10 rounded-lg" />;
  }

  if (!currentUser) {
    return <AuthGroupButton />;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 px-2 py-1">
        <Avatar name={currentUser.name} email={currentUser.email} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{currentUser.name}</p>
          <p className="text-muted truncate text-xs">{currentUser.email}</p>
        </div>
      </div>
      <Button
        variant="ghost"
        className="text-muted w-full justify-start"
        onPress={() => void navigate('/compte')}
      >
        <UserGearIcon className="size-4" />
        Mon compte
      </Button>
      <Button
        variant="ghost"
        className="text-muted w-full justify-start"
        onPress={async () => {
          await authClient.signOut();
          void navigate('/');
        }}
      >
        <ArrowCircleRightIcon className="size-4" />
        Déconnexion
      </Button>
    </div>
  );
}
