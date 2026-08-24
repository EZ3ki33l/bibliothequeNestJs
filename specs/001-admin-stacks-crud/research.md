# Research: Écran admin des stacks

## 1. Liste admin manquante

**Decision**: Ajouter `GET /admin/stacks` sur `AdminStacksController` (déjà protégé par `SessionGuard` + `AdminGuard`). Ne pas réutiliser `GET /stacks` (public) pour l’écran admin.

**Rationale**: La spec (FR-007) et la constitution (lectures admin ≠ catalogue public) l’exigent. Aujourd’hui le contrôleur admin n’a que `GET :id`, `POST`, `PATCH`, `DELETE`. Le dashboard SPA appelle encore `GET /stacks` pour compter : c’est un raccourci à corriger pour le compteur stacks, via la nouvelle liste admin.

**Alternatives considered**:
- Réutiliser `GET /stacks` : plus rapide, mais mélange public et admin, et n’a pas de pagination explicite (seulement `take: 50`).
- Nouveau module Nest : interdit (YAGNI) ; le domaine `stacks/` existe déjà.

## 2. Forme de la pagination

**Decision**: Query `page` (défaut 1) et `limit` (défaut 50, max 50). Réponse `{ items, total, page, limit }`. DTO de query `class-validator` (`ListStacksQueryDto`).

**Rationale**: Toute liste MUST être paginée (constitution). Un tableau JSON nu ne dit pas s’il reste des pages. L’enveloppe est le contrat **nouveau** de la liste admin ; `GET /stacks` public reste un tableau (hors périmètre).

**Alternatives considered**:
- Même `take: 50` sans `page` : trop faible pour FR-003 (« parcourir tous les stacks »).
- Cursor pagination : trop complexe pour ~dizaines de stacks.

## 3. Routes navigateur

**Decision**:
- liste : `/admin/stacks`
- création : `/admin/stacks/new`
- édition : `/admin/stacks/:id/edit`

Enfants de `AdminLayout` dans `App.tsx`. Déclarer `/new` **avant** `/:id/edit`.

**Rationale**: Spec = écrans dédiés, URLs en anglais comme `/login` et `/admin`. Même schéma que l’ancien Next (`new`, `[id]/edit`) sans copier l’App Router (`page.tsx`).

**Alternatives considered**: Modale unique sur la liste (spec = écrans dédiés). `/nouveau` en français (incohérent avec le reste).

## 4. Formulaire partagé

**Decision**: Un composant `AdminStackForm` dans `frontend/src/pages/admin/` (champs `name` + `description` uniquement). Pages new/edit l’utilisent. Pas de champs cachés `slug` / `position`.

**Rationale**: Le serveur calcule slug et `position`. Envoyer ces champs depuis le client violerait FR-008 et ouvrirait une assignation de masse (l’ancien Next le faisait ; on ne recopie pas).

**Alternatives considered**: Deux formulaires copiés-collés ; Zod côté SPA (la validation de contrat reste Nest + DTO).

## 5. Suppression

**Decision**: Bouton sur la **liste** uniquement. `window.confirm` avec un texte qui mentionne catégories et fiches. Puis `DELETE /admin/stacks/:id`. Cascade Prisma déjà en place (`onDelete: Cascade`).

**Rationale**: Spec US4 = depuis la liste. `window.confirm` suffit (YAGNI : pas de dialog custom). Ne pas bloquer s’il reste des enfants : la confirmation **est** la protection.

**Alternatives considered**: Suppression aussi sur l’édition (ancien Next) — hors hypothèses de la spec actuelle. Interdire la suppression s’il reste des catégories — contredit la spec.

## 6. Client HTTP SPA

**Decision**: Étendre `frontend/src/lib/admin.ts` (`apiFetch`, `credentials: 'include'`). Ne pas appeler `listStacks()` (`lib/stacks.ts`) depuis l’admin CRUD.

**Rationale**: Un module front « admin » existe déjà (`getAdminMe`, catégories). Prisma côté client interdit.

**Alternatives considered**: Nouveau `lib/admin-stacks.ts` (fichier de plus sans besoin). `useSession()` pour la garde (interdit ; `AdminLayout` + `GET /admin/me` reste la seule porte).

## 7. Tests authz

**Decision**: e2e (ou requête HTTP équivalente) : `GET` et `POST /admin/stacks` **sans** cookie → 401. Réutiliser `SessionGuard` / `AdminGuard` déjà posés sur le contrôleur ; ne pas créer d’`AuthModule`.

**Rationale**: Constitution : changement de contrat authz (401 / 403 / rôle admin) MUST être couvert par un test. Un 401 sans session est le plus simple et déjà fail-closed.

**Alternatives considered**: Tester 403 avec un vrai compte non-admin (plus lourd : inscription + pas de ligne `Admin`). Peut venir plus tard. Tests frontend : pas de runner dans `frontend/package.json` ; validation = navigateur / curl (quickstart).

## 8. Ce qu’on ne touche pas

**Decision**: Pas de migration Prisma. Pas de changement des routes publiques. Pas de CRUD catégories/fiches. Pas de réordonnancement. `CreateStackDto` / `UpdateStackDto` / `create` / `update` / `delete` inchangés sauf si le service a besoin d’une méthode de liste admin à côté de `findAll()` public.

**Rationale**: Spec FR-013 + YAGNI. `findAll()` public (`take: 50`, tableau) reste le catalogue.

---

Aucune question ouverte : les choix ci-dessus lèvent les ambiguïtés d’implémentation sans modifier la spec.
