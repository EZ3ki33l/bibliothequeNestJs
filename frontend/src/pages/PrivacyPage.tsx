import { Link } from 'react-router';
import { PageHeader } from '../components/ui/PageHeader';

/**
 * Politique de confidentialité (US4).
 *
 * Alignée sur le produit actuel : courriel de compte et cookie de session.
 * Cette version n’ajoute ni mesure d’audience ni bandeau cookies — le dire
 * clairement évite de promettre un outil qui n’existe pas.
 */
export function PrivacyPage() {
  return (
    <>
      <PageHeader
        title="Politique de confidentialité"
        description="Données de compte collectées et absences de mesure d’audience dans cette version."
      />

      <div className="space-y-8 text-sm">
        <section>
          <h2 className="mb-2 text-base font-medium">Données de compte</h2>
          <p>
            Un compte implique la conservation d’un nom, d’un courriel et d’un mot de passe stocké
            de façon à ne pas être lisible en clair. Le catalogue public reste accessible sans
            compte.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium">Session</h2>
          <p>
            Après connexion, un cookie de session permet de rester identifié. Il sert au
            fonctionnement du compte (examens, révisions), pas à dresser un profil publicitaire.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium">Mesure d’audience</h2>
          <p>
            Cette version n’ajoute pas d’outil d’audience, de pixel de suivi ni de bandeau cookies.
            Un bandeau n’aurait de sens que si des traceurs non indispensables étaient déposés.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium">Demandes relatives aux données</h2>
          <p>
            Les demandes relatives aux données personnelles passent par la{' '}
            <Link
              to="/contact"
              className="text-muted hover:text-foreground no-underline transition-colors duration-150"
            >
              page contact
            </Link>
            . L’identité de l’éditeur figure aux{' '}
            <Link
              to="/mentions-legales"
              className="text-muted hover:text-foreground no-underline transition-colors duration-150"
            >
              mentions légales
            </Link>
            .
          </p>
        </section>
      </div>
    </>
  );
}
