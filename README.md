# Bibliothèque

Application d’apprentissage : des **stacks** (ex. React) contiennent des **catégories**, elles-mêmes des **fiches** (entries).

Deux applications distinctes — pas un monorepo pnpm :

| Dossier     | Rôle                                        | Port   |
| ----------- | ------------------------------------------- | ------ |
| `backend/`  | API NestJS 11 + Prisma 7 + PostgreSQL       | `4000` |
| `frontend/` | SPA Vite + React 19 + HeroUI 3 + Tailwind 4 | `5173` |

Auth : [better-auth](https://www.better-auth.com/) (email / mot de passe, cookie de session). Les lectures publiques ne lisent aucune session et répondent la même chose à tous ; le **contenu** d’une fiche n’y figure que si la fiche est dans le premier module d’un parcours publié. Les autres fiches sont **réservées** à un compte dont l’**adresse est vérifiée** (`/reader/entries/:slug`, session + adresse vérifiée) ; les **quiz** passent par `/quizzes/...` (session, **pas** admin) ; ce qu’un compte a fait d’une fiche (**trace de lecture** et **repères**) passe par `/progress/entries/...` (session, **pas** admin) ; les **favoris** passent par `/favorites/...` (session, **pas** admin) ; les **notes** passent par `/notes/...` (session, **pas** admin) ; la **progression** dans les parcours passe par `/progress/learning-paths/...` et `/progress/started-paths` (session, **pas** admin) ; les écritures et lectures admin passent par `/admin/...` (session + rôle admin).

## Prérequis

- Node.js 22+
- [pnpm](https://pnpm.io/) 11+
- PostgreSQL (local ou Docker)

## Démarrage

### 1. Backend

```bash
cd backend
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm start:dev
```

Crée `backend/.env` (jamais commité) :

```env
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173   # plusieurs origines : séparées par des virgules (ex. app mobile en mode web : ...,http://localhost:8081)
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/bibliotheque?schema=public
BETTER_AUTH_URL=http://localhost:4000
BETTER_AUTH_SECRET=          # openssl rand -base64 32
ADMIN_EMAIL=ton@email.fr     # promu admin au seed, après inscription
QUIZ_LLM_API_KEY=            # secret ; jamais commité. Absence → 503 à la génération, pas au boot
QUIZ_LLM_BASE_URL=           # optionnel, défaut https://api.openai.com/v1
QUIZ_LLM_MODEL=              # optionnel, défaut gpt-4o-mini
RESEND_API_KEY=              # secret ; formulaire de contact, réinitialisation du mot de passe et vérification de l'adresse. Absence (ou celle de l'expéditeur) → 503 à l'envoi, pas au boot
CONTACT_FROM_EMAIL=          # expéditeur sur un domaine vérifié dans Resend, ex. Bibliothèque <formulaire@ton-domaine.fr>
CONTACT_TO_EMAIL=            # boîte qui reçoit les messages (jamais exposée au navigateur)
```

Ne commite jamais `.env`. Pour un secret Better Auth :

```bash
openssl rand -base64 32
```

Données de démo (stack React, catégorie Hooks, les 7 hooks de base de [react.dev](https://react.dev/reference/react/hooks)) :

```bash
pnpm db:seed
```

Le seed ne crée pas le compte : inscris-toi sur `/register` avec `ADMIN_EMAIL`, puis relance `pnpm db:seed`.

**Un compte n’ouvre tout le catalogue qu’une fois son adresse vérifiée.** L’inscription envoie un message contenant un lien valable une heure : sans `RESEND_API_KEY` et `CONTACT_FROM_EMAIL` (expéditeur sur un domaine vérifié chez Resend), aucun message ne part, aucune adresse ne se vérifie, et un compte ne lit que le premier module de chaque parcours. Il n’existe aucun moyen de vérifier une adresse sans ce message : ni commande, ni dispense pour un rôle d’administration (le seed et `pnpm admin:role` ne touchent pas à la vérification). L’envoi doit donc fonctionner avant la mise en ligne.

### 2. Frontend

```bash
cd frontend
echo 'VITE_API_URL=http://localhost:4000' > .env
pnpm install
pnpm dev
```

Ouvre [http://localhost:5173](http://localhost:5173). Les appels API envoient le cookie (`credentials: 'include'`).

## Pages (SPA)

`App.tsx` est la table de routes. Une page = un fichier dans `frontend/src/pages/`. `AppLayout` (sidebar + pied de page) enveloppe le catalogue ; `AuthLayout` et `AdminLayout` s’imbriquent dessus via `<Outlet />`. Le thème sombre HeroUI 3 exige `class="dark"` sur `<html>` (`frontend/index.html`).

L’accueil (`/`) oriente (parcours guidés, leçons, fiches, recherche, examens, favoris) : portes vers `/parcours`, `/stacks`, `/recherche` et `/a-propos`, sans grille catalogue. Pour un compte connecté, il affiche en plus « Reprendre » (les trois parcours suivis le plus récemment, avec leur prochaine étape) ou « Par où commencer », et des raccourcis vers les favoris et les notes ; les mentions destinées aux visiteurs disparaissent. La page `/a-propos` décrit uniquement ce qui existe déjà — pas de certificats ou notifications. Le **pied de page** (`SiteFooter`, sous l’Outlet) lie l’orientation, les mentions légales, les CGU, la confidentialité et le contact ; il est visible aussi sur `/login`. L’identité d’éditeur / hébergeur / courriel vit dans `frontend/src/lib/site-legal.ts` (placeholders « à renseigner avant mise en ligne », jamais une fausse identité). `/contact` affiche le courriel et un `mailto` seulement s’il est réel — **pas** de formulaire POST. Une adresse inconnue (`/page-inventee`) affiche « Page introuvable » (catch-all `path="*"`, en dernier) ; un slug catalogue absent (`/stacks/…`) reste un 404 métier dans la page. Un plantage de rendu est capté par `AppErrorBoundary` → écran humain, **sans** stack.

| Route navigateur                   | Page                                                                          | Accès                |
| ---------------------------------- | ----------------------------------------------------------------------------- | -------------------- |
| `/`                                | Accueil (orientation, sans grille catalogue)                                  | public               |
| `/a-propos`                        | À propos                                                                      | public               |
| `/mentions-legales`                | Mentions légales                                                              | public               |
| `/cgu`                             | Conditions d’utilisation                                                      | public               |
| `/confidentialite`                 | Politique de confidentialité                                                  | public               |
| `/contact`                         | Contact (formulaire) ; `?fiche=<slug>` préremplit un signalement d’erreur      | public               |
| `/login`, `/register`              | Auth (l’inscription demande aussitôt le message de vérification de l’adresse) | public               |
| `/adresse-verifiee`                | Arrivée du lien de vérification (`?retour=`, `?error=`) : n’ouvre aucune session | public            |
| `/parcours`                        | Liste des parcours guidés (+ progression si connecté)                         | public               |
| `/parcours/:slug`                  | Plan d’un parcours (+ progression et prochaine étape si connecté)             | public               |
| `/stacks`                          | Liste des leçons (libellé lecteur des stacks)                                 | public               |
| `/stacks/:slug`                    | Détail d’un stack                                                             | public               |
| `/stacks/:stackSlug/:categorySlug` | Catégorie + fiches                                                            | public               |
| `/recherche`                       | Recherche de fiches (query `q`, `kind`, `difficulty`, `stack`, `tag`, `page`) | public               |
| `/entries/:slug`                   | Fiche (sources, date de vérification ; `?parcours=` : étapes voisines). Fiche réservée : titre et résumé, puis zone floutée et message | public ; contenu complet : premier module d’un parcours, ou compte à l’adresse vérifiée |
| `/entries/:slug/exam`              | Épreuve d’une fiche                                                           | session (pas admin)  |
| `/compte`                          | Nom affiché, état de l’adresse (vérifiée ou à vérifier, renvoi du message), mot de passe, suppression du compte | session (pas admin)  |
| `/favoris`                         | Fiches publiées mises de côté                                                 | session (pas admin)  |
| `/notes`                           | Fiches publiées annotées d’une note personnelle                              | session (pas admin)  |
| `/admin`                           | Dashboard admin                                                               | session + rôle admin |
| `/admin/stacks`                    | Liste des leçons (stacks)                                                     | session + rôle admin |
| `/admin/stacks/new`                | Créer une leçon                                                               | session + rôle admin |
| `/admin/stacks/:id/edit`           | Modifier une leçon                                                            | session + rôle admin |
| `/admin/categories`                | Liste des catégories                                                          | session + rôle admin |
| `/admin/categories/new`            | Créer une catégorie                                                           | session + rôle admin |
| `/admin/categories/:id/edit`       | Modifier une catégorie                                                        | session + rôle admin |
| `/admin/entries`                   | Liste des fiches                                                              | session + rôle admin |
| `/admin/entries/new`               | Créer une fiche (aperçu de la saisie avant enregistrement)                    | session + rôle admin |
| `/admin/entries/:id/edit`          | Modifier une fiche (aperçu, rappel des manques avant mise en ligne)           | session + rôle admin |
| `/admin/parcours`                  | Liste des parcours (brouillons inclus)                                        | session + rôle admin |
| `/admin/parcours/new`              | Créer un parcours                                                             | session + rôle admin |
| `/admin/parcours/:id/edit`         | Composer un parcours (modules, étapes, ordre)                                 | session + rôle admin |
| `*` (catch-all)                    | Page introuvable                                                              | public               |

La route navigateur d’une catégorie **n’inclut pas** `categories` ; l’API, si : `GET /stacks/:stackSlug/categories/:categorySlug`.

La **recherche** (`/recherche`) liste des fiches **publiées** via `GET /entries` (titre, résumé, tags — jamais `bodyMdx`). Les query `q`, `kind`, `difficulty`, `stack`, `tag` et `page` sont dans l’URL ; un tag cliqué sur une fiche ouvre `/recherche?tag=`. Sans critère, l’écran invite à chercher et n’appelle pas l’API. Sans compte.

Le corps d’une fiche (`bodyMdx`) est rendu par `EntryMdx` (`react-markdown` `MarkdownHooks` + `rehype-pretty-code` / Shiki). Si `kind` n’est pas `CONCEPT` et que `files` n’est pas vide, un playground Sandpack s’affiche sous le contenu.

L’**accès réservé** (spec `015-verified-access`) : une fiche publiée est **en accès libre** si elle est une étape du premier module (le premier qui a au moins une fiche publiée) d’un parcours publié ; toute autre fiche publiée est **réservée**. Rien n’est enregistré sur la fiche : l’accès se déduit des parcours à chaque lecture, donc recomposer ou dépublier un parcours s’applique à la lecture suivante. `GET /entries/:slug` renvoie `access: 'free' | 'reserved'` ; pour une fiche réservée, l’en-tête seul (titre, résumé, format, niveau, étiquettes, leçon, catégorie) : le corps, les fichiers et les sources ne sont **pas chargés** depuis la base. La page affiche alors une **zone floutée factice** (un texte fixe, identique pour toutes les fiches : flouter le vrai contenu se contournerait en inspectant la page) sous un message : « Créer un compte » / « Se connecter » pour un visiteur, « Recevoir un nouveau message » pour un compte dont l’adresse reste à vérifier. Un compte connecté obtient le contenu par `GET /reader/entries/:slug` (**401** sans session, **403** sans adresse vérifiée). Sur une fiche illisible : ni trace de lecture, ni examen, ni favori, ni note, ni signalement. Les cartes et les étapes d’une fiche réservée portent « Compte requis » ou « Adresse à vérifier » (`GET /access/entries?ids=`, public) ; un compte vérifié ne voit aucune mention. La **vérification** est celle de better-auth : `POST /api/auth/send-verification-email` (session exigée, adresse du compte seulement, 5 par heure et par IP) puis le lien `GET /api/auth/verify-email` (jeton signé, une heure, n’ouvre aucune session), qui ramène sur `/adresse-verifiee`. L’application mobile voisine n’est pas adaptée : elle ne lit que les fiches en accès libre.

Les **repères de l’apprenant** (spec `014-learner-experience`) : la révision espacée a été retirée (`/review` redirige vers l’accueil, les routes `/reviews/*` répondent 404). Un compte connecté qui ouvre une fiche **publiée** déclenche silencieusement `PUT /progress/entries/:entryId/read` : c’est la **trace de lecture**, une par compte et par fiche. `GET /entries/:slug` ne lit aucune session et n’écrit rien. Les cartes d’une leçon, d’une catégorie et de la recherche portent alors « Lue », « Examen réussi » ou « Favori » (`GET /progress/entries?ids=`, 50 fiches au plus par requête) ; un visiteur ne voit aucun repère. Les écrans d’apprenant vérifient `GET /me` (**401** → connexion) — jamais `GET /admin/me` ni `useSession()` comme garde — et **retiennent la page demandée** : `/login?retour=<chemin>` ramène à cette page après connexion ou inscription. Seul un chemin interne au site est suivi (`safeReturnTo`) ; une destination externe ou mal formée mène à l’accueil.

L’**examen** affiche son verdict (« Examen réussi » ou « non réussi »), le score, le seuil de réussite fourni par le serveur, un récapitulatif où chaque question est marquée « Juste » ou « À revoir », puis les suites : recommencer, revoir la fiche et, quand l’examen a été ouvert depuis un parcours (`/entries/:slug/exam?parcours=<slug>`), l’étape suivante et le retour au parcours. La fiche garde le meilleur score. Un compte ne démarre pas plus de dix examens par heure (**429** avec l’heure du prochain essai). Une fiche trop courte n’a pas d’examen : sa lecture suffit à valider l’étape.

Les **favoris** suivent le même principe : `/favoris` est un écran d’apprenant sous `AppLayout` (hors `/admin/...`), gardé par `GET /me` (**401** → `/login`). Le lien « Favoris » n’apparaît dans la sidebar que s’il y a une session. Sur une fiche **publiée**, un bouton cœur bascule le favori (`POST` pour marquer, `DELETE` pour retirer) ; l’état affiché vient de `GET /favorites?entryId=`, jamais d’un champ sur `GET /entries/:slug` (qui n’en gagne pas). `/favoris` liste les favoris du compte connecté (fiches encore publiées seulement) avec pagination et un bouton retirer par ligne ; retirer un favori ne supprime jamais la fiche du catalogue.

Les **notes** suivent le même principe : `/notes` est un écran d’apprenant sous `AppLayout` (hors `/admin/...`), gardé par `GET /me` (**401** → `/login`). Le lien « Notes » n’apparaît dans la sidebar que s’il y a une session. Sur une fiche **publiée**, une zone de texte permet d’écrire, modifier ou supprimer une note privée (`PUT`/`DELETE /notes/:entryId`) ; le texte affiché vient de `GET /notes?entryId=`, jamais d’un champ sur `GET /entries/:slug`. Un texte vide/espaces enregistré équivaut à une suppression. `/notes` liste les fiches encore publiées portant une note du compte connecté (aperçu du texte, pagination, plus récemment modifiée d’abord) ; supprimer une note ne supprime jamais la fiche du catalogue. Même un compte administrateur n’a aucun accès particulier au contenu des notes d’un autre compte.

**Vocabulaire** : dans l’interface, « **Parcours** » désigne uniquement le plan guidé ci-dessous ; un stack s’affiche comme une « **leçon** » (filtre « Leçon » de `/recherche`, textes de l’accueil, de `/a-propos` et des CGU). Les noms techniques (`Stack`, `/stacks`, paramètre `stack`) ne changent pas.

Les **parcours** (`/parcours`) sont des plans guidés par métier : des **modules** ordonnés d’**étapes**, chaque étape **référençant** une fiche existante, quel que soit son stack (une même fiche peut appartenir à plusieurs parcours, au plus une fois par parcours). Lecture publique, sans compte ni verrou : l’ordre est un conseil. Seules les étapes dont la fiche est publiée apparaissent ; un module sans étape visible est masqué ; un parcours brouillon ou inconnu donne le même 404. Une fiche ouverte depuis un parcours (`/entries/:slug?parcours=<slug>`) affiche « Retour au parcours » — ce paramètre n’est qu’un lien, il n’ouvre aucun droit.

La **progression** n’est **jamais stockée** : elle se déduit des données existantes. Une étape est validée quand le compte a terminé un examen de la fiche avec au moins **70/100** ; une fiche trop courte pour un examen (< 80 caractères) est validée dès son ouverture par un compte connecté (trace de lecture). Une validation reste acquise après un échec ultérieur, et vaut pour tous les parcours qui contiennent la fiche. Pas de case « terminé » : pour passer une notion connue, il suffit de réussir son examen. La page charge le plan (`GET /learning-paths/:slug`, public) et la progression (`GET /progress/learning-paths/:slug`, session) en parallèle ; un **401** sur la seconde signifie « visiteur » (invitation à se connecter), pas une erreur. Aucune table de cette feature ne référence `User` : rien à ajouter à la suppression de compte.

Les **sources** d’une fiche sont une liste ordonnée (dix au plus) saisie dans le formulaire d’administration, ligne par ligne : titre et lien obligatoires, éditeur, date de consultation, licence et son lien, et la mention « adaptée ». Elles voyagent dans le corps de `POST` / `PATCH /admin/entries` (`sources` absent d’un `PATCH` : liste inchangée ; présent : liste **remplacée**) et sortent dans `GET /entries/:slug` et `GET /admin/entries/:id`. Un lien qui n’est pas en `https://`, un titre vide, une onzième source ou un champ inconnu donnent **400**, et rien n’est enregistré. `verifiedOn` (`AAAA-MM-JJ`, jamais dans le futur, `null` pour l’effacer) et `verifiedVersion` s’affichent dans l’en-tête de la fiche (« Vérifié le 6 octobre 2026 · React 19 ») : la date est saisie par l’administration, jamais déduite de la dernière modification. Sur la page d’une fiche, le contenu suit l’en-tête ; le bloc « Sources », le bouton d’examen, la note personnelle, les liens « Étape précédente / suivante » (fiche ouverte avec `?parcours=<slug>`, d’après le plan public du parcours) et le lien « Signaler une erreur » viennent après. Ce lien mène à `/contact?fiche=<slug>` : l’adresse ne porte que le slug, le message est composé par la page à partir d’une fiche publiée, et `POST /contact` ne change pas.

L’**examen** d’une fiche est aussi un écran d’apprenant : `/entries/:slug/exam` est sous `AppLayout` (hors `/admin/...`). Le bouton « Passer l’examen » n’apparaît sur la fiche que s’il y a une session better-auth ; un visiteur y lit à la place « Se connecter pour passer l’examen », qui ramène à la fiche après connexion. La page vérifie `GET /me` (**401** → connexion, en retenant la page) puis `POST /quizzes/start` — jamais `GET /admin/me`, jamais `useSession()` comme garde, jamais `GET /entries/:slug` (le corps fuirait dans l’onglet réseau).

`POST /quizzes/start` **génère** un QCM à partir du `bodyMdx` de la fiche publiée s’il n’y a pas de tentative en cours, puis le fige. Une tentative **en cours** se reprend **sans** nouvel appel au générateur. Un corps trop court (< 80 caractères après trim) → `{ attempt: null }` : état vide « Pas d'épreuve pour cette fiche. », aucune ligne créée. Une panne du générateur (clé absente, timeout, fournisseur, JSON invalide) → **503** : message « réessayer », **pas** l’état vide. Après **Valider** (`POST /quizzes/:id/submit`), l’écran résultat montre le score 0–100 (`correctCount` / `total`) et, pour chaque question, le choix de l’utilisateur et la bonne proposition, plus un lien **Voir la fiche** — toujours **sans** `bodyMdx`. Une nouvelle ouverture après notation produit un **nouveau** jeu (pas le snapshot noté). Le corps n’est visible que sur `/entries/:slug`.

L’admin SPA appelle `GET /admin/me` : **401** → `/login`, **403** → refus. Pas de `useSession()` pour cette garde.

Les écrans `/admin/stacks` listent, créent, modifient et suppriment les stacks (nom + description seulement ; slug et `position` restent côté serveur). Ils appellent `GET` / `POST` / `PATCH` / `DELETE /admin/stacks`. `GET /admin/stacks` renvoie `{ items, total, page, limit }` (query `page` ≥ 1, `limit` 1–50, défauts 1 / 50). `DELETE /admin/stacks/:id` répond `204` et cascade catégories + fiches. La suppression se fait depuis la liste (`/admin/stacks`), pas sur une page dédiée.

Les écrans `/admin/categories` font de même pour les catégories. À la création, l’admin choisit un stack parent (`stackId`) ; en édition le stack est affiché en lecture seule (pas de `stackId` dans le `PATCH`). Slug et `position` restent côté serveur. `GET /admin/categories` renvoie `{ items, total, page, limit }` (mêmes query `page` / `limit` que les stacks). `DELETE /admin/categories/:id` répond `204` et cascade les fiches ; le stack parent reste. La suppression se fait depuis la liste (`/admin/categories`).

Les écrans `/admin/entries` font de même pour les fiches (brouillons inclus). À la création, l’admin choisit une catégorie parente (`categoryId`) ; en édition la catégorie (et le stack) sont affichés en lecture seule (pas de `categoryId` dans le `PATCH`). Slug et `position` restent côté serveur. `files` et `published` sont optionnels (brouillon par défaut). Le formulaire saisit `files` (chemin + code) et `dependencies` (paquet + version) en listes, et le modèle Sandpack dans un select — pas de JSON échappé. `GET /admin/entries` renvoie `{ items, total, page, limit }` (mêmes query `page` / `limit` que les stacks ; **toutes** les fiches, pas seulement les publiées). `GET /admin/entries/:id` renvoie une fiche + sa catégorie / stack. Une fiche créée sans case « publié » reste un brouillon : elle apparaît en admin, pas sur `GET /entries/:slug`. `DELETE /admin/entries/:id` répond `204` et cascade révisions / quiz ; la catégorie parente reste. La suppression se fait depuis la liste (`/admin/entries`). `GET /admin/entries` accepte aussi `q` (titre, casse ignorée), utilisé par le choix de fiche de l’éditeur de parcours.

Les écrans `/admin/parcours` listent, créent et composent les parcours. Un parcours naît **brouillon** (case « Publié » à l’édition) ; slug et `position` restent côté serveur. L’éditeur ajoute, renomme, réordonne (↑ / ↓) et supprime modules et étapes ; une étape se choisit par recherche de titre (brouillons inclus, signalés) et peut être marquée « facultative » (hors du total de progression). Chaque écriture renvoie le parcours complet. Réordonner envoie l’ordre **complet** (`PUT …/order`, appliqué dans une transaction) : une liste devenue obsolète (autre onglet) → **409** et rechargement. Une fiche déjà présente dans le parcours → **409** ; plafonds : 30 modules et 200 étapes par parcours (**409** au-delà). Supprimer une étape, un module ou un parcours ne supprime jamais de fiche.

## Scripts utiles

Dans `backend/` :

| Commande                                        | Effet                                                                                                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm start:dev`                                | API en watch                                                                                                                                                                         |
| `pnpm build` / `pnpm start:prod`                | build puis prod                                                                                                                                                                      |
| `pnpm test` / `pnpm test:cov` / `pnpm test:e2e` | tests unitaires (services + `slugify` + `scoreQuiz` + `isQuizEligible` + `quizRetryAt` + `computePathProgress` + `rankStartedPaths` + `account-profile` + `LlmQuizGenerator`, seuil 90 %), couverture, e2e 401 admin (stacks, catégories, fiches, parcours), quizzes, favorites, notes, progression et repères, 404 des anciennes routes de révision |
| `pnpm db:generate`                              | client Prisma (`src/generated`, gitignoré)                                                                                                                                           |
| `pnpm db:migrate`                               | applique les migrations                                                                                                                                                              |
| `pnpm db:seed`                                  | données de démo (dont le parcours « Maîtriser les hooks React », recréé à chaque seed) + promotion admin                                                                            |
| `pnpm db:demo-content`                          | production : met à jour résumé, corps et sources des fiches de démo **existantes** et pas encore converties ; ne crée, ne publie et ne supprime rien                                |
| `pnpm format`                                   | Prettier                                                                                                                                                                             |

Dans `frontend/` : `pnpm dev`, `pnpm build`, `pnpm lint` (oxlint), `pnpm format`.

## API (repères)

| Méthode                 | Chemin                                                 | Accès                                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `*`                     | `/api/auth/*`                                          | better-auth (login, register, session ; `send-verification-email` : session exigée, **401** sinon, **503** si l’envoi échoue ; `verify-email` : lien du message)                                                                                                                                                |
| `GET`                   | `/me`                                                  | utilisateur connecté                                                                                                                                                                  |
| `GET`                   | `/admin/me`                                            | admin                                                                                                                                                                                 |
| `GET`                   | `/stacks`, `/stacks/:slug`                             | public                                                                                                                                                                                |
| `GET`                   | `/stacks/:stackSlug/categories/:categorySlug`          | public                                                                                                                                                                                |
| `GET`                   | `/entries`                                             | public (paginé : `page` / `limit` 1–50 ; query optionnelle `q`, `kind`, `difficulty`, `stack`, `tag` ; publiées seulement, sans `bodyMdx`)                                            |
| `GET`                   | `/entries/:slug`                                       | public, sans session (fiche publiée ; `access: 'free'` : fiche entière avec `sources`, `verifiedOn`, `verifiedVersion`, `quizEligible` ; `access: 'reserved'` : en-tête seul, sans `bodyMdx`, `files`, `dependencies`, `sources` ni `quizEligible` ; brouillon ou inconnue → **404**) |
| `GET`                   | `/reader/entries/:slug`                                | session + adresse vérifiée (fiche publiée entière ; **401** sans session, **403** « La lecture de cette fiche demande une adresse vérifiée » pour tout slug, **404** si inconnue ou brouillon) |
| `GET`                   | `/access/entries?ids=`                                 | public (1 à 50 UUID séparés par des virgules, sinon **400** ; `{ items: [{ entryId, free }] }` ; fiche inconnue ou brouillon omise)                                                    |
| `GET`                   | `/access/summary`                                      | public (`{ freeEntryCount }` : nombre de fiches lisibles sans compte)                                                                                                                 |
| `PUT`                   | `/progress/entries/:entryId/read`                      | session (`204`, idempotent ; fiche publiée seulement, inconnue ou brouillon → **404** ; fiche réservée et adresse non vérifiée → **403**, rien n’est écrit)                                                                                                |
| `GET`                   | `/progress/entries?ids=`                               | session (1 à 50 UUID séparés par des virgules, sinon **400** ; `{ passingScore, items: [{ entryId, read, bestScore, passed, favorite }] }` ; fiche inconnue ou brouillon omise)       |
| `GET`                   | `/progress/started-paths`                              | session (les 3 parcours publiés suivis le plus récemment : progression, prochaine étape, `total`)                                                                                     |
| `GET`                   | `/favorites`                                           | session (paginé : `page` / `limit` 1–50 ; query optionnelle `entryId` ; fiches publiées du compte connecté seulement, sans `bodyMdx`)                                                 |
| `POST`                  | `/favorites`                                           | session (body `{ entryId }` ; fiche publiée seulement ; `201` créé / `200` déjà présent, idempotent)                                                                                  |
| `DELETE`                | `/favorites/:entryId`                                  | session (`204` idempotent ; déjà absent ou fiche d’un autre compte = no-op, pas 403)                                                                                                  |
| `GET`                   | `/notes`                                               | session (paginé : `page` / `limit` 1–50 ; query optionnelle `entryId` ; fiches publiées du compte connecté seulement, triées par modification, sans `bodyMdx`)                        |
| `PUT`                   | `/notes/:entryId`                                      | session (body `{ content }` ; fiche publiée seulement ; `201` créée / `200` remplacée ; contenu vide/espaces → `204`, suppression ou no-op)                                          |
| `DELETE`                | `/notes/:entryId`                                      | session (`204` idempotent ; déjà absent ou fiche d’un autre compte = no-op, pas 403)                                                                                                  |
| `GET`                   | `/learning-paths`                                      | public (paginé : `page` / `limit` 1–50 ; parcours publiés, `stepCount` = étapes à fiche publiée)                                                                                    |
| `GET`                   | `/learning-paths/:slug`                                | public (modules et étapes ordonnés, fiches publiées seulement, sans `bodyMdx` ; brouillon ou inconnu → **404**)                                                                    |
| `GET`                   | `/progress/learning-paths`                             | session (même pagination et même ordre que `/learning-paths` ; `{ pathId, required, validatedRequired, completed }` par parcours)                                                   |
| `GET`                   | `/progress/learning-paths/:slug`                       | session (`passingScore`, `validatedStepIds`, compteurs globaux et par module, `nextStepId`, `completed` ; aucun identifiant de compte en paramètre)                                                |
| `POST`                  | `/quizzes/start`                                       | session (body `{ slug }` ; fiche réservée et adresse non vérifiée → **403**, sans reprise ni génération ; génère ou reprend sans `correctIndex` / `bodyMdx` ; au-delà de 10 examens démarrés par heure et par compte → **429** avec `retryAt` ; `{ attempt: null }` si corps trop court ; **503** si génération en échec)                              |
| `POST`                  | `/quizzes/:id/submit`                                  | session (body `{ answers: [{ questionId, choiceIndex }] }` ; fiche réservée et adresse non vérifiée → **403**, sans correction ; `{ id, score, passed, passingScore, correctCount, total, questions[], entry }` avec récap `selectedChoice` / `correctChoice` / `correctIndex`) |
| `GET`                   | `/admin/stacks`                                        | admin (paginé : `page` ≥ 1, `limit` 1–50, défauts 1 / 50)                                                                                                                             |
| `GET`                   | `/admin/stacks/:id`                                    | admin                                                                                                                                                                                 |
| `DELETE`                | `/admin/stacks/:id`                                    | admin (`204`, cascade)                                                                                                                                                                |
| `GET`                   | `/admin/categories`                                    | admin (paginé : `page` ≥ 1, `limit` 1–50, défauts 1 / 50)                                                                                                                             |
| `GET`                   | `/admin/categories/:id`                                | admin                                                                                                                                                                                 |
| `DELETE`                | `/admin/categories/:id`                                | admin (`204`, cascade fiches ; le stack reste)                                                                                                                                        |
| `GET`                   | `/admin/entries`                                       | admin (paginé : `page` ≥ 1, `limit` 1–50, défauts 1 / 50 ; brouillons inclus)                                                                                                         |
| `GET`                   | `/admin/entries/:id`                                   | admin                                                                                                                                                                                 |
| `DELETE`                | `/admin/entries/:id`                                   | admin (`204`, cascade lectures / quiz ; la catégorie reste)                                                                                                                          |
| `POST` `PATCH` `DELETE` | `/admin/stacks`, `/admin/categories`, `/admin/entries` | admin                                                                                                                                                                                 |
| `GET` `POST` `PATCH` `DELETE` | `/admin/learning-paths[/:id]`                    | admin (liste paginée brouillons inclus ; détail complet ; création en brouillon ; `PATCH` nom / description / `published`)                                                        |
| `POST` `PATCH` `DELETE` | `/admin/learning-paths/:id/modules[/:moduleId]`        | admin (écritures → parcours complet ; `DELETE` → `204`, étapes en cascade)                                                                                                         |
| `POST`                  | `/admin/learning-paths/:id/modules/:moduleId/steps`    | admin (body `{ entryId, optional? }` ; fiche brouillon acceptée ; doublon dans le parcours → **409**)                                                                              |
| `PATCH` `DELETE`        | `/admin/learning-paths/:id/steps/:stepId`              | admin (`PATCH` body `{ optional }` ; `DELETE` → `204`, la fiche reste)                                                                                                             |
| `PUT`                   | `/admin/learning-paths/:id/modules/order`, `…/modules/:moduleId/steps/order` | admin (ordre **complet** `{ moduleIds }` / `{ stepIds }` ; liste obsolète → **409**)                                                                         |

Sans cookie, `/reader/entries/:slug`, les deux chemins `/quizzes/*`, les trois chemins `/favorites/*`, les trois chemins `/notes/*`, les deux chemins `/progress/entries/*`, les deux chemins `/progress/learning-paths/*` et `/progress/started-paths` répondent **401**. Les anciens chemins `/reviews/*` répondent **404**. Une tentative d’un autre compte, inconnue, déjà corrigée, ou dont la fiche n’est plus publiée → **404** (pas 403 : on ne révèle pas qu’elle existe). Un favori ou une note d’un autre compte ou déjà absent → **204** au retrait (même logique, sans révéler l’existence). Une génération d’épreuve en échec → **503** (aucune tentative créée, pas de `bodyMdx`).

Slug et `position` sont calculés **côté serveur** (`position` à la création seulement). Le slug d’une fiche est unique dans toute la base.

## Structure

```
backend/
  prisma/          schéma, migrations, PrismaModule
  src/
    auth/          better-auth + SessionGuard / AdminGuard / VerifiedEmailGuard, expéditeurs des messages (réinitialisation, vérification de l’adresse)
    stacks/
    categories/
    entries/       un dossier = un domaine (module, controller, service, dto/)
                   écritures admin = admin-*.controller.ts ; lecture complète = reader-entries.controller.ts (SessionGuard + VerifiedEmailGuard)
    entry-access/  règle d’accès : fiches lisibles sans compte, droit de lecture d’un compte (lectures publiques `/access/...`)
    entry-progress/ trace de lecture et repères d’une fiche (SessionGuard, pas AdminGuard)
    quizzes/       génération LLM au start, submit + récap (SessionGuard, pas AdminGuard)
    favorites/     lister, marquer, retirer (SessionGuard, pas AdminGuard)
    notes/         lister, écrire/remplacer, supprimer (SessionGuard, pas AdminGuard)
    learning-paths/ parcours : lecture publique, composition admin (admin-*), progression et parcours commencés (SessionGuard)
    common/        slugify, score QCM (`scoreQuiz`), seuils d’examen (`isQuizEligible`), plafond d’examens (`quizRetryAt`), progression (`computePathProgress`, `rankStartedPaths`), règles de compte (`account-deletion`, `account-profile`, `email-verification-rules`), accès libre (`freeEntryIds`)
frontend/
  src/
    pages/         une page = une route (App.tsx = table de routes) ; SearchPage = /recherche ; FavoritesPage = /favoris ; NotesPage = /notes ; PathsPage = /parcours ; PathPage = /parcours/:slug ; ExamPage = /entries/:slug/exam ; EmailVerifiedPage = /adresse-verifiee ; pages publiques d’orientation / légal / 404
    pages/admin/   layout imbriqué (<Outlet />), dashboard, CRUD stacks, catégories et fiches, composition des parcours
    components/    UI, sidebar, pied de page, Error Boundary, admin (listes, formulaires), EntryMdx, Playground
    lib/           apiFetch, client better-auth, stacks, admin, entryProgress, quizzes, favorites, notes, learningPaths, viewerAccess, entryAccess, entryReading, returnTo, examResult, pageTitle, sandpack, site-legal
```

Flux HTTP : requête → `ValidationPipe` + DTO (`class-validator`) → controller → service → Prisma → JSON.

## Licence

Usage personnel / apprentissage.
