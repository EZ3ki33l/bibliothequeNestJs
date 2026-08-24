# Bibliothèque

Application d’apprentissage : des **stacks** (ex. React) contiennent des **catégories**, elles-mêmes des **fiches** (entries).

Deux applications distinctes — pas un monorepo pnpm :

| Dossier | Rôle | Port |
| --- | --- | --- |
| `backend/` | API NestJS 11 + Prisma 7 + PostgreSQL | `4000` |
| `frontend/` | SPA Vite + React 19 | `5173` |

Auth : [better-auth](https://www.better-auth.com/) (email / mot de passe, cookie de session). Les lectures publiques sont ouvertes ; les écritures et lectures admin passent par `/admin/...` (session + rôle admin).

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

`App.tsx` est la table de routes. Une page = un fichier dans `frontend/src/pages/`.

| Route navigateur | Page | Accès |
| --- | --- | --- |
| `/` | Accueil | public |
| `/login`, `/register` | Auth | public |
| `/stacks` | Liste des stacks | public |
| `/stacks/:slug` | Détail d’un stack | public |
| `/stacks/:stackSlug/:categorySlug` | Catégorie + fiches | public |
| `/entries/:slug` | Fiche | public |
| `/admin` | Dashboard admin | session + rôle admin |
| `/admin/stacks` | Liste des stacks | session + rôle admin |
| `/admin/stacks/new` | Créer un stack | session + rôle admin |
| `/admin/stacks/:id/edit` | Modifier un stack | session + rôle admin |

La route navigateur d’une catégorie **n’inclut pas** `categories` ; l’API, si : `GET /stacks/:stackSlug/categories/:categorySlug`.

Le corps MDX d’une fiche (`bodyMdx`) s’affiche pour l’instant en texte (`<pre>`).

L’admin SPA appelle `GET /admin/me` : **401** → `/login`, **403** → refus. Pas de `useSession()` pour cette garde.

Les écrans `/admin/stacks` listent, créent et modifient les stacks (nom + description seulement). Ils appellent `GET` / `POST` / `PATCH /admin/stacks` ; `GET /admin/stacks` renvoie `{ items, total, page, limit }`.

## Scripts utiles

Dans `backend/` :

| Commande | Effet |
| --- | --- |
| `pnpm start:dev` | API en watch |
| `pnpm build` / `pnpm start:prod` | build puis prod |
| `pnpm test` / `pnpm test:e2e` | tests |
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
| `GET` | `/admin/stacks` | admin (paginé : `page` ≥ 1, `limit` 1–50, défauts 1 / 50) |
| `GET` | `/admin/stacks/:id` | admin |
| `GET` | `/admin/categories`, `/admin/categories/:id` | admin |
| `POST` `PATCH` `DELETE` | `/admin/stacks`, `/admin/categories`, `/admin/entries` | admin |

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
frontend/
  src/
    pages/         une page = une route (App.tsx = table de routes)
    pages/admin/   layout imbriqué (<Outlet />), dashboard, liste / création / édition des stacks
    lib/           apiFetch, client better-auth, stacks, admin
```

Flux HTTP : requête → `ValidationPipe` + DTO (`class-validator`) → controller → service → Prisma → JSON.

## Licence

Usage personnel / apprentissage.
