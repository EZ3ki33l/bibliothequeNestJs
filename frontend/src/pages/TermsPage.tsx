import { Link } from 'react-router';
import { PageHeader } from '../components/ui/PageHeader';
import { Typo } from '../components/ui/Typo';

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

      <div className="max-w-3xl space-y-8 text-sm">
        <section>
          <Typo variant="h4" as="h2" className="mb-2">
            Objet du service
          </Typo>
          <Typo variant="p">
            Ce site est une bibliothèque d’apprentissage : des parcours guidés, des leçons, des
            fiches à lire et des examens de compréhension. Il n’est ni une boutique, ni une place de
            marché, ni un service de paiement.
          </Typo>
        </section>

        <section>
          <Typo variant="h4" as="h2" className="mb-2">
            Catalogue
          </Typo>
          <Typo variant="p">
            Les parcours, les leçons, la recherche, ainsi que le titre et le résumé des fiches se
            consultent sans compte. Le contenu des fiches du premier module de chaque parcours se
            lit sans compte ; celui des autres fiches demande un compte dont l’adresse est vérifiée.
            Seuls les parcours, les leçons et les fiches publiés figurent au catalogue. Le contenu
            est fourni à des fins de formation ; il ne constitue pas un conseil professionnel
            personnalisé.
          </Typo>
        </section>

        <section>
          <Typo variant="h4" as="h2" className="mb-2">
            Comptes
          </Typo>
          <Typo variant="p">
            Un compte s’identifie par un courriel et un mot de passe. À sa création, un message est
            envoyé à ce courriel : le lien qu’il contient, valable une heure, vérifie l’adresse. Un
            compte dont l’adresse est vérifiée ouvre tout le catalogue. Sur les fiches qu’il peut
            lire, tout compte ouvre les examens de compréhension, le suivi de la progression dans
            les parcours, les favoris et les notes. Le courriel d’un compte ne se modifie pas. La
            confidentialité des identifiants relève du titulaire du compte. L’éditeur peut refuser
            ou clôturer un compte en cas d’usage abusif (contournement des accès, atteinte au
            service).
          </Typo>
        </section>

        <section>
          <Typo variant="h4" as="h2" className="mb-2">
            Contenus
          </Typo>
          <Typo variant="p">
            Les textes, exemples et exercices restent la propriété de leurs auteurs. La consultation
            à des fins d’apprentissage est autorisée. La republication comme œuvre propre et l’usage
            du service pour diffuser du contenu illicite sont interdits.
          </Typo>
        </section>

        <section>
          <Typo variant="h4" as="h2" className="mb-2">
            Contact
          </Typo>
          <Typo variant="p">
            Les questions relatives à ces conditions passent par la{' '}
            <Link to="/contact" className="text-blueberry-light underline underline-offset-2">
              page contact
            </Link>
            .
          </Typo>
        </section>
      </div>
    </>
  );
}
