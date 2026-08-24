<!--
Sync Impact Report
- Version change: (template placeholders) → 1.0.0
- Modified principles:
  - [PRINCIPLE_1_NAME] → I. Conventions d'équipe dès le premier jour
  - [PRINCIPLE_2_NAME] → II. Sécurité d'abord (NON-NÉGOCIABLE)
  - [PRINCIPLE_3_NAME] → III. Frontière backend / frontend
  - [PRINCIPLE_4_NAME] → IV. Simplicité jusqu'à preuve du besoin
  - [PRINCIPLE_5_NAME] → V. Contrats HTTP explicites
- Added sections:
  - Architecture et stack
  - Workflow pédagogique
  - Governance (ratification initiale)
- Removed sections: none (scaffold placeholders replaced)
- Follow-up TODOs: none
-->

# Constitution Bibliothèque

## Core Principles

### I. Conventions d'équipe dès le premier jour

Chaque feature MUST suivre les conventions NestJS officielles et les
pratiques d'équipe, pas un NestJS « simplifié » à réécrire plus tard.
Un raccourci Express, `process.env` lu à la volée, ou `console.log` n'est
pas un livrable : MUST utiliser l'équivalent professionnel
(`ConfigModule`, `Logger`) et expliquer pourquoi.

Les fichiers d'un domaine MUST rester distincts et nommés selon leur rôle :

- **module** : déclare le périmètre et câble les providers
- **controller** : expose les routes HTTP, reste mince
- **service** : porte la logique métier et Prisma
- **DTO** : décrit et valide le contrat d'entrée (`class-validator`)

Rationale : l'utilisateur apprend NestJS ; le code produit est le modèle.
Un code « assez bon pour un débutant » qui n'est pas maintenable ou pas
sûr viole cette constitution.

### II. Sécurité d'abord (NON-NÉGOCIABLE)

Chaque feature MUST inclure son contrôle de sécurité dans le même
changement. En cas de doute : refuser (fail closed), puis expliquer le
risque en une phrase (OWASP).

MUST :

- valider les entrées avec un DTO + `ValidationPipe` global
  (`whitelist`, `forbidNonWhitelisted`, `transform`) — jamais `@Body() any`
- hasher les mots de passe avec Argon2id (jamais clair, MD5, SHA)
- ne jamais renvoyer `password`, hash ou tokens ; `select` Prisma
  explicite ou DTO de réponse
- garder les secrets dans `ConfigModule` ; jamais commités, jamais logués
- distinguer authentification et autorisation : guard par défaut,
  `@Public()` en exception
- vérifier l'appartenance ou le rôle (anti-IDOR), pas seulement un UUID
  valide
- Prisma paramétré ; `$queryRawUnsafe` avec interpolation est interdit

Socle `main.ts` (ordre) : `helmet()` en premier, puis CORS (origines
explicites — jamais `origin: '*'` avec `credentials: true`), throttler
(plus strict sur login / register), taille de body limitée, pagination
des listes. En production : ne pas renvoyer les stack traces au client.

Rationale : un contrôle « pour plus tard » n'arrive souvent jamais, et
apprend un anti-pattern.

### III. Frontière backend / frontend

Le dépôt est **deux applications**, pas un workspace pnpm racine.

- `backend/` : NestJS 11, Prisma 7, PostgreSQL. Prisma MUST rester
  uniquement ici (client généré dans `backend/src/generated`, gitignoré).
- `frontend/` : SPA Vite + React 19. MUST appeler l'API via
  `VITE_API_URL`, `apiFetch` et `credentials: 'include'`. Prisma côté
  client est interdit.

Les lectures publiques et les écritures admin MUST être des contrôleurs
distincts : `*.controller.ts` pour le public, `admin-*.controller.ts`
sous `/admin/...`. Le slug et `position` MUST être calculés côté serveur
(`position` à la création seulement). Le slug d'une fiche (entry) MUST
être unique globalement.

Frontend : pages dans `frontend/src/pages/` ; `App.tsx` est la table de
routes ; layouts imbriqués avec `<Outlet />`. MUST NOT calquer l'App
Router Next.js (`src/app/.../page.tsx`) ni brancher React Router
framework / SSR. La garde admin SPA MUST passer par `GET /admin/me`
(401 → `/login`, 403 → refus), jamais `useSession()`.

Rationale : la frontière HTTP est le contrat d'apprentissage ; la
mélanger (Prisma au client, admin et public dans la même route) casse
à la fois la sécu et le modèle mental NestJS.

### IV. Simplicité jusqu'à preuve du besoin

MUST NOT introduire CQRS, microservices, Event Sourcing, ni une
abstraction « au cas où », tant que le besoin n'est pas réel et
documenté. Une feature MUST tenir dans le domaine existant
(stacks, categories, entries) ou justifier un nouveau module importé
dans `AppModule`.

YAGNI : pas de couche supplémentaire entre controller et Prisma si le
service suffit. Complexity MUST être justifiée dans la spec ou le plan
avant d'être codée.

Rationale : chaque couche de plus est un concept de plus à enseigner et
à maintenir. La simplicité est un principe pédagogique, pas un
raccourci de qualité.

