# Feature Specification: Écran admin des stacks

**Feature Branch**: `001-admin-stacks-crud`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "Ajouter un écran admin pour lister, créer, modifier et supprimer les stacks (SPA /admin/stacks, API admin déjà existante, session + rôle admin)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consulter la liste des stacks (Priority: P1)

Un administrateur ouvre l’espace d’administration, atteint l’écran des stacks (`/admin/stacks`) et voit tous les stacks existants (nom, identifiant public dérivé du nom, description, nombre de catégories). Il peut y arriver depuis le tableau de bord. Un visiteur sans session est renvoyé vers la connexion ; une personne connectée sans rôle administrateur voit un refus, sans accès aux données.

**Why this priority**: sans liste, l’administrateur ne sait pas ce qui existe déjà et ne peut enchaîner aucune autre action. C’est le plus petit livrable utile.

**Independent Test**: se connecter en administrateur, ouvrir `/admin/stacks`, vérifier que les stacks connus apparaissent ; répéter sans session et avec un compte non admin.

**Acceptance Scenarios**:

1. **Given** un administrateur authentifié et au moins un stack en base, **When** il ouvre `/admin/stacks`, **Then** la liste affiche chaque stack avec son nom, son identifiant public, sa description et le nombre de catégories.
2. **Given** un administrateur authentifié et aucun stack, **When** il ouvre `/admin/stacks`, **Then** un état vide explique qu’il n’y a pas encore de stack et propose de créer le premier.
3. **Given** un visiteur sans session, **When** il tente d’ouvrir `/admin/stacks`, **Then** il est renvoyé vers l’écran de connexion et aucune liste n’est affichée.
4. **Given** un utilisateur connecté sans rôle administrateur, **When** il tente d’ouvrir `/admin/stacks`, **Then** il voit un message de refus et aucune donnée de stack n’est exposée.
5. **Given** un administrateur sur le tableau de bord, **When** il suit le lien vers les stacks, **Then** il arrive sur `/admin/stacks`.

---

### User Story 2 - Créer un stack (Priority: P2)

Un administrateur lance la création depuis la liste, saisit un nom (obligatoire) et une description (facultative), enregistre, puis retrouve le nouveau stack dans la liste. L’identifiant public et l’ordre d’affichage sont calculés par le serveur ; l’administrateur ne les saisit pas. Le stack apparaît ensuite aussi dans le catalogue public.

**Why this priority**: c’est l’action qui ajoute de la valeur métier (nouveau thème dans la bibliothèque). Elle s’appuie sur la liste (P1) mais reste testable seule une fois le formulaire accessible.

**Independent Test**: depuis l’écran admin, créer un stack avec un nom inédit, vérifier qu’il apparaît dans la liste admin et dans le catalogue public.

**Acceptance Scenarios**:

1. **Given** un administrateur sur l’écran des stacks, **When** il ouvre la création, saisit un nom d’au moins 2 caractères et enregistre, **Then** le stack est créé, il est renvoyé vers la liste, et le nouveau stack y figure.
2. **Given** un administrateur sur le formulaire de création, **When** il laisse le nom vide ou trop court et tente d’enregistrer, **Then** l’enregistrement est refusé, un message d’erreur s’affiche, et aucun stack n’est créé.
3. **Given** un administrateur qui saisit un nom dont l’identifiant public collisionne avec un stack existant, **When** il enregistre, **Then** l’enregistrement est refusé avec un message compréhensible, sans quitter le formulaire.
4. **Given** un stack vient d’être créé avec succès, **When** un visiteur ouvre le catalogue public, **Then** le nouveau stack y est visible.

---

### User Story 3 - Modifier un stack (Priority: P3)

Un administrateur ouvre un stack existant depuis la liste, change le nom et/ou la description, enregistre, et voit les changements dans la liste admin et dans le catalogue public. Si le nom change, l’identifiant public est recalculé côté serveur.

**Why this priority**: corriger un nom ou une description est fréquent, mais secondaire par rapport à pouvoir voir et créer.

**Independent Test**: modifier le nom d’un stack existant et vérifier la mise à jour dans la liste admin et le catalogue public.

