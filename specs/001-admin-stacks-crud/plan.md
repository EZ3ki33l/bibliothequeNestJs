# Implementation Plan: Écran admin des stacks

**Branch**: `001-admin-stacks-crud` | **Date**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-admin-stacks-crud/spec.md`

## Summary

Donner à l’administrateur un écran SPA `/admin/stacks` pour lister, créer, modifier et supprimer les stacks, derrière la même porte que le reste de l’admin (session + rôle). L’API d’écriture existe déjà (`AdminStacksController`) ; il manque **`GET /admin/stacks` paginé**. Le front ajoute des pages sous `AdminLayout`, appelle `apiFetch`, et n’utilise pas le catalogue public pour ce CRUD.

## Technical Context

**Language/Version**: TypeScript (NestJS 11 / React 19)

**Primary Dependencies**: NestJS (`ValidationPipe`, `SessionGuard`, `AdminGuard`), Prisma 7, better-auth 1.7.x, Vite, React Router (`App.tsx` + `<Outlet />`)

**Storage**: PostgreSQL — modèle `Stack` existant, **pas de migration**

**Testing**: Jest e2e backend (`pnpm test:e2e`) pour les 401 admin ; parcours navigateur (quickstart). Pas de runner de tests frontend aujourd’hui.

**Target Platform**: API locale `:4000` + SPA `:5173`

**Project Type**: web (backend Nest + frontend Vite, deux `package.json`)

**Performance Goals**: liste admin ≤ 50 items / page ; création d’un stack < 2 minutes (SC-001)

**Constraints**: constitution — DTO `class-validator`, listes paginées, pas de Prisma au client, slug/`position` serveur, garde SPA = `GET /admin/me`, fail closed (401/403)

**Scale/Scope**: un domaine existant (`stacks/`) ; 3 routes SPA + 1 endpoint GET ; hors périmètre catégories/fiches/reorder

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Verdict | Commentaire |
| --- | --- | --- |
| I. Conventions d’équipe | PASS | On étend module / contrôleur admin / service / `dto/` existants. Pas de Prisma dans le contrôleur. `Logger` si log ; pas de `console.log`. |
| II. Sécurité d’abord | PASS | `SessionGuard` + `AdminGuard` déjà sur la classe. Body = DTO existants. Query liste = nouveau DTO. Tests 401. Cascade = confirmation UI, pas un trou IDOR (rôle admin). |
| III. Frontière backend / frontend | PASS | Pages dans `frontend/src/pages/admin/`, routes dans `App.tsx`, `apiFetch` + cookie. Pas de `useSession()` pour la garde. Lectures admin ≠ `GET /stacks` public. |
| IV. Simplicité | PASS | Pas de nouveau module, pas de CQRS, pas de dialog custom. Une méthode service de liste admin à côté de `findAll()` public. |
| V. Contrats HTTP | PASS | `GET /admin/stacks` documenté (enveloppe paginée). `CreateStackDto` / `UpdateStackDto` inchangés. README à aligner à l’implémentation. |

**Post-design (Phase 1)** : inchangé. Contrats + data-model ne rajoutent ni couche ni client Prisma. Gate toujours PASS. Pas d’entrée dans Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-admin-stacks-crud/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/admin-stacks.md
└── tasks.md              # /speckit-tasks — pas encore créé
```

### Source Code (repository root)

```text
backend/
├── src/stacks/
│   ├── admin-stacks.controller.ts   # + GET /  (AVANT :id)
│   ├── stacks.service.ts            # + findAllAdmin(page, limit)
│   ├── dto/create-stack.dto.ts      # inchangé (CreateStackDto)
│   ├── dto/update-stack.dto.ts      # inchangé
│   └── dto/list-stacks-query.dto.ts # nouveau
└── test/                            # 401 GET/POST /admin/stacks

frontend/
├── src/App.tsx                      # routes /admin/stacks, /new, /:id/edit
├── src/lib/admin.ts                 # list/create/update/delete + types
└── src/pages/admin/
    ├── AdminLayout.tsx              # lien nav Stacks
    ├── AdminPage.tsx                # lien dashboard
    ├── AdminStacksPage.tsx          # liste + supprimer
    ├── AdminStackNewPage.tsx
    ├── AdminStackEditPage.tsx
    └── AdminStackForm.tsx           # name + description seulement
```

**Structure Decision**: deux applications déjà en place. Tout le backend reste dans le domaine `stacks/` (un dossier = un domaine). Tout le SPA admin reste dans `pages/admin/` + table de routes `App.tsx`. Pas de `src/app/.../page.tsx`.

## Complexity Tracking

> Rempli uniquement en cas de violation de constitution justifiée.

Aucune violation.
