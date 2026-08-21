## Learned User Preferences

- Continual learning : manuel uniquement (`/continual-learning`) ; ne pas réactiver le hook `stop`.
- Sauvegarde = Prettier (`editor.formatOnSave` + `esbenp.prettier-vscode`).
- Explications organisées avec extraits complets ; pas de bouts de code fragmentés enchaînés.
- Réponses en français. Une idée principale par explication NestJS. Comparer à Next.js (Zod, server actions du projet `bibliotheque/`) quand ça éclaire.
- En Ask / conseil : ne jamais proposer de passer en Agent mode.
- Pédagogie : une étape du plan à la fois ; l'utilisateur code souvent lui-même puis demande de vérifier — ne pas générer tous les fichiers d'un coup.
- Frontend Vite : rester sur `src/pages/` (HomePage, LoginPage, etc.) ; `App.tsx` = table de routes. Pas de React Router framework / SSR. Ne pas calquer l'App Router Next (`src/app/.../page.tsx`).
- Vérifier les types/docs React 19 en vigueur (`SubmitEvent` importé de `'react'`, pas `FormEvent` déprécié).

## Learned Workspace Facts

- Backend NestJS 11 + Prisma 7 (`@prisma/adapter-pg`, PostgreSQL) ; frontend Vite/React séparé (`frontend/`). Prisma uniquement dans `backend/`.
- Deux `package.json` (pas de workspace pnpm racine) : commandes dans `backend/` ou `frontend/`.
- pnpm 11 : les overrides vivent dans `backend/pnpm-workspace.yaml`, pas dans le champ `pnpm` de `package.json`.
- ESLint 10 ; `glob` est forcé en `^13.0.6` et `test-exclude` en `^8.0.0` pour éviter les paquets dépréciés de Jest.
- Prisma : `PrismaModule` dans `backend/prisma/` ; client généré dans `backend/src/generated` (gitignoré).
- Auth : better-auth + `SessionGuard` / `AdminGuard` ; montée dans `main.ts` (`toNodeHandler` `/api/auth`) + guards, pas d'`AuthModule` ; CORS : `FRONTEND_ORIGIN` (défaut `http://localhost:5173`) + `credentials: true`.
- Migration depuis `/mnt/SSD medias/Codes/bibliotheque/` (Next.js) : domaines stacks, categories, entries.
- Écritures admin : `admin-*.controller.ts` sous `/admin/...` (GET publics séparés) ; chaque feature module doit être importé dans `AppModule`.
- Slug et `position` calculés côté serveur (`position` à la création seulement) ; slug d'entry unique globalement.
- Frontend SPA Vite (`:5173`) : `VITE_API_URL` → Nest `:4000`, `apiFetch` + `credentials: 'include'`, client better-auth dans `frontend/src/lib/auth.ts` (même 1.7.x que le backend) ; jamais Prisma côté client.
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