**Acceptance Scenarios**:

1. **Given** un administrateur et un stack existant, **When** il ouvre l’édition, le formulaire est prérempli avec le nom et la description actuels.
2. **Given** un administrateur sur le formulaire d’édition, **When** il change le nom et/ou la description et enregistre, **Then** les nouvelles valeurs apparaissent dans la liste et dans le catalogue public.
3. **Given** un administrateur qui enregistre un nom trop court ou un nom en collision, **When** la validation échoue, **Then** un message d’erreur s’affiche, le stack n’est pas modifié, et il reste sur le formulaire.
4. **Given** un administrateur qui suit un lien d’édition vers un stack inexistant (déjà supprimé), **When** l’écran s’ouvre, **Then** un message d’absence s’affiche et aucune modification n’est proposée.

---

### User Story 4 - Supprimer un stack (Priority: P4)

Un administrateur demande la suppression d’un stack depuis la liste. Le système exige une confirmation explicite et prévient que les catégories et fiches rattachées seront aussi supprimées. Après confirmation, le stack disparaît de l’admin et du catalogue public.

**Why this priority**: opération irréversible à fort impact ; elle vient après les flux de lecture et d’écriture non destructifs.

**Independent Test**: supprimer un stack (avec et sans contenu enfant) après confirmation, puis vérifier son absence partout ; annuler la confirmation et vérifier que rien n’a changé.

**Acceptance Scenarios**:

1. **Given** un administrateur sur la liste, **When** il demande la suppression d’un stack, **Then** une confirmation s’affiche avant toute suppression, en indiquant que les catégories et fiches liées seront aussi retirées.
2. **Given** la confirmation affichée, **When** l’administrateur annule, **Then** le stack et son contenu restent inchangés.
3. **Given** la confirmation affichée, **When** l’administrateur confirme, **Then** le stack disparaît de la liste admin et du catalogue public, ainsi que ses catégories et fiches.
4. **Given** un visiteur ou un utilisateur non admin, **When** il tente une suppression (URL directe ou appel équivalent), **Then** l’opération est refusée et aucune donnée n’est effacée.

---

### Edge Cases

- Liste vide : état vide + action pour créer le premier stack, pas une liste « cassée ».
- Liste trop longue : pagination ; l’administrateur peut parcourir tous les stacks.
- Nom trop court, champs inattendus, ou identifiant public déjà pris : refus avec message clair, sans perte du saisi.
- Suppression d’un stack qui a des catégories et des fiches : cascade après confirmation uniquement.
- Édition ou suppression d’un stack déjà disparu : message d’absence, pas d’écran technique.
- Session expirée pendant une action : même comportement que le reste de l’admin (retour connexion), aucune écriture partielle affichée comme réussie.
- Échec réseau ou serveur : message d’erreur lisible, possibilité de réessayer, pas de liste silencieuse.
- Accès concurrent : si un autre admin a déjà supprimé le stack, l’action en cours aboutit à « introuvable », pas à une fausse réussite.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système MUST exposer un écran d’administration des stacks à l’adresse navigateur `/admin/stacks`, protégé par la même règle que le reste de l’espace admin : session active **et** rôle administrateur.
- **FR-002**: Un visiteur sans session MUST être renvoyé vers la connexion. Un utilisateur connecté sans rôle administrateur MUST voir un refus, sans liste ni formulaire.
- **FR-003**: L’administrateur MUST pouvoir lister les stacks (nom, identifiant public, description, nombre de catégories), avec une liste **paginée**.
- **FR-004**: L’administrateur MUST pouvoir créer un stack en fournissant un nom (obligatoire, au moins 2 caractères) et une description (facultative). L’identifiant public et la position d’affichage MUST être calculés côté serveur ; ils ne sont pas saisis.
- **FR-005**: L’administrateur MUST pouvoir modifier le nom et/ou la description d’un stack existant. Un changement de nom MUST recalculer l’identifiant public côté serveur.
- **FR-006**: L’administrateur MUST pouvoir supprimer un stack. La suppression MUST exiger une confirmation explicite et MUST retirer aussi les catégories et fiches rattachées.
- **FR-007**: Les lectures et écritures de cet écran MUST passer par le contrat d’administration des stacks (distinct du catalogue public). Les opérations déjà disponibles (détail, création, modification, suppression) MUST être réutilisées ; si la **liste** admin manque, elle MUST être ajoutée, paginée, sous le même contrat d’administration.
- **FR-008**: Toute saisie MUST être validée avant écriture. Seuls le nom et la description sont acceptés ; tout autre champ MUST être rejeté. Un identifiant de stack inconnu ou invalide MUST produire une absence (pas la modification d’un autre stack).
- **FR-009**: Un identifiant public déjà utilisé MUST produire un conflit compréhensible pour l’administrateur, sans créer ni écraser un autre stack.
- **FR-010**: Après une création, modification ou suppression réussie, le catalogue public MUST refléter l’état à jour. Les routes publiques du catalogue ne changent pas.
- **FR-011**: Le tableau de bord admin MUST proposer un accès direct à `/admin/stacks`. La navigation de l’espace admin MUST inclure cet écran.
- **FR-012**: Les écrans de création et d’édition MUST afficher les erreurs de validation et d’échec sans perdre les valeurs saisies. Les états de chargement, d’erreur et d’absence MUST être explicites.
- **FR-013**: Les catégories, fiches, réordonnancement manuel des stacks, et l’édition manuelle de l’identifiant public ou de la position sont **hors périmètre**.

