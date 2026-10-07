import { Link } from 'react-router';
import { PageHeader } from '../components/ui/PageHeader';
import { SITE_LEGAL } from '../lib/site-legal';
import { Typo } from '../components/ui/Typo';

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
            <Typo variant="small" as="p" className="text-foreground mt-1">
              {SITE_LEGAL.publisherName}
            </Typo>
            <Typo variant="small" as="p" className="mt-1">
              Site personnel, non professionnel et sans contrepartie financière. Conformément à
              l’article 1-1, II de la loi n° 2004-575 du 21 juin 2004 (LCEN), les éléments
              d’identification de l’éditeur sont communiqués à l’hébergeur.
            </Typo>
          </dd>
        </div>

        <div>
          <dt className="text-sm font-medium">Hébergeur</dt>
          <dd>
            <Typo variant="small" as="p" className="text-foreground mt-1">
              {SITE_LEGAL.hostName}
            </Typo>
            <Typo variant="small" as="p" className="text-foreground mt-1">
              {SITE_LEGAL.hostAddress}
            </Typo>
          </dd>
        </div>

        <div>
          <dt className="text-sm font-medium">Contact</dt>
          <dd>
            <Typo variant="small" as="p" className="text-foreground mt-1">
              <Link to="/contact" className="text-blueberry-light underline underline-offset-2">
                Page contact
              </Link>
            </Typo>
          </dd>
        </div>
      </dl>
    </>
  );
}
