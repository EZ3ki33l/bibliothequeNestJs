# Contrat HTTP : admin stacks

Base API : `VITE_API_URL` (ex. `http://localhost:4000`). Cookie de session : `credentials: 'include'`.

Tous les chemins ci-dessous : `SessionGuard` puis `AdminGuard`.

| Code | Quand |
| --- | --- |
| 401 | Pas de session |
| 403 | Session mais pas de rôle admin |
| 400 | DTO / query invalide, champ extra |
| 404 | UUID inconnu (`ParseUUIDPipe` OK mais ligne absente) |
| 409 | Slug déjà pris |

## `GET /admin/stacks` *(nouveau)*

Liste paginée. **À déclarer avant** `GET /admin/stacks/:id`.

Query :

| Param | Défaut | Contrainte |
| --- | --- | --- |
| `page` | 1 | entier ≥ 1 |
| `limit` | 50 | entier 1–50 |

`200` :

```json
{
  "items": [
    {
      "id": "3f1c0a2e-4b8d-4c1a-9e2f-7a6b5c4d3e2f",
      "name": "React",
      "slug": "react",
      "description": "Bibliothèque UI",
      "_count": { "categories": 2 }
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50
}
```

Ordre : `position` asc, puis `name` asc.

## `GET /admin/stacks/:id` *(existant)*

`:id` = UUID. `200` : un stack (id, name, slug, description, position, dates). `404` si absent.

## `POST /admin/stacks` *(existant)*

Body (seuls champs autorisés) :

```json
{ "name": "Vue", "description": "optionnel" }
```

`201` : stack créé (`slug` et `position` calculés serveur). `400` / `409` sinon.

## `PATCH /admin/stacks/:id` *(existant)*

Body partiel : `name` et/ou `description`. `200` : stack mis à jour. `404` / `400` / `409` sinon. `position` inchangé.

## `DELETE /admin/stacks/:id` *(existant)*

`204` vide. Cascade catégories + fiches. `404` si déjà absent.

## Authz (tests minimaux)

Sans cookie :

- `GET /admin/stacks` → 401
- `POST /admin/stacks` → 401

Le catalogue public ne change pas : `GET /stacks`, `GET /stacks/:slug`.
