# Tasks: Écran admin des stacks

**Input**: Design documents from `/specs/001-admin-stacks-crud/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/admin-stacks.md, quickstart.md

**Tests**: uniquement les 401 admin (constitution + plan). Pas de TDD frontend.

**Organization**: une phase par user story (P1 → P4). Pas de nouveau module Nest, pas de migration Prisma.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallélisable (fichiers différents, pas de dépendance sur une tâche inachevée)
- **[Story]**: US1…US4 d’après spec.md
- Chaque description contient un chemin de fichier

## Path Conventions

- Backend : `backend/src/`, `backend/test/`
- Frontend : `frontend/src/pages/`, `frontend/src/lib/`, `frontend/src/App.tsx`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Fichier DTO manquant. Le domaine `stacks/` et `AdminLayout` existent déjà.

- [x] T001 Créer `ListStacksQueryDto` (`page` entier ≥ 1 défaut 1, `limit` entier 1–50 défaut 50, `@Type(() => Number)`) dans `backend/src/stacks/dto/list-stacks-query.dto.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: `GET /admin/stacks` paginé + client liste. Bloque toutes les user stories.

**⚠️ CRITICAL**: Ne pas commencer US1 tant que T002–T005 ne sont pas faits.

- [x] T002 Ajouter `findAllAdmin(page, limit)` dans `backend/src/stacks/stacks.service.ts` : `count` + `findMany` (`skip`/`take`), ordre `position` puis `name`, `select` id/name/slug/description + `_count.categories`, retour `{ items, total, page, limit }` — ne pas modifier `findAll()` public
- [x] T003 Ajouter `@Get()` `findAll(@Query() query: ListStacksQueryDto)` **au-dessus** de `@Get(':id')` dans `backend/src/stacks/admin-stacks.controller.ts` (classe `AdminStackController`, gardes déjà posées)
- [x] T004 [P] Ajouter e2e sans cookie : `GET /admin/stacks` → 401 et `POST /admin/stacks` → 401 dans `backend/test/admin-stacks.e2e-spec.ts` (même bootstrap que `backend/test/app.e2e-spec.ts`)
- [x] T005 [P] Ajouter types `AdminStackListItem` / enveloppe paginée et `listAdminStacks(page?, limit?)` via `apiFetch('/admin/stacks')` dans `frontend/src/lib/admin.ts` (ne pas appeler `listStacks()` de `frontend/src/lib/stacks.ts`)

**Checkpoint**: `curl` sans cookie sur `GET /admin/stacks` → 401 ; avec session admin → JSON `{ items, total, page, limit }`

---

## Phase 3: User Story 1 - Consulter la liste des stacks (Priority: P1) 🎯 MVP

**Goal**: Écran `/admin/stacks` (nom, slug, description, nombre de catégories), état vide, pagination, accès depuis le dashboard. 401/403 déjà gérés par `AdminLayout`.

**Independent Test**: admin voit la liste ; visiteur → `/login` ; non-admin → refus ; lien dashboard → `/admin/stacks`.

- [x] T006 [P] [US1] Créer la page liste (chargement, erreur, vide avec lien vers `/admin/stacks/new`, items, pagination si `total > limit`) dans `frontend/src/pages/admin/AdminStacksPage.tsx`
- [x] T007 [US1] Déclarer la route enfant `path="stacks"` → `AdminStacksPage` sous `/admin` dans `frontend/src/App.tsx`
- [x] T008 [P] [US1] Ajouter le lien nav « Stacks » vers `/admin/stacks` dans `frontend/src/pages/admin/AdminLayout.tsx`
- [x] T009 [P] [US1] Lier la carte Stacks vers `/admin/stacks` et compter via `listAdminStacks()` (`total`) au lieu de `listStacks()` dans `frontend/src/pages/admin/AdminPage.tsx`

**Checkpoint**: MVP — un admin peut ouvrir `/admin/stacks` et voir les stacks

---

## Phase 4: User Story 2 - Créer un stack (Priority: P2)

**Goal**: Formulaire nom + description, POST existant, retour liste. Slug/`position` non saisis.

**Independent Test**: créer un stack inédit → il apparaît en admin et sur `/stacks` ; nom trop court ou slug pris → message, on reste sur le formulaire.

- [x] T010 [P] [US2] Ajouter `createAdminStack({ name, description })` (`POST`, 201, parse 400/409) dans `frontend/src/lib/admin.ts`
- [x] T011 [P] [US2] Créer le formulaire (champs `name` + `description` seulement, `SubmitEvent` depuis `'react'`, erreurs Nest sans perdre le saisi, pas de slug/position) dans `frontend/src/pages/admin/AdminStackForm.tsx`
- [x] T012 [US2] Créer la page création (succès → `navigate('/admin/stacks')`) dans `frontend/src/pages/admin/AdminStackNewPage.tsx`
- [x] T013 [US2] Déclarer `path="stacks/new"` **avant** toute route `:id` dans `frontend/src/App.tsx`
- [x] T014 [US2] Ajouter le bouton « Nouveau stack » vers `/admin/stacks/new` dans `frontend/src/pages/admin/AdminStacksPage.tsx`

**Checkpoint**: US1 + US2 — liste et création fonctionnent

