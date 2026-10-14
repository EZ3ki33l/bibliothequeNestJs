/**
 * Avertissement **fixe** d'un laboratoire (spec 018, FR-009) : une seule
 * source, reprise par `LabWarning` et par le `LISEZMOI.txt` de l'archive. Il
 * n'est pas éditable : le contenu d'un laboratoire s'exécute sur la machine de
 * l'apprenant.
 */
export const LAB_WARNING_TITLE = 'À lire avant de lancer';

export const LAB_WARNING_LINES: readonly string[] = [
  'Ce laboratoire s’exécute sur la machine de l’apprenant, avec ses droits.',
  'Lire les fichiers avant de les lancer.',
  'Préférer une machine virtuelle ou un environnement dédié.',
  'Détruire le laboratoire après usage.',
];

export const LAB_SECURITY_LINES: readonly string[] = [
  'Ce laboratoire de sécurité doit rester isolé du réseau.',
  'Les outils de test ne s’utilisent que sur ses propres machines, dans le cadre légal.',
];
