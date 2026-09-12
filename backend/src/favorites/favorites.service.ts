import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { ENTRY_CARD_SELECT } from '../common/entry-card.select';
import { ListFavoritesQueryDto } from './dto/list-favorites-query.dto';
import { isUniqueConstraintError } from '../common/prisma-errors';

/**
 * Favoris : une fiche publiée qu'un utilisateur connecté a mise de côté.
 *
 * Toutes les méthodes prennent `userId` en premier paramètre et le placent
 * dans le `where` : un favori n'est jamais visible ni modifiable depuis le
 * compte d'un autre utilisateur.
 */
@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liste paginée des favoris du compte connecté, limitée aux fiches
   * publiées : une fiche dépubliée après avoir été mise de côté disparaît de
   * la liste sans supprimer la ligne (elle réapparaît si elle est republiée).
   *
   * `entryId` restreint la liste à 0 ou 1 élément : c'est ce que la fiche
   * utilise pour savoir si elle est déjà de côté, sans exposer de champ
   * `favorited` sur `GET /entries/:slug`.
   */
  async findMany(userId: string, dto: ListFavoritesQueryDto) {
    const { page, limit } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.FavoriteWhereInput = {
      userId,
      entry: { published: true },
    };

    if (dto.entryId) {
      where.entryId = dto.entryId;
    }

    const [items, total] = await Promise.all([
      this.prisma.favorite.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: { id: true, createdAt: true, entry: { select: ENTRY_CARD_SELECT } },
      }),
      this.prisma.favorite.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async create(userId: string, entryId: string) {
    const entry = await this.prisma.entry.findFirst({
      where: { id: entryId, published: true },
      select: { id: true },
    });
    if (!entry) throw new NotFoundException();

    const select = { id: true, entryId: true, createdAt: true };
    try {
      const favorite = await this.prisma.favorite.create({ data: { userId, entryId }, select });
      return { ...favorite, created: true };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const favorite = await this.prisma.favorite.findUniqueOrThrow({
          where: { userId_entryId: { userId, entryId } },
          select,
        });
        return { ...favorite, created: false };
      }
      throw error;
    }
  }

  /**
   * Retire un favori. Toujours un succès, que la ligne existe ou non : un
   * deuxième retrait (double clic, onglet dupliqué) ne doit jamais renvoyer
   * une erreur — seul l'état final (« pas de côté ») compte pour le client.
   *
   * `deleteMany` (plutôt que `delete`) accepte un `where` qui ne correspond à
   * aucune ligne sans lever d'exception ; `userId` dans ce `where` est ce qui
   * empêche un compte de retirer le favori d'un autre (IDOR).
   */
  async remove(userId: string, entryId: string): Promise<void> {
    await this.prisma.favorite.deleteMany({ where: { userId, entryId } });
  }
}
