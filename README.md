# Bibliothèque

Application d’apprentissage : des **stacks** (ex. React) contiennent des **catégories**, elles-mêmes des **fiches** (entries).

Deux applications distinctes — pas un monorepo pnpm :

| Dossier | Rôle | Port |
| --- | --- | --- |
| `backend/` | API NestJS 11 + Prisma 7 + PostgreSQL | `4000` |
| `frontend/` | SPA Vite + React 19 + HeroUI 3 + Tailwind 4 | `5173` |

Auth : [better-auth](https://www.better-auth.com/) (email / mot de passe, cookie de session). Les lectures publiques sont ouvertes ; les **révisions** passent par `/reviews/...` (session, **pas** admin) ; les **quiz** passent par `/quizzes/...` (session, **pas** admin) ; les écritures et lectures admin passent par `/admin/...` (session + rôle admin).

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
FRONTEND_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/bibliotheque?schema=public
BETTER_AUTH_URL=http://localhost:4000
BETTER_AUTH_SECRET=          # openssl rand -base64 32
ADMIN_EMAIL=ton@email.fr     # promu admin au seed, après inscription
```

Ne commite jamais `.env`. Pour un secret Better Auth :

```bash
openssl rand -base64 32
```

Données de démo (stack React, catégorie Hooks, fiche `useState`) :

```bash
pnpm db:seed
```

Le seed ne crée pas le compte : inscris-toi sur `/register` avec `ADMIN_EMAIL`, puis relance `pnpm db:seed`.

### 2. Frontend

```bash
cd frontend
echo 'VITE_API_URL=http://localhost:4000' > .env
pnpm install
pnpm dev
```

Ouvre [http://localhost:5173](http://localhost:5173). Les appels API envoient le cookie (`credentials: 'include'`).

## Pages (SPA)

`App.tsx` est la table de routes. Une page = un fichier dans `frontend/src/pages/`. `AppLayout` (sidebar) enveloppe le catalogue ; `AuthLayout` et `AdminLayout` s’imbriquent dessus via `<Outlet />`. Le thème sombre HeroUI 3 exige `class="dark"` sur `<html>` (`frontend/index.html`).

| Route navigateur | Page | Accès |
| --- | --- | --- |
| `/` | Accueil | public |
| `/login`, `/register` | Auth | public |
| `/stacks` | Liste des stacks | public |
| `/stacks/:slug` | Détail d’un stack | public |
| `/stacks/:stackSlug/:categorySlug` | Catégorie + fiches | public |
| `/entries/:slug` | Fiche | public |
| `/entries/:slug/exam` | Épreuve d’une fiche | session (pas admin) |
| `/review` | File de révisions | session (pas admin) |
| `/admin` | Dashboard admin | session + rôle admin |
| `/admin/stacks` | Liste des stacks | session + rôle admin |
| `/admin/stacks/new` | Créer un stack | session + rôle admin |
| `/admin/stacks/:id/edit` | Modifier un stack | session + rôle admin |
| `/admin/categories` | Liste des catégories | session + rôle admin |
| `/admin/categories/new` | Créer une catégorie | session + rôle admin |
| `/admin/categories/:id/edit` | Modifier une catégorie | session + rôle admin |
| `/admin/entries` | Liste des fiches | session + rôle admin |
| `/admin/entries/new` | Créer une fiche | session + rôle admin |
| `/admin/entries/:id/edit` | Modifier une fiche | session + rôle admin |

La route navigateur d’une catégorie **n’inclut pas** `categories` ; l’API, si : `GET /stacks/:stackSlug/categories/:categorySlug`.

Le corps d’une fiche (`bodyMdx`) est rendu par `EntryMdx` (`react-markdown` `MarkdownHooks` + `rehype-pretty-code` / Shiki). Si `kind` n’est pas `CONCEPT` et que `files` n’est pas vide, un playground Sandpack s’affiche sous le contenu.

Les **révisions** sont un écran d’apprenant, pas d’admin : `/review` est sous `AppLayout` (hors `/admin/...`). Le lien « Révisions » n’apparaît dans la sidebar que s’il y a une session better-auth. La page vérifie `GET /me` (**401** → `/login`) — jamais `GET /admin/me` ni `useSession()` comme garde. Un visiteur voit le catalogue inchangé ; un compte connecté qui ouvre une fiche **publiée** déclenche silencieusement `POST /reviews/ensure`. `GET /entries/:slug` ne crée pas de carte.

L’**examen** d’une fiche est aussi un écran d’apprenant : `/entries/:slug/exam` est sous `AppLayout` (hors `/admin/...`). Le lien « Examen » n’apparaît sur la fiche que s’il y a une session better-auth (un visiteur parcourt le catalogue comme avant). La page vérifie `GET /me` (**401** → `/login`) puis `POST /quizzes/start` — jamais `GET /admin/me`, jamais `useSession()` comme garde, jamais `GET /entries/:slug` (le corps fuirait dans l’onglet réseau). Réponses d’épreuve : titre, résumé, questions — **sans** `bodyMdx` ni `correctIndex`. Après **Valider**, l’écran résultat montre le score 0–100 (`correctCount` / `total`) et un lien « Voir la fiche » ; le corps n’est visible que sur `/entries/:slug`.

L’admin SPA appelle `GET /admin/me` : **401** → `/login`, **403** → refus. Pas de `useSession()` pour cette garde.

Les écrans `/admin/stacks` listent, créent, modifient et suppriment les stacks (nom + description seulement ; slug et `position` restent côté serveur). Ils appellent `GET` / `POST` / `PATCH` / `DELETE /admin/stacks`. `GET /admin/stacks` renvoie `{ items, total, page, limit }` (query `page` ≥ 1, `limit` 1–50, défauts 1 / 50). `DELETE /admin/stacks/:id` répond `204` et cascade catégories + fiches. La suppression se fait depuis la liste (`/admin/stacks`), pas sur une page dédiée.

Les écrans `/admin/categories` font de même pour les catégories. À la création, l’admin choisit un stack parent (`stackId`) ; en édition le stack est affiché en lecture seule (pas de `stackId` dans le `PATCH`). Slug et `position` restent côté serveur. `GET /admin/categories` renvoie `{ items, total, page, limit }` (mêmes query `page` / `limit` que les stacks). `DELETE /admin/categories/:id` répond `204` et cascade les fiches ; le stack parent reste. La suppression se fait depuis la liste (`/admin/categories`).

Les écrans `/admin/entries` font de même pour les fiches (brouillons inclus). À la création, l’admin choisit une catégorie parente (`categoryId`) ; en édition la catégorie (et le stack) sont affichés en lecture seule (pas de `categoryId` dans le `PATCH`). Slug et `position` restent côté serveur. `files` et `published` sont optionnels (brouillon par défaut). Le formulaire saisit `files` (chemin + code) et `dependencies` (paquet + version) en listes, et le modèle Sandpack dans un select — pas de JSON échappé. `GET /admin/entries` renvoie `{ items, total, page, limit }` (mêmes query `page` / `limit` que les stacks ; **toutes** les fiches, pas seulement les publiées). `GET /admin/entries/:id` renvoie une fiche + sa catégorie / stack. Une fiche créée sans case « publié » reste un brouillon : elle apparaît en admin, pas sur `GET /entries/:slug`. `DELETE /admin/entries/:id` répond `204` et cascade révisions / quiz ; la catégorie parente reste. La suppression se fait depuis la liste (`/admin/entries`).

## Scripts utiles

Dans `backend/` :

| Commande | Effet |
| --- | --- |
| `pnpm start:dev` | API en watch |
| `pnpm build` / `pnpm start:prod` | build puis prod |
| `pnpm test` / `pnpm test:cov` / `pnpm test:e2e` | tests unitaires (services + `slugify` + `scheduleReview` + `scoreQuiz`, seuil 90 %), couverture, e2e 401 admin (stacks, catégories, fiches), reviews et quizzes |
| `pnpm db:generate` | client Prisma (`src/generated`, gitignoré) |
| `pnpm db:migrate` | applique les migrations |
| `pnpm db:seed` | données de démo + promotion admin |
| `pnpm format` | Prettier |

Dans `frontend/` : `pnpm dev`, `pnpm build`, `pnpm lint` (oxlint), `pnpm format`.

## API (repères)

| Méthode | Chemin | Accès |
| --- | --- | --- |
| `*` | `/api/auth/*` | better-auth (login, register, session) |
| `GET` | `/me` | utilisateur connecté |
| `GET` | `/admin/me` | admin |
| `GET` | `/stacks`, `/stacks/:slug` | public |
| `GET` | `/stacks/:stackSlug/categories/:categorySlug` | public |
| `GET` | `/entries`, `/entries/:slug` | public |
| `GET` | `/reviews/due` | session (`{ current, remaining }` ; file vide = `current: null`, `remaining: 0`) |
| `POST` | `/reviews/ensure` | session (`204`, body `{ entryId }` ; fiche publiée seulement) |
| `POST` | `/reviews/:id/rate` | session (body `{ rating }` ∈ `AGAIN` \| `HARD` \| `GOOD` \| `EASY` ; réponse = même enveloppe que due) |
| `POST` | `/quizzes/start` | session (body `{ slug }` ; épreuve sans `correctIndex` / `bodyMdx`, ou `{ attempt: null }` si pas de jeu) |
| `POST` | `/quizzes/:id/submit` | session (body `{ answers: [{ questionId, choiceIndex }] }` ; `{ id, score, correctCount, total, entry }`) |
| `GET` | `/admin/stacks` | admin (paginé : `page` ≥ 1, `limit` 1–50, défauts 1 / 50) |
| `GET` | `/admin/stacks/:id` | admin |
| `DELETE` | `/admin/stacks/:id` | admin (`204`, cascade) |
| `GET` | `/admin/categories` | admin (paginé : `page` ≥ 1, `limit` 1–50, défauts 1 / 50) |
| `GET` | `/admin/categories/:id` | admin |
| `DELETE` | `/admin/categories/:id` | admin (`204`, cascade fiches ; le stack reste) |
| `GET` | `/admin/entries` | admin (paginé : `page` ≥ 1, `limit` 1–50, défauts 1 / 50 ; brouillons inclus) |
| `GET` | `/admin/entries/:id` | admin |
| `DELETE` | `/admin/entries/:id` | admin (`204`, cascade révisions / quiz ; la catégorie reste) |
| `POST` `PATCH` `DELETE` | `/admin/stacks`, `/admin/categories`, `/admin/entries` | admin |

Sans cookie, les trois chemins `/reviews/*` et les deux chemins `/quizzes/*` répondent **401**. Une carte ou une tentative d’un autre compte, inconnue, déjà notée / non due, ou dont la fiche n’est plus publiée → **404** (pas 403 : on ne révèle pas qu’elle existe).

Slug et `position` sont calculés **côté serveur** (`position` à la création seulement). Le slug d’une fiche est unique dans toute la base.

## Structure

```
backend/
  prisma/          schéma, migrations, PrismaModule
  src/
    auth/          better-auth + SessionGuard / AdminGuard
    stacks/
    categories/
    entries/       un dossier = un domaine (module, controller, service, dto/)
                   écritures admin = admin-*.controller.ts
    reviews/       file due, ensure, notation (SessionGuard, pas AdminGuard)
    quizzes/       start, submit (SessionGuard, pas AdminGuard)
    common/        slugify, calendrier SM-2 (`scheduleReview`), score QCM (`scoreQuiz`)
frontend/
  src/
    pages/         une page = une route (App.tsx = table de routes) ; ReviewPage = /review ; ExamPage = /entries/:slug/exam
    pages/admin/   layout imbriqué (<Outlet />), dashboard, CRUD stacks, catégories et fiches
    components/    UI, sidebar, admin (listes, formulaires), EntryMdx, Playground
    lib/           apiFetch, client better-auth, stacks, admin, reviews, quizzes, sandpack
```

Flux HTTP : requête → `ValidationPipe` + DTO (`class-validator`) → controller → service → Prisma → JSON.

## Licence

Usage personnel / apprentissage.
