# Quickstart : valider l’écran admin des stacks

Preuve de bout en bout après implémentation. Détail des payloads : [contracts/admin-stacks.md](./contracts/admin-stacks.md). Modèle : [data-model.md](./data-model.md).

## Prérequis

- PostgreSQL, `backend/.env` et `frontend/.env` comme le README
- Un compte inscrit avec `ADMIN_EMAIL`, puis `pnpm db:seed` dans `backend/`
- API : `cd backend && pnpm start:dev` (port 4000)
- SPA : `cd frontend && pnpm dev` (port 5173)

## 1. Authz API (sans navigateur)

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/admin/stacks
# attendu : 401

curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:4000/admin/stacks \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test"}'
# attendu : 401
```

Le test automatisé du dépôt MUST couvrir au moins ces 401.

## 2. Parcours administrateur (navigateur)

1. Ouvrir `http://localhost:5173/login`, se connecter avec le compte admin.
2. Aller sur `/admin` : la carte (ou le lien) **Stacks** mène à `/admin/stacks`.
3. **Liste** : voir nom, slug, description, nombre de catégories — ou l’état vide avec un moyen de créer le premier.
4. **Créer** (`/admin/stacks/new`) : nom ≥ 2 caractères, description optionnelle → retour liste, le stack y est. Vérifier aussi `/stacks` (catalogue public).
5. **Valider** : nom trop court → message, on reste sur le formulaire. Nom qui produit un slug déjà pris → conflit, on reste sur le formulaire.
6. **Modifier** (`/admin/stacks/:id/edit`) : formulaire prérempli ; enregistrer ; liste et catalogue à jour. URL d’un id inexistant → message d’absence.
7. **Supprimer** depuis la liste : une confirmation mentionne catégories/fiches. Annuler → rien ne change. Confirmer → disparu de l’admin **et** de `/stacks`.
8. **Session** : autre onglet déconnecté, ou compte non admin → `/admin/stacks` renvoie vers `/login` (401) ou affiche le refus (403), sans liste.

## 3. Hors périmètre (ne pas tester ici)

CRUD catégories/fiches, réordonnancement, saisie manuelle du slug ou de la `position`, MDX.
