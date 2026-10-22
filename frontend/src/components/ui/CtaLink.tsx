import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { buttonVariants } from '@heroui/react';

/**
 * Action principale d'un écran (Cherry, utilitaire `cta`), sous forme de lien.
 * Un seul par écran : c'est ce qui garde le rouge à 10 %.
 */
export function CtaLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={`${buttonVariants({ variant: 'primary' })} cta no-underline`}>
      {children}
    </Link>
  );
}
