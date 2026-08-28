## Learned User Preferences

- Continual learning : manuel uniquement (`/continual-learning`) ; ne pas réactiver le hook `stop`.
- Sauvegarde = Prettier (`editor.formatOnSave` + `esbenp.prettier-vscode`).
- Explications organisées avec extraits complets ; pas de bouts de code fragmentés enchaînés.
- Réponses en français. Une idée principale par explication NestJS. Comparer à Next.js (Zod, server actions du projet `bibliotheque/`) quand ça éclaire.
- En Ask / conseil : ne jamais proposer de passer en Agent mode.
- Pédagogie : si l'utilisateur code lui-même, une étape à la fois — ne pas générer tous les fichiers d'un coup. S'il dit « go phase N » ou « enchaîne phase X, Y », implémenter toute la phase Speckit (toutes ses tâches), pas un seul T00x. S'il demande les actions répétitives, appliquer le même changement à toutes les pages/composants concernés d'un coup.
- Formulaires admin : saisie `files` / `dependencies` en listes (chemin + code, paquet + version) et modèle Sandpack en select — jamais de JSON échappé.
- Frontend Vite : rester sur `src/pages/` (HomePage, LoginPage, `pages/admin/`, etc.) ; `App.tsx` = table de routes ; layouts `AppLayout` / `AuthLayout` / `AdminLayout` avec `<Outlet />`. Design calqué sur le Next.js `bibliotheque/` (HeroUI + Tailwind 4, `AppSidebar`) — `class="dark"` sur `<html>` (HeroUI 3) ; tokens HeroUI plutôt que zinc/white en dur. Pas l'App Router Next (`src/app/.../page.tsx`), pas de React Router framework / SSR.
- Vérifier les types/docs React 19 en vigueur (`SubmitEvent` importé de `'react'`, pas `FormEvent` déprécié).

## Learned Workspace Facts

- Backend NestJS 11 + Prisma 7 (`@prisma/adapter-pg`, PostgreSQL) ; frontend Vite/React séparé (`frontend/`). Prisma uniquement dans `backend/`.
- Deux `package.json` (pas de workspace pnpm racine) : commandes dans `backend/` ou `frontend/`.
- pnpm 11 : les overrides / `allowBuilds` vivent dans `pnpm-workspace.yaml` de chaque package (`backend/` et `frontend/`, ex. `allowBuilds.es5-ext: false` côté front), pas dans le champ `pnpm` de `package.json`. Tout import applicatif doit être une dépendance directe (ex. `express@^5.2.1` dans le backend : `main.ts` l'importe ; le transitif de `@nestjs/platform-express` ne suffit pas).
- Tests backend Jest : unitaires sur services + `slugify` (seuil 90 % via `collectCoverageFrom`, Prisma mocké) ; e2e admin 401 avec Prisma et `getSession` mockés (Prisma 7 WASM et better-auth ESM cassent Jest). Pas de tests frontend ni de perf.
- Prisma : `PrismaModule` dans `backend/prisma/` ; client généré dans `backend/src/generated` (gitignoré). Modèles `ReviewCard` / `ReviewLog` / `ReviewRating` dans le schéma, pas encore de module Nest `reviews/`.
- Auth : better-auth + `SessionGuard` / `AdminGuard` ; montée dans `main.ts` (`toNodeHandler` `/api/auth`) + guards, pas d'`AuthModule` ; CORS : `FRONTEND_ORIGIN` (défaut `http://localhost:5173`) + `credentials: true`. Compte admin : `ADMIN_EMAIL` + inscription puis `pnpm db:seed` (pas un flag better-auth).
- Migration depuis `/mnt/SSDMedias/Codes/bibliotheque/` (Next.js) : domaines stacks, categories, entries. Chemin workspace sans espace (`/mnt/SSDMedias/...`) : un espace cassait Vite (`/@vite/client` en HTML, overlay `file://`) ; après déplacement, réaligner le store pnpm (`rm -rf node_modules && pnpm install`) — les liens pointaient vers `/mnt/SSD medias/.pnpm-store`.
- Admin : `admin-*.controller.ts` sous `/admin/...` (GET publics séparés). Lectures : `GET /admin/stacks/:id`, `GET /admin/categories`, `GET /admin/categories/:id`, `GET /admin/entries`, `GET /admin/entries/:id` (brouillons inclus ; le GET public `/entries` ne montre que les publiées). Garde front via `GET /admin/me` (401 → `/login`, 403 → refus), jamais `useSession()`. Chaque feature module importé dans `AppModule`.
- Slug et `position` calculés côté serveur (`position` à la création seulement) ; slug d'entry unique globalement. PATCH sans changer de parent (`stackId` / `categoryId` absents des DTO). Création de fiche : `files` et `published` optionnels (brouillon par défaut). Formulaire admin fiche : `files` / `template` / `dependencies` via `AdminKeyValueList` (`frontend/src/components/admin/`) — chemin + code, paquet + version, select Sandpack.
- Frontend SPA Vite (`:5173`) : HeroUI 3 + Tailwind 4 ; `class="dark"` sur `<html>` (`color-scheme: dark` ne suffit pas) ; ne pas redéfinir `--background` / `--foreground` hors layer (écrase les tokens). `VITE_API_URL` → Nest `:4000`, `apiFetch` + `credentials: 'include'`, client better-auth dans `frontend/src/lib/auth.ts` (même 1.7.x que le backend) ; catalogue dans `lib/stacks.ts` (404 Nest → `null`) ; admin dans `lib/admin.ts` ; jamais Prisma côté client.
- Catalogue public : `/stacks/:stackSlug/:categorySlug` (navigateur ; API = `/stacks/:stackSlug/categories/:categorySlug`) et `/entries/:slug`. Fiche : `EntryMdx` (`react-markdown` `MarkdownHooks` + `rehype-pretty-code`/`shiki` — le `Markdown` synchrone casse avec un plugin async) ; `Playground` Sandpack 2.x sans import CSS (Stitches) si `kind !== CONCEPT` et `files` non vide.
- DTOs Nest : `class-validator` (pas Zod).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
