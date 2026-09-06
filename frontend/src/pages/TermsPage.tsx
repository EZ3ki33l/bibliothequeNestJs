import { Link } from 'react-router';
import { PageHeader } from '../components/ui/PageHeader';

/**
 * Conditions d’utilisation (US4).
 *
 * Modèle adapté à une bibliothèque d’apprentissage, pas un avis d’avocat.
 * On décrit le catalogue, les comptes et les contenus — rien qui n’existe
 * pas encore (paiement, boutique, certificats).
 */
export function TermsPage() {
  return (
    <>
      <PageHeader
        title="Conditions d’utilisation"
        description="Règles d’usage du catalogue, des comptes et des contenus publiés."
      />

      <div className="space-y-8 text-sm">
        <section>
          <h2 className="mb-2 text-base font-medium">Objet du service</h2>
          <p>
            Ce site est une bibliothèque d’apprentissage : des parcours (stacks), des fiches à lire,
            des examens de compréhension et des révisions espacées. Il n’est ni une boutique, ni une
            place de marché, ni un service de paiement.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium">Catalogue</h2>
          <p>
            Le catalogue public se parcourt sans compte. Seuls les parcours et les fiches publiés y
            figurent. Le contenu est fourni à des fins de formation ; il ne constitue pas un conseil
            professionnel personnalisé.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium">Comptes</h2>
          <p>
            Un compte s’identifie par un courriel et un mot de passe. Il ouvre l’examen de
            compréhension et les révisions. La confidentialité des identifiants relève du titulaire
            du compte. L’éditeur peut refuser ou clôturer un compte en cas d’usage abusif
            (contournement des accès, atteinte au service).
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium">Contenus</h2>
          <p>
            Les textes, exemples et exercices restent la propriété de leurs auteurs. La consultation
            à des fins d’apprentissage est autorisée. La republication comme œuvre propre et l’usage
            du service pour diffuser du contenu illicite sont interdits.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium">Contact</h2>
          <p>
            Les questions relatives à ces conditions passent par la{' '}
            <Link
              to="/contact"
              className="text-muted hover:text-foreground no-underline transition-colors duration-150"
            >
              page contact
            </Link>
            .
          </p>
        </section>
      </div>
    </>
  );
}
