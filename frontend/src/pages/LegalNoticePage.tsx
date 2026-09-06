import { Link } from 'react-router';
import { PageHeader } from '../components/ui/PageHeader';
import { SITE_LEGAL, isLegalPlaceholder } from '../lib/site-legal';

function LegalValue({ value }: { value: string }) {
  return (
    <p className={isLegalPlaceholder(value) ? 'text-muted mt-1 text-sm italic' : 'mt-1 text-sm'}>
      {value}
    </p>
  );
}

/**
 * Mentions légales (US4 / FR-010).
 *
 * Structure attendue en France : éditeur, directeur de publication,
 * hébergeur, contact. Les valeurs viennent de `SITE_LEGAL` — une seule
 * source, pour ne pas inventer une identité ici et une autre sur /contact.
 */
export function LegalNoticePage() {
  return (
    <>
      <PageHeader
        title="Mentions légales"
        description="Identité de publication du site. Les champs non fournis restent marqués à renseigner avant une mise en ligne publique."
      />

      <dl className="space-y-8">
        <div>
          <dt className="text-sm font-medium">Éditeur</dt>
          <dd>
            <LegalValue value={SITE_LEGAL.publisherName} />
            <LegalValue value={SITE_LEGAL.publisherAddress} />
          </dd>
        </div>

        <div>
          <dt className="text-sm font-medium">Directeur de la publication</dt>
          <dd>
            <LegalValue value={SITE_LEGAL.publicationDirector} />
          </dd>
        </div>

        <div>
          <dt className="text-sm font-medium">Hébergeur</dt>
          <dd>
            <LegalValue value={SITE_LEGAL.hostName} />
            <LegalValue value={SITE_LEGAL.hostAddress} />
          </dd>
        </div>

        <div>
          <dt className="text-sm font-medium">Contact</dt>
          <dd>
            <LegalValue value={SITE_LEGAL.contactEmail} />
            <p className="mt-2 text-sm">
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
