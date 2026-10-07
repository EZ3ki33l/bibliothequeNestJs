import type { ReactNode } from 'react';
import { usePageTitle } from '../../lib/pageTitle';
import { Typo } from './Typo';

type PageHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

/**
 * En-tête d'une page : son `<h1>`, et du même coup le titre de l'onglet.
 *
 * Les deux portent le même nom, il n'est donc écrit qu'une fois. Une page qui
 * n'affiche cet en-tête qu'une fois sa donnée chargée ne nomme l'onglet qu'à ce
 * moment-là : pendant le chargement, ou si la donnée est introuvable, l'onglet
 * garde le titre neutre du site.
 */
export function PageHeader({ title, description, action }: PageHeaderProps) {
  usePageTitle(title);

  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <Typo variant="h2" as="h1">
          {title}
        </Typo>
        {description ? (
          <Typo variant="small" as="p" className="mt-1">
            {description}
          </Typo>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
