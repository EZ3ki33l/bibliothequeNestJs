import { buttonVariants } from '@heroui/react';
import { SignInIcon, UserCircleIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';

export default function AuthGroupButton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 px-2 py-1">
        <span className="bg-surface ring-border flex size-8 items-center justify-center rounded-full ring-1">
          <UserCircleIcon className="text-muted size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">Invité</p>
          <p className="text-muted text-xs">Non connecté</p>
        </div>
      </div>
      <Link
        to="/login"
        className={`${buttonVariants({ variant: 'primary', fullWidth: true })} justify-center gap-2 no-underline`}
      >
        <SignInIcon className="size-4" />
        Se connecter
      </Link>
      <Link
        to="/register"
        className="text-muted hover:text-foreground block w-full py-1.5 text-center text-sm no-underline transition-colors duration-150"
      >
        S&apos;enregistrer
      </Link>
    </div>
  );
}
