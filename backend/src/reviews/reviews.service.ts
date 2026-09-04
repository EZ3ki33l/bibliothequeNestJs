import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReviewRating } from '../generated/prisma/enums';
import { scheduleReview } from '../common/schedule-review';
import { isUniqueConstraintError } from '../common/prisma-errors';

/**
 * Révision espacée (algorithme SM-2).
 *
 * Chaque fiche ouverte devient une *carte* (`ReviewCard`) portant sa date de
 * prochaine révision. Noter une carte recalcule cette date : bien répondu →
 * plus tard, mal répondu → tout de suite.
 *
 * Toutes les méthodes prennent `userId` en premier paramètre et le placent dans
 * le `where` : les cartes d'un utilisateur ne sont jamais visibles depuis le
 * compte d'un autre, même en connaissant l'identifiant d'une carte.
 */
@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Carte à réviser maintenant, plus le nombre total de cartes dues.
   *
   * On ne renvoie qu'une carte à la fois (`take: 1`) : l'écran de révision en
   * affiche une, et `remaining` sert à montrer la progression. Le tri par `id`
   * après `nextReviewAt` rend l'ordre stable quand deux cartes sont dues à la
   * même seconde.
   */
  async findDue(userId: string) {
    const dueWhere = {
      userId,
      // « Due » = date de révision atteinte ou dépassée.
      nextReviewAt: { lte: new Date() },
      // Une fiche dépubliée disparaît des révisions sans perdre l'historique.
      entry: { published: true },
    };

    const [cards, remaining] = await Promise.all([
      this.prisma.reviewCard.findMany({
        where: dueWhere,
        orderBy: [{ nextReviewAt: 'asc' }, { id: 'asc' }],
        take: 1,
        select: {
          id: true,
          nextReviewAt: true,
          entry: {
            select: {
              id: true,
              title: true,
              slug: true,
              summary: true,
              bodyMdx: true,
              kind: true,
            },
          },
        },
      }),
      this.prisma.reviewCard.count({ where: dueWhere }),
    ]);

    return { current: cards[0] ?? null, remaining };
  }

  /**
   * Inscrit une fiche au programme de révision, si elle n'y est pas déjà.
   *
   * `upsert` sur la clé `(userId, entryId)` rend l'opération idempotente :
   * ouvrir dix fois la même fiche ne réinitialise pas son calendrier, car
   * `update: {}` ne modifie rien. Le `catch` couvre la course entre deux
   * requêtes simultanées : les deux voient « pas de carte », les deux insèrent,
   * la seconde reçoit une violation d'unicité — la carte existe, c'est le
   * résultat voulu, on n'en fait pas une erreur.
   */
  async ensure(userId: string, entryId: string) {
    const entry = await this.prisma.entry.findFirst({
      where: { id: entryId, published: true },
      select: { id: true },
    });

    if (!entry) {
      throw new NotFoundException();
    }

    try {
      await this.prisma.reviewCard.upsert({
        where: { userId_entryId: { userId, entryId } },
        // Première révision due immédiatement.
        create: { userId, entryId, nextReviewAt: new Date() },
        update: {},
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return;
      }
      throw error;
    }
  }

  /**
   * Enregistre une note et replanifie la carte.
   *
   * Le `where` exige la carte **et** son propriétaire **et** qu'elle soit due :
   * une carte qui n'appartient pas à l'utilisateur donne 404, jamais 403 — on
   * ne confirme pas l'existence d'une ressource dont il n'a pas connaissance.
   *
   * Le calcul lui-même vit dans `scheduleReview` (fonction pure, sans base de
   * données) : c'est ce qui permet de tester le calendrier SM-2 directement.
   */
  async rate(userId: string, cardId: string, rating: ReviewRating) {
    const now = new Date();

    const card = await this.prisma.reviewCard.findFirst({
      where: {
        id: cardId,
        userId,
        nextReviewAt: { lte: now },
        entry: { published: true },
      },
    });

    if (!card) {
      throw new NotFoundException();
    }

    const scheduled = scheduleReview(card, rating, now);

    await this.prisma.reviewCard.update({
      where: { id: card.id },
      data: {
        easeFactor: scheduled.easeFactor,
        intervalDays: scheduled.intervalDays,
        repetitions: scheduled.repetitions,
        nextReviewAt: scheduled.nextReviewAt,
        lastReviewedAt: scheduled.lastReviewedAt,
      },
    });

    // Historique conservé même si la carte est replanifiée ou supprimée plus
    // tard : c'est la trace d'apprentissage.
    await this.prisma.reviewLog.create({
      data: { cardId: card.id, rating },
    });

    // Enchaîner sans aller-retour : le client reçoit directement la suivante.
    return this.findDue(userId);
  }
}
