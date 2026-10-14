import type { NextFunction, Request, Response } from 'express';

/**
 * Corps JSON au-delà de la limite (1 Mo pour une fiche, 100 Ko ailleurs) :
 * 413 au format de l'API, en français, au lieu de la réponse d'Express.
 * Toute autre erreur passe au gestionnaire suivant.
 */
export function payloadTooLargeHandler(
  error: { type?: string } | undefined,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (error?.type === 'entity.too.large') {
    res.status(413).json({ statusCode: 413, message: 'La requête dépasse la taille admise.' });
    return;
  }
  next(error);
}
