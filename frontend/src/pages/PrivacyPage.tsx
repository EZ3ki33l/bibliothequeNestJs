import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../components/ui/PageHeader';
import { SITE_LEGAL } from '../lib/site-legal';

/** À mettre à jour à chaque modification de fond de cette page. */
const LAST_UPDATED = '7 octobre 2026';

const LINK_CLASS =
  'text-foreground hover:text-foreground no-underline transition-colors duration-150';

type Treatment = {
  title: string;
  data: string;
  purpose: string;
  basis: string;
  retention: string;
};

/**
 * Un bloc par traitement (RGPD, art. 13) : ce qui est collecté, pourquoi, sur
 * quelle base légale, et combien de temps.
 *
 * Chaque phrase décrit ce que le code fait réellement (schéma Prisma, config
 * better-auth, services). Ne rien promettre qui n'existe pas : si un
 * comportement change (purge des sessions, suppression de compte en libre-
 * service…), cette liste et `LAST_UPDATED` changent avec lui.
 */
const TREATMENTS: Treatment[] = [
  {
    title: 'Compte',
    data: 'Nom, courriel, état de vérification de ce courriel (vérifié ou non), mot de passe (conservé haché, jamais lisible en clair) et date de création du compte.',
    purpose:
      'Créer et gérer le compte, qui ouvre tout le catalogue une fois son adresse vérifiée, ainsi que les examens, le suivi des parcours, les notes et les favoris.',
    basis: 'Exécution du service demandé (RGPD, art. 6.1.b).',
    retention:
      'Jusqu’à la suppression du compte, que chaque personne peut effectuer elle-même depuis la page « Mon compte ».',
  },
  {
    title: 'Vérification de l’adresse',
    data: 'Courriel du compte. Le lien envoyé contient un jeton signé, qui porte ce courriel et une date d’expiration.',
    purpose:
      'S’assurer que le courriel du compte est bien consulté par son titulaire, condition de la lecture de tout le catalogue. Un message contenant un lien est envoyé au courriel du compte à sa création, puis à chaque demande faite depuis le compte connecté. Le lien ne fait que vérifier l’adresse : il n’ouvre aucune session.',
    basis: 'Exécution du service demandé (RGPD, art. 6.1.b).',
    retention:
      'Le lien est valable une heure. Rien n’est enregistré pour lui : ni jeton, ni trace de l’envoi. Le message lui-même n’est pas conservé par le site ; Resend en garde une trace technique. L’état « adresse vérifiée » est conservé avec le compte et supprimé avec lui.',
  },
  {
    title: 'Réinitialisation du mot de passe',
    data: 'Adresse courriel saisie sur la page « Mot de passe oublié » (non conservée si aucun compte ne correspond) et jeton à usage unique rattaché au compte.',
    purpose:
      'Permettre de retrouver l’accès à un compte : un courriel contenant un lien est envoyé à l’adresse du compte.',
    basis: 'Exécution du service demandé (RGPD, art. 6.1.b).',
    retention:
      'Le jeton est supprimé dès son utilisation ; à défaut, il cesse d’être valable au bout d’une heure, mais son enregistrement n’est pas purgé automatiquement (il est composé du jeton et de l’identifiant du compte). Une réinitialisation ferme toutes les sessions ouvertes du compte. Le courriel lui-même n’est pas conservé par le site ; Resend en garde une trace technique.',
  },
  {
    title: 'Session et sécurité de connexion',
    data: 'Identifiant de session, date d’expiration, adresse IP et navigateur (user-agent) utilisés à la connexion.',
    purpose:
      'Rester connecté et permettre de repérer un usage anormal du compte. Le cookie de session est décrit plus bas.',
    basis: 'Intérêt légitime de sécuriser le service (RGPD, art. 6.1.f).',
    retention:
      'Une session est valable 7 jours et se renouvelle à l’usage ; elle est supprimée à la déconnexion. Une session abandonnée n’est plus utilisable après son expiration, mais son enregistrement (adresse IP et navigateur compris) n’est pas purgé automatiquement : il est supprimé avec le compte.',
  },
  {
    title: 'Contenus d’apprentissage liés au compte',
    data: 'Notes personnelles (le texte saisi, dont le contenu est laissé au choix de son auteur), favoris, trace de lecture (quelles fiches ont été ouvertes par le compte, avec la date de la première et de la dernière ouverture), tentatives d’examen (questions posées, réponses, score).',
    purpose:
      'Fournir les fonctions d’apprentissage : examens, progression dans les parcours, notes et favoris. La trace de lecture valide les étapes de parcours dont la fiche n’a pas d’examen, permet de proposer la reprise d’un parcours commencé et d’indiquer, dans le catalogue, les fiches déjà lues. Elle n’est enregistrée que pour un compte connecté : la lecture sans compte ne laisse aucune trace.',
    basis: 'Exécution du service demandé (RGPD, art. 6.1.b).',
    retention:
      'Jusqu’à la suppression du compte, qui efface la trace de lecture avec le reste. Les notes et les favoris peuvent aussi être supprimés un par un, à tout moment, depuis l’application ; la trace de lecture ne s’efface pas fiche par fiche. Elle disparaît aussi quand la fiche concernée est supprimée du site.',
  },
  {
    title: 'Formulaire de contact',
    data: 'Nom, courriel et message saisis dans le formulaire.',
    purpose: 'Répondre à la demande, y compris une demande relative aux données personnelles.',
    basis: 'Intérêt légitime de répondre aux messages reçus (RGPD, art. 6.1.f).',
    retention:
      'Le site ne stocke pas le message (ni en base de données, ni dans ses journaux) : il le transmet par courriel à l’éditeur. Il reste dans la boîte de l’éditeur le temps nécessaire au traitement de la demande, puis est supprimé. Le prestataire d’envoi peut en conserver une copie technique pendant une durée limitée.',
  },
  {
    title: 'Journaux techniques et limitation des abus',
    data: 'Adresse IP, date et heure, ressource demandée et navigateur.',
    purpose:
      'Assurer la sécurité et le diagnostic du service, et limiter les abus (nombre de tentatives de connexion et de messages de contact par adresse IP).',
    basis: 'Intérêt légitime de sécuriser le service (RGPD, art. 6.1.f).',
    retention:
      'Les compteurs de limitation sont gardés en mémoire quelques minutes à une heure, puis oubliés. Les journaux du serveur sont conservés le temps strictement nécessaire à la sécurité et au diagnostic, par rotation des fichiers.',
  },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-base font-medium">{title}</h2>
      {children}
    </section>
  );
}

