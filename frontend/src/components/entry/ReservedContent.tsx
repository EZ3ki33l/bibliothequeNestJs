import { Link } from 'react-router';
import { buttonVariants } from '@heroui/react';
import { LockIcon } from '@phosphor-icons/react';
import { loginHref, registerHref } from '../../lib/returnTo';
import { VerifyEmailReminder } from '../account/VerifyEmailReminder';
import { Typo } from '../ui/Typo';

type ReservedContentProps = {
  /** Lecteur à qui s'adresse le message : sans compte, ou compte à vérifier. */
  reader: 'visitor' | 'unverified';
  /** Adresse du compte connecté, nommée dans la demande de vérification. */
  email?: string;
  /** Page courante, parcours d'origine compris : on y revient après connexion. */
  returnTo: string;
};

/**
 * Texte **factice** affiché sous le flou. Une constante de ce fichier : le même
 * pour toutes les fiches, sans rapport avec aucune. Ni sa longueur ni sa forme
 * ne varient d'une fiche à l'autre, on ne peut donc rien en déduire.
 */
const DECOY_PARAGRAPHS = [
  'Ce texte est un habillage : il ne provient d’aucune fiche et reste le même sur toutes les pages réservées.',
  'Le contenu d’une fiche réservée n’est pas présent dans cette page. Il est transmis par le serveur à un compte connecté dont l’adresse est vérifiée, et à lui seul.',
  'Retirer le flou ne révèle donc rien d’autre que ces lignes. Le titre et le résumé affichés plus haut sont les seules informations publiques de la fiche.',
  'Le premier module de chaque parcours se lit en entier, sans compte, pour juger du contenu avant de s’inscrire.',
] as const;

const DECOY_CODE = [
  'function habillage() {',
  '  // Aucun extrait de la fiche ne figure ici.',
  '  return null;',
  '}',
].join('\n');

/**
 * Emplacement du contenu d'une fiche que le lecteur ne peut pas lire : une
 * zone floutée, recouverte d'un message.
 *
 * **La zone floutée ne contient jamais le contenu de la fiche.** Un flou CSS
 * s'applique à ce qui est déjà dans la page : si le vrai texte y était,
 * « Inspecter l'élément » ou l'onglet Réseau le montreraient en clair. Ce
 * serait un contrôle d'accès exécuté par le navigateur de la personne à
 * contrôler, donc contournable par n'importe qui (contrôle d'accès défaillant,
 * OWASP A01). Le contrôle est fait par le serveur, qui n'envoie pas le contenu ;
 * ce composant ne reçoit d'ailleurs aucune donnée de la fiche. L'effet visuel
 * est un habillage.
 *
 * Accessibilité : la zone factice est retirée de l'arbre d'accessibilité
 * (`aria-hidden`), hors d'atteinte du clavier et de la souris (`inert`) et non
 * sélectionnable. Un lecteur d'écran lit le titre et le résumé de la fiche,
 * puis ce message, sans passer par le faux texte.
 *
 * Le message ne propose que ce qui ouvre la lecture : créer un compte ou se
 * connecter pour un visiteur, recevoir le message de vérification pour un
 * compte. Ni favori ni note ici : ce sont des fonctions d'une fiche lue.
 */
export function ReservedContent({ reader, email, returnTo }: ReservedContentProps) {
  return (
    // Les deux couches occupent la même cellule de grille : la zone prend la
    // hauteur de la plus haute, le message n'est donc jamais rogné sur un
    // écran étroit. `grid-cols-1` borne la colonne à la largeur disponible
    // (`minmax(0, 1fr)`) : sans lui, le bloc de code factice l'élargirait et le
    // message déborderait de la zone.
    <section
      aria-labelledby="reserved-content-title"
      className="border-border grid grid-cols-1 overflow-hidden rounded-xl border"
    >
      <div
        aria-hidden="true"
        inert
        className="text-muted pointer-events-none col-start-1 row-start-1 flex min-w-0 flex-col gap-4 p-6 text-sm leading-relaxed blur-sm select-none"
      >
        {DECOY_PARAGRAPHS.map((paragraph) => (
          <Typo variant="p" key={paragraph}>
            {paragraph}
          </Typo>
        ))}
        <pre className="bg-surface overflow-hidden rounded-lg p-4 text-xs whitespace-pre-wrap">
          {DECOY_CODE}
        </pre>
      </div>

      {/* `relative z-10` : un élément flouté (`filter`) est peint au-dessus du
          contenu ordinaire, même placé avant lui dans la page. Sans cette
          couche explicite, le texte factice recouvrirait le message.
          Le message est calé en haut de la zone : sur un téléphone, il se lit
          juste après le résumé, sans faire défiler du texte flouté. */}
      <div className="bg-background/70 relative z-10 col-start-1 row-start-1 flex min-w-0 items-start justify-center p-4 sm:p-8">
        <div className="border-border bg-surface flex w-full max-w-md min-w-0 flex-col gap-4 rounded-xl border p-6 shadow-lg">
          <LockIcon aria-hidden="true" weight="fill" className="text-blueberry-light size-6" />
          {reader === 'visitor' ? (
            <>
              <Typo variant="h3" as="h2" id="reserved-content-title">
                La suite de cette fiche demande un compte.
              </Typo>
              <Typo variant="small" as="p">
                Un compte dont l’adresse est vérifiée ouvre tout le catalogue, les examens et le
                suivi des parcours.
              </Typo>
              <div className="flex flex-wrap gap-3">
                <Link
                  to={registerHref(returnTo)}
                  className={`${buttonVariants({ variant: 'primary' })} cta no-underline`}
                >
                  Créer un compte
                </Link>
                <Link
                  to={loginHref(returnTo)}
                  className={`${buttonVariants({ variant: 'secondary' })} no-underline`}
                >
                  Se connecter
                </Link>
              </div>
            </>
          ) : (
            <>
              <Typo variant="h3" as="h2" id="reserved-content-title">
                Adresse à vérifier
              </Typo>
              <Typo variant="small" as="p">
                La suite de cette fiche demande une adresse vérifiée. Le lien reçu par message ouvre
                tout le catalogue.
              </Typo>
              {email ? <VerifyEmailReminder email={email} returnTo={returnTo} /> : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