### Key Entities

- **Stack** : regroupement thématique du catalogue (ex. « React »). Attributs visibles ici : nom, identifiant public dérivé du nom, description, position d’affichage (serveur uniquement), nombre de catégories. Un stack contient des catégories, elles-mêmes des fiches.
- **Administrateur** : personne authentifiée dont le compte a le rôle admin. Seul cet acteur peut utiliser l’écran.
- **Catalogue public** : vue visitée par tout le monde ; elle affiche les stacks mais n’offre aucune écriture.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un administrateur crée un stack (nom + description facultative) et le revoit dans la liste en moins de 2 minutes, sans quitter l’espace admin.
- **SC-002**: 100 % des tentatives de liste, création, modification ou suppression sans session ou sans rôle admin sont refusées, et aucune donnée n’est créée, modifiée ou effacée.
- **SC-003**: Après une suppression confirmée, le stack et son contenu n’apparaissent plus ni dans l’admin ni dans le catalogue public.
- **SC-004**: 100 % des suppressions demandées passent par une confirmation explicite ; une annulation laisse les données intactes.
- **SC-005**: 100 % des refus de validation (nom trop court, identifiant public déjà pris) s’affichent sur le formulaire, sans navigation forcée vers une autre page.
- **SC-006**: Un administrateur confronté à une liste vide comprend qu’il n’y a pas de stack et peut enclencher la création du premier en une action.
- **SC-007**: Un administrateur réalise les quatre opérations (lister, créer, modifier, supprimer) sans outil externe : l’écran admin suffit.

## Assumptions

- L’espace admin (garde session + rôle, tableau de bord, layout) existe déjà et cet écran s’y ajoute ; on ne refait pas l’authentification.
- Le contrat d’administration des stacks (création, lecture d’un stack par identifiant, modification, suppression) existe déjà. Cette feature ajoute l’écran et, si besoin, **uniquement** la liste admin paginée manquante — pas un nouveau domaine.
- Les adresses navigateur suivent le style actuel (anglais) : `/admin/stacks` pour la liste, un écran dédié pour créer, un écran dédié pour modifier. La suppression se lance depuis la liste (confirmation sur place).
- L’identifiant public et la position restent calculés côté serveur (`position` à la création seulement), conformément à la constitution du projet.
- La suppression en cascade (catégories et fiches) est le comportement métier attendu ; la confirmation est la protection utilisateur, pas un refus automatique s’il reste du contenu.
- L’interface est en français, comme le reste de l’admin.
- Hors périmètre : CRUD catégories/fiches, réordonnancement, édition manuelle du slug ou de la position, MDX/Sandpack, changements du catalogue public autres que le reflet des données.
- Les listes restent limitées (pagination) ; on n’affiche pas un dump illimité.