function TreatmentCard({ treatment }: { treatment: Treatment }) {
  const rows: [string, string][] = [
    ['Données', treatment.data],
    ['Finalité', treatment.purpose],
    ['Base légale', treatment.basis],
    ['Durée', treatment.retention],
  ];

  return (
    <div className="rounded-xl border border-white/8 p-4">
      <h3 className="mb-3 font-medium">{treatment.title}</h3>
      <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[7rem_1fr]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Politique de confidentialité.
 *
 * Le site est un projet personnel non professionnel, mais il ouvre des comptes
 * au public : l’éditeur est donc responsable de traitement et doit informer
 * (RGPD, art. 13). Le catalogue public se parcourt sans compte ni traceur.
 */
export function PrivacyPage() {
  return (
    <>
      <PageHeader
        title="Politique de confidentialité"
        description="Quelles données personnelles sont collectées, pourquoi, pendant combien de temps, et comment exercer ses droits."
      />

      <p className="text-muted -mt-4 mb-8 text-xs">Dernière mise à jour : {LAST_UPDATED}</p>

      <div className="space-y-8 text-sm">
        <Section title="Responsable du traitement">
          <p>
            Le responsable du traitement est {SITE_LEGAL.publisherName}, éditeur à titre personnel
            de ce site non professionnel (voir les{' '}
            <Link to="/mentions-legales" className={LINK_CLASS}>
              mentions légales
            </Link>
            ). Toute demande relative aux données personnelles passe par la{' '}
            <Link to="/contact" className={LINK_CLASS}>
              page contact
            </Link>
            .
          </p>
        </Section>

        <Section title="Données collectées, finalités et durées">
          <p className="mb-4">
            Les parcours, les leçons, la recherche, le titre et le résumé des fiches, ainsi que le
            premier module de chaque parcours se consultent sans compte : dans ce cas, seules les
            données techniques (dernier bloc) et, si le formulaire est utilisé, celles du formulaire
            de contact sont concernées. Lire le reste du catalogue demande un compte dont l’adresse
            est vérifiée.
          </p>
          <div className="space-y-4">
            {TREATMENTS.map((treatment) => (
              <TreatmentCard key={treatment.title} treatment={treatment} />
            ))}
          </div>
        </Section>

        <Section title="Cookies et traceurs">
          <p className="mb-2">
            Un seul cookie est déposé, et seulement après connexion : le cookie de session. Il est
            strictement nécessaire au fonctionnement du compte, ce qui le dispense de consentement.
            C’est pourquoi le site n’affiche pas de bandeau cookies.
          </p>
          <p className="mb-2">
            Le site n’utilise ni outil de mesure d’audience, ni publicité, ni pixel de suivi, ni
            captcha tiers, et ne stocke rien d’autre dans le navigateur.
          </p>
          <p>
            Une exception : sur les fiches qui comportent un éditeur de code exécutable, le
            navigateur charge des ressources du service CodeSandbox (domaines codesandbox.io), qui
            reçoit à cette occasion l’adresse IP et les informations techniques du navigateur du
            visiteur. Le site ne dépose lui-même aucun cookie pour cela ; les pratiques de ce
            prestataire relèvent de sa propre politique de confidentialité. Cette exécution est
            nécessaire au fonctionnement de l’éditeur de code (intérêt légitime, RGPD, art. 6.1.f).
          </p>
        </Section>

        <Section title="Destinataires et sous-traitants">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="font-medium">OVH SAS</strong> : hébergement du site, de l’API et de
              la base de données (sous-traitant).
            </li>
            <li>
              <strong className="font-medium">Resend</strong> : acheminement par courriel des
              messages du formulaire de contact, des liens de vérification de l’adresse et des liens
              de réinitialisation de mot de passe (sous-traitant).
            </li>
            <li>
              <strong className="font-medium">CodeSandbox</strong> : exécution de l’éditeur de code
              des fiches (voir ci-dessus).
            </li>
          </ul>
          <p className="mt-3">
            Les données ne sont ni vendues, ni utilisées à des fins publicitaires ou de profilage,
            ni communiquées à d’autres tiers, sauf obligation légale. Les données d’un compte ne
            sont accessibles, dans l’application, qu’à son titulaire ; l’éditeur y a accès
            techniquement en tant qu’administrateur de la base.
          </p>
          <p className="mt-3">
            La génération des questions d’examen envoie à un fournisseur de modèle de langage
            uniquement le contenu des fiches, rédigé par l’éditeur. Aucune donnée de compte, note ou
            réponse d’utilisateur n’est transmise.
          </p>
        </Section>

        <Section title="Transferts hors de l’Union européenne">
          <p>
            Le traitement de Resend a principalement lieu aux États-Unis. Il est encadré par les
            clauses contractuelles types de la Commission européenne et par l’adhésion du
            prestataire au Data Privacy Framework. L’infrastructure de CodeSandbox peut également se
            situer hors de l’Union européenne.
          </p>
        </Section>

        <Section title="Sécurité">
          <p>
            Les échanges avec le site sont chiffrés (HTTPS). Les mots de passe sont conservés
            hachés. Les tentatives de connexion et l’envoi de messages sont limités par adresse IP.
            En cas de violation de données présentant un risque, l’éditeur en informe la CNIL et, si
            le risque est élevé, les personnes concernées, conformément au RGPD.
          </p>
        </Section>

        <Section title="Droits sur les données">
          <p className="mb-2">
            Toute personne dispose d’un droit d’accès, de rectification, d’effacement, de limitation
            du traitement et de portabilité de ses données, ainsi que d’un droit d’opposition aux
            traitements fondés sur l’intérêt légitime.
          </p>
          <p className="mb-2">
            Le droit d’effacement s’exerce directement : la page{' '}
            <Link to="/compte" className={LINK_CLASS}>
              Mon compte
            </Link>{' '}
            permet de supprimer son compte, après confirmation du mot de passe. La suppression est
            immédiate et définitive ; elle efface en même temps toutes les données liées au compte
            (sessions, notes, favoris, trace de lecture, examens).
          </p>
          <p className="mb-2">
            Les autres droits s’exercent via la{' '}
            <Link to="/contact" className={LINK_CLASS}>
              page contact
            </Link>
            . Une réponse est apportée dans un délai d’un mois. L’éditeur peut demander de quoi
            s’assurer que la demande émane bien du titulaire du compte, par exemple en la faisant
            depuis le courriel du compte.
          </p>
          <p>
            Il n’existe pas encore d’outil d’export de compte en libre-service : cette demande est
            traitée manuellement, et l’export est remis dans un format structuré et couramment
            utilisé.
          </p>
        </Section>

        <Section title="Réclamation">
          <p>
            En cas de désaccord, une réclamation peut être adressée à la CNIL, autorité française de
            protection des données :{' '}
            <a
              href="https://www.cnil.fr/fr/plaintes"
              target="_blank"
              rel="noopener noreferrer"
              className={LINK_CLASS}
            >
              cnil.fr/fr/plaintes
            </a>
            .
          </p>
        </Section>

        <Section title="Décisions automatisées et évolutions">
          <p>
            Aucune décision produisant des effets juridiques ou significatifs n’est prise de façon
            automatisée : le score d’un examen et la progression dans un parcours ne sont que des
            aides à l’apprentissage. Cette politique évolue avec le service (nouvel outil, nouveau
            prestataire) ; sa date de dernière mise à jour figure en tête de page.
          </p>
        </Section>
      </div>
    </>
  );
}
