/**
 * Règles d'examen partagées par les examens (`QuizzesService`) et la
 * progression dans les parcours (`PathProgressService`).
 *
 * Elles vivent ici plutôt que dans `quizzes/` parce que deux domaines doivent
 * appliquer **exactement** le même seuil : si un parcours jugeait une fiche
 * « trop courte pour un examen » avec une autre valeur que l'écran d'examen,
 * une étape pourrait devenir impossible à valider.
 */

/**
 * Score minimal (sur 100) pour qu'un examen valide l'étape d'un parcours.
 * Un examen sous ce seuil reste enregistré, il ne valide simplement rien.
 */
export const PASSING_SCORE = 70;

/**
 * Longueur minimale du corps d'une fiche pour tenter une génération d'examen.
 *
 * En dessous, il n'y a pas de quoi poser quatre questions honnêtes : l'examen
 * répond « pas d'épreuve » au lieu de faire inventer un QCM, et un parcours
 * valide la fiche dès sa consultation.
 */
export const MIN_QUIZ_BODY_LENGTH = 80;

/**
 * Vrai si le corps de la fiche est assez long pour produire un examen.
 *
 * Les espaces de bord ne comptent pas : un corps fait de retours à la ligne
 * n'apprend rien de plus qu'un corps vide.
 */
export function isQuizEligible(body: string): boolean {
  return body.trim().length >= MIN_QUIZ_BODY_LENGTH;
}