### V. Contrats HTTP explicites

Toute entrée HTTP MUST être un DTO `class-validator` (pas Zod, pas le
body brut). Toute liste MUST être paginée. Les 404 métier côté catalogue
frontend MUST se traduire en `null` (pas une exception non gérée).

Les routes navigateur et les routes API MUST rester cohérentes avec le
README :

- navigateur catégorie : `/stacks/:stackSlug/:categorySlug`
- API catégorie : `GET /stacks/:stackSlug/categories/:categorySlug`

Un changement de contrat (forme JSON, code HTTP, auth requise) MUST
être visible dans la spec et, pour les chemins authz (401 / 403 / rôle
admin), couvert par un test.

Rationale : le DTO est le contrat enseigné ; sans lui, NestJS redevient
Express avec des décorateurs.

## Architecture et stack

Stack figée jusqu'à amendement de cette constitution :

| Côté | Technologie | Contrainte |
| --- | --- | --- |
| API | NestJS 11 | un dossier = un domaine (module, controller, service, `dto/`) |
| Données | Prisma 7 + PostgreSQL | `@prisma/adapter-pg` ; pas de SQL interpolé |
| Auth | better-auth | montée dans `main.ts` (`toNodeHandler` `/api/auth`) + `SessionGuard` / `AdminGuard` ; pas d'`AuthModule` |
| Admin | `ADMIN_EMAIL` + seed | inscription puis `pnpm db:seed` ; pas un flag better-auth |
| SPA | Vite + React 19 | `frontend/src/pages/` ; better-auth client même série 1.7.x que le backend |
| Validation | `class-validator` | DTOs Nest uniquement |
| Formatage | Prettier | `editor.formatOnSave` ; scripts `pnpm format` dans `backend/` et `frontend/` |
| Paquets | pnpm 11 | commandes dans `backend/` ou `frontend/` ; overrides dans `backend/pnpm-workspace.yaml` |

MDX / Sandpack pour `bodyMdx` est prévu et **pas encore branché**.
Tant que ce n'est pas spécifié et implémenté, l'affichage en `<pre>`
est le comportement attendu, pas une dette à « corriger au passage ».

Secrets et origines : `FRONTEND_ORIGIN` (défaut `http://localhost:5173`)
avec `credentials: true`. Fichiers `.env` MUST rester gitignorés.

## Workflow pédagogique

Ce dépôt sert d'apprentissage NestJS. Le flux Spec Kit
(specify → plan → tasks → implement) MUST respecter :

1. **Une idée principale à la fois.** Une spec, un plan ou une
   explication NestJS MUST porter un concept dominant. Les termes NestJS
   (module, controller, provider, DTO, décorateur, injection de
   dépendances) MUST être définis à leur premier usage dans les specs
   et le code commenté.
2. **Pourquoi avant comment.** Le plan MUST dire le rôle de chaque
   fichier avant d'enchaîner les diffs.
3. **L'utilisateur code souvent lui-même.** Une demande d'apprentissage
   MUST guider d'abord, puis proposer **une** prochaine étape — pas
   générer tous les fichiers d'un coup.
4. **Langue.** Specs, plans, tasks et constitution MUST rester en
   français.
5. **Vérification UI.** Un changement visible (layout, route, état
   client, données rendues) MUST être vérifié dans le navigateur (ou
   équivalent : curl / tests) avant d'être déclaré terminé. Un screenshot
   d'un seul rendu ne suffit pas.
6. **Graphify.** Après modification de code applicatif, `graphify update .`
   MUST être exécuté. Pour une question de codebase, interroger le graphe
   (`graphify query` / `path` / `explain`) avant un parcours source large.

En mode conseil uniquement : MUST NOT proposer de passer en Agent mode.

## Governance

Cette constitution prime sur les raccourcis locaux, les habitudes Next.js
du projet source `bibliotheque/`, et toute suggestion d'agent qui la
contredit. Les règles runtime complémentaires sont
`.cursor/rules/professeur-nestjs.mdc`, `.cursor/rules/securite-nestjs.mdc`
et `AGENTS.md` ; en cas de conflit avec une pratique non documentée, la
constitution gagne.

Amendements :

- MUST passer par `/speckit-constitution` (ou PR équivalente) avec
  version, date, et Sync Impact Report
- MUST NOT être faits « en passant » dans une feature spec
- Un principe retiré ou redéfini de façon incompatible = MAJOR
- Un principe ou une section ajouté = MINOR
- Clarification, typo, précision non sémantique = PATCH

Conformité :

- Toute spec (`/speckit-specify`) et tout plan (`/speckit-plan`) MUST
  être relus contre les cinq principes
- Un plan qui introduit CQRS, un client Prisma frontend, un body non
  validé, ou une route admin sans guard MUST être rejeté
- La complexité non justifiée MUST être simplifiée avant `/speckit-implement`

Versioning : `MAJOR.MINOR.PATCH` comme ci-dessus. La date de
ratification ne change pas ; seule `Last Amended` avance à chaque
écriture.

**Version**: 1.0.0 | **Ratified**: 2026-08-23 | **Last Amended**: 2026-08-23
