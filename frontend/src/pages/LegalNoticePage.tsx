import { Link } from 'react-router';
import { PageHeader } from '../components/ui/PageHeader';
import { SITE_LEGAL } from '../lib/site-legal';

/**
 * Mentions légales.
 *
 * Éditeur non professionnel : éditeur et hébergeur, sans directeur de
 * publication ni coordonnées personnelles. Les valeurs viennent de
 * `SITE_LEGAL` — une seule source.
 */
export function LegalNoticePage() {
  return (
    <>
      <PageHeader title="Mentions légales" description="Identité de publication du site." />

      <dl className="space-y-8">
        <div>
          <dt className="text-sm font-medium">Éditeur</dt>
          <dd>
            <p className="mt-1 text-sm">{SITE_LEGAL.publisherName}</p>
            <p className="text-muted mt-1 text-sm">
              Site personnel, non professionnel et sans contrepartie financière. Conformément à
              l’article 1-1, II de la loi n° 2004-575 du 21 juin 2004 (LCEN), les éléments
              d’identification de l’éditeur sont communiqués à l’hébergeur.
            </p>
          </dd>
        </div>

        <div>
          <dt className="text-sm font-medium">Hébergeur</dt>
          <dd>
            <p className="mt-1 text-sm">{SITE_LEGAL.hostName}</p>
            <p className="mt-1 text-sm">{SITE_LEGAL.hostAddress}</p>
          </dd>
        </div>

        <div>
          <dt className="text-sm font-medium">Contact</dt>
          <dd>
            <p className="mt-1 text-sm">
              <Link
                to="/contact"
                className="text-muted hover:text-foreground no-underline transition-colors duration-150"
              >
                Page contact
              </Link>
            </p>
          </dd>
        </div>
      </dl>
    </>
  );
}
