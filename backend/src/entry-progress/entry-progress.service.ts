import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PASSING_SCORE } from '../common/quiz-eligibility';
import { isUniqueConstraintError } from '../common/prisma-errors';
import type { SessionUser } from '../auth/authed-request';
import { EntryAccessService } from '../entry-access/entry-access.service';

/** Repères d'une fiche pour le compte connecté. Rien de tout cela n'est stocké tel quel. */
export type EntryStateItem = {
  entryId: string;
  /** Une trace de lecture existe. */
  read: boolean;
  /** Meilleur score des examens terminés, `null` s'il n'y en a pas. */
  bestScore: number | null;
  /** `bestScore` atteint le seuil de réussite. */
  passed: boolean;
  favorite: boolean;
};

/**
 * Ce qu'un compte a fait d'une fiche : l'avoir lue, en avoir passé l'examen,
 * l'avoir mise en favori.
 *
 * Une seule écriture, la **trace de lecture** (`EntryRead`). Tout le reste se
 * **déduit** à la lecture des tables qui existent déjà (`QuizAttempt`,
 * `Favorite`) : pas de seconde source de vérité à tenir synchronisée.
 *
 * Toutes les méthodes prennent `userId` en premier paramètre, il vient toujours
 * de la session et figure dans chaque `where` qui lit une donnée de compte : les
 * repères d'un compte ne sont jamais lisibles depuis un autre (IDOR).
 */
@Injectable()
export class EntryProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entryAccess: EntryAccessService,
  ) {}

  /**
   * Enregistre que le compte a lu la fiche. Idempotent.
   *
   * Fiche inconnue et fiche non publiée donnent le **même** 404 : la réponse ne
   * confirme pas qu'un brouillon existe sous cet identifiant.
   *
   * 403 si le compte n'a pas le droit de lire la fiche (réservée, adresse non
   * vérifiée) : la trace valide les étapes de parcours qui n'ont pas d'examen,
   * donc ouvrir la page floutée d'une fiche ne doit pas la compter comme lue.
   * Le contrôle passe après le 404, avant toute écriture. C'est pour lui que la
   * méthode reçoit l'utilisateur de la session et non son seul identifiant.
   *
   * `upsert` sur la clé `(userId, entryId)` : la première ouverture crée la
   * trace, les suivantes n'avancent que `lastReadAt`. Le `catch` couvre la
   * course entre deux requêtes simultanées : les deux voient « pas de trace »,
   * les deux insèrent, la seconde reçoit une violation d'unicité. La trace
   * existe, c'est le résultat voulu : ce n'est pas une erreur.
   */
  async markRead(user: SessionUser, entryId: string): Promise<void> {
    const userId = user.id;
    const entry = await this.prisma.entry.findFirst({
      where: { id: entryId, published: true },
      select: { id: true },
    });

    if (!entry) {
      throw new NotFoundException();
    }

    await this.entryAccess.assertReadable(entry.id, user.emailVerified);

    const now = new Date();

    try {
      await this.prisma.entryRead.upsert({
        where: { userId_entryId: { userId, entryId } },
        create: { userId, entryId, createdAt: now, lastReadAt: now },
        update: { lastReadAt: now },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return;
      }
      throw error;
    }
  }

  /**
   * Repères du compte pour une liste de fiches.
   *
   * La première requête garde les fiches **publiées** de la liste : un
   * identifiant inconnu ou celui d'un brouillon est omis sans erreur, ce qui
   * évite de confirmer l'existence d'un brouillon à qui en devinerait
   * l'identifiant. Les trois lectures suivantes ne portent que sur ces fiches,
   * et toutes sur `userId`.
   *
   * `groupBy` + `_max` laisse la base calculer le meilleur score ; `score:
   * { not: null }` écarte les examens en cours, qui n'ont pas encore de score.
   *
   * `passingScore` part dans la réponse : le navigateur n'a pas à recopier le
   * seuil, il ne peut donc pas en afficher un autre que celui qui valide.
   */
  async findStates(userId: string, entryIds: string[]) {
    const published = await this.prisma.entry.findMany({
      where: { id: { in: [...new Set(entryIds)] }, published: true },
      select: { id: true },
    });
    const ids = published.map((entry) => entry.id);

    if (ids.length === 0) {
      return { passingScore: PASSING_SCORE, items: [] as EntryStateItem[] };
    }

    const [reads, best, favorites] = await Promise.all([
      this.prisma.entryRead.findMany({
        where: { userId, entryId: { in: ids } },
        select: { entryId: true },
      }),
      this.prisma.quizAttempt.groupBy({
        by: ['entryId'],
        where: { userId, entryId: { in: ids }, score: { not: null } },
        _max: { score: true },
      }),
      this.prisma.favorite.findMany({
        where: { userId, entryId: { in: ids } },
        select: { entryId: true },
      }),
    ]);

    const readIds = new Set(reads.map((read) => read.entryId));
    const favoriteIds = new Set(favorites.map((favorite) => favorite.entryId));
    const bestById = new Map(best.map((group) => [group.entryId, group._max.score]));

    const items: EntryStateItem[] = ids.map((entryId) => {
      const bestScore = bestById.get(entryId) ?? null;

      return {
        entryId,
        read: readIds.has(entryId),
        bestScore,
        passed: bestScore !== null && bestScore >= PASSING_SCORE,
        favorite: favoriteIds.has(entryId),
      };
    });

    return { passingScore: PASSING_SCORE, items };
  }
}
