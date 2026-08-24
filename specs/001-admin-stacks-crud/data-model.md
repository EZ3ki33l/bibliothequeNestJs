# Data model: Écran admin des stacks

Aucun nouveau modèle Prisma. Feature = contrat HTTP + écrans SPA sur l’entité **Stack** existante.

## Stack (déjà en base)

| Champ | Rôle | Règle |
| --- | --- | --- |
| `id` | Identifiant interne (UUID) | Généré par Prisma. Params admin : `ParseUUIDPipe`. Invalide ou inconnu → 404, pas un autre stack. |
| `name` | Nom affiché | Création : obligatoire, min 2 caractères. Modification : optionnel, min 2 si présent. |
| `slug` | Identifiant public (catalogue) | Calculé par `slugify(name)` **côté serveur**. Unique. Collision → 409 « Ce slug est déjà utilisé ». Recalculé si `name` change. Jamais saisi par l’admin. |
| `description` | Texte libre | Optionnel. Défaut `""` à la création. |
| `position` | Ordre d’affichage | Max actuel + 1 **à la création seulement**. Jamais modifié par cette feature. |
| `createdAt` / `updatedAt` | Audit | Prisma. Pas exposés comme champs de formulaire. |
| `categories` | Enfants | `onDelete: Cascade` → catégories puis fiches. La confirmation UI est la seule protection. |

Relations (rappel) : Stack 1—n Category 1—n Entry.

## Liste paginée (objet de réponse, pas une table)

Pas une entité persistée. Forme renvoyée par `GET /admin/stacks` :

| Champ | Sens |
| --- | --- |
| `items` | Page courante de stacks (voir ci-dessous) |
| `total` | Nombre total de stacks (toutes pages) |
| `page` | Page demandée (≥ 1) |
| `limit` | Taille de page (1–50) |

Chaque élément de `items` :

| Champ | Sens |
| --- | --- |
| `id` | UUID |
| `name` | Nom |
| `slug` | Identifiant public |
| `description` | Description |
| `_count.categories` | Nombre de catégories (pour la liste admin) |

`select` Prisma explicite (pas le modèle brut « tout inclus »). Hors liste : `GET /admin/stacks/:id` peut rester le détail déjà renvoyé (id, name, slug, description, position, dates) — suffisant pour préremplir le formulaire.

## Validation (déjà portée par les DTO)

- **CreateStackDto** : `name` string min 2 ; `description` string optionnelle. Tout autre champ → 400 (`forbidNonWhitelisted`).
- **UpdateStackDto** : les deux champs optionnels ; `name` min 2 si présent.
- **ListStacksQueryDto** (à ajouter) : `page` entier ≥ 1, défaut 1 ; `limit` entier 1–50, défaut 50. `transform: true` sur le `ValidationPipe` global.

## Transitions

```text
[inexistant] --POST name(+description)--> Stack (slug + position calculés)
Stack --PATCH name et/ou description--> Stack (slug recalculé si name)
Stack --DELETE (après confirm UI)--> supprimé (+ cascade catégories/fiches)
```

Pas d’état « brouillon » sur le stack (contrairement aux fiches `published`).

## Acteurs (hors Prisma)

- **Administrateur** : session better-auth + ligne `Admin` (`userId`). Porte : `GET /admin/me` (SPA) et `SessionGuard` + `AdminGuard` (API).
- **Catalogue public** : lecteurs de `GET /stacks` ; pas d’écriture. Se met à jour parce que c’est la même table, pas via un cache à invalider (pas de `revalidatePath` Next).