---

## Phase 5: User Story 3 - Modifier un stack (Priority: P3)

**Goal**: `/admin/stacks/:id/edit` prérempli, PATCH existant, 404 → message d’absence.

**Independent Test**: changer le nom → liste admin et catalogue public à jour ; id inconnu → absence.

- [x] T015 [P] [US3] Ajouter `getAdminStackById(id)` (`GET /admin/stacks/:id`, 404 → `null`) et `updateAdminStack(id, payload)` (`PATCH`) dans `frontend/src/lib/admin.ts`
- [x] T016 [US3] Étendre `AdminStackForm` (mode édition, valeurs initiales name/description) dans `frontend/src/pages/admin/AdminStackForm.tsx`
- [x] T017 [US3] Créer la page édition (id via `useParams`, stack `null` → absence, succès → liste) dans `frontend/src/pages/admin/AdminStackEditPage.tsx`
- [x] T018 [US3] Déclarer `path="stacks/:id/edit"` **après** `stacks/new` dans `frontend/src/App.tsx`
- [x] T019 [US3] Ajouter le lien « Modifier » vers `/admin/stacks/:id/edit` sur chaque ligne dans `frontend/src/pages/admin/AdminStacksPage.tsx`

**Checkpoint**: US1–US3 — liste, création, édition

---

## Phase 6: User Story 4 - Supprimer un stack (Priority: P4)

**Goal**: Suppression depuis la liste, `window.confirm` cascade, `DELETE` existant.

**Independent Test**: annuler → inchangé ; confirmer → disparu admin + `/stacks` + enfants.

- [ ] T020 [US4] Ajouter `deleteAdminStack(id)` (`DELETE`, 204) dans `frontend/src/lib/admin.ts`
- [ ] T021 [US4] Ajouter le bouton Supprimer + `confirm('Supprimer ce stack et toutes ses catégories / fiches ?')` puis recharger la liste dans `frontend/src/pages/admin/AdminStacksPage.tsx`

**Checkpoint**: les quatre opérations marchent sans outil externe

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Contrat documenté, formatage, graphe, quickstart

- [ ] T022 [P] Documenter `GET /admin/stacks` et les routes SPA `/admin/stacks`, `/admin/stacks/new`, `/admin/stacks/:id/edit` dans `README.md`
- [ ] T023 [P] Formater les fichiers TS/TSX touchés (`pnpm format` dans `backend/` et `frontend/`)
- [ ] T024 Exécuter `graphify update .` à la racine pour rafraîchir `graphify-out/`
- [ ] T025 Valider le parcours de `specs/001-admin-stacks-crud/quickstart.md` (curl 401 + navigateur admin)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 seul
- **Foundational (Phase 2)**: T001 → T002 → T003 → T004 et T005 en parallèle
- **User Stories**: toutes dépendent de la Phase 2 ; enchaîner P1 → P2 → P3 → P4 (même fichiers front : `admin.ts`, `App.tsx`, `AdminStacksPage.tsx`)
- **Polish**: après les stories livrées

### User Story Dependencies

- **US1 (P1)**: après Phase 2 — MVP
- **US2 (P2)**: après US1 (lien « Nouveau » + routes)
- **US3 (P3)**: après US2 (`AdminStackForm` partagé)
- **US4 (P4)**: après US1 (bouton sur la liste) ; peut suivre US3 pour un CRUD complet

### Within Each User Story

- Client `admin.ts` avant la page qui l’appelle
- Page avant sa route dans `App.tsx`
- `stacks/new` avant `stacks/:id/edit`

### Parallel Opportunities

- T004 et T005 après T003
- T006, T008, T009 après T005 (T007 après T006)
- T010 et T011 en parallèle
- T022 et T023 en parallèle

---

## Parallel Example: User Story 1

```bash
# Après T005, en parallèle :
Task: "Page liste dans frontend/src/pages/admin/AdminStacksPage.tsx"
Task: "Lien nav dans frontend/src/pages/admin/AdminLayout.tsx"
Task: "Lien dashboard + total admin dans frontend/src/pages/admin/AdminPage.tsx"

# Puis :
Task: "Route stacks dans frontend/src/App.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 + 2 (`GET /admin/stacks` + 401)
2. Phase 3 (liste SPA)
3. **STOP** : vérifier US1 (quickstart §2 points 1–3)
4. Ensuite US2 → US3 → US4, une story à la fois

### Incremental Delivery

1. Setup + Foundational → API liste admin
2. US1 → démo liste
3. US2 → démo création
4. US3 → démo édition
5. US4 → démo suppression + cascade
6. Polish (README, format, graphify, quickstart)

### Parallel Team Strategy

Un seul contributeur prévu (pédagogie). Ne pas paralléliser les stories : `AdminStacksPage.tsx` et `admin.ts` sont partagés.

---

## Notes

- [P] = fichiers différents, pas de dépendance circulaire
- Pas de `useSession()` pour la garde ; pas de Prisma au client ; pas de champs slug/position dans le formulaire
- `GET()` liste **avant** `GET(':id')` sinon Nest avale la liste
- Hors périmètre : CRUD catégories/fiches, reorder, MDX
- Arrêter à chaque checkpoint pour valider la story
