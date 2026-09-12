import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { ENTRY_CARD_SELECT } from '../common/entry-card.select';
import { isUniqueConstraintError } from '../common/prisma-errors';
import { ListNotesQueryDto } from './dto/list-notes-query.dto';

const NOTE_SELECT = { id: true, entryId: true, content: true, updatedAt: true };

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(userId: string, dto: ListNotesQueryDto) {
    const { page, limit } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.NoteWhereInput = {
      userId,
      entry: { published: true },
    };
    if (dto.entryId) where.entryId = dto.entryId;

    const [items, total] = await Promise.all([
      this.prisma.note.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          content: true,
          updatedAt: true,
          entry: { select: ENTRY_CARD_SELECT },
        },
      }),
      this.prisma.note.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  /**
   * Écrit une note : un texte vide (après trim) supprime la note existante
   * (ou ne fait rien s'il n'y en avait pas) plutôt que d'enregistrer une
   * ligne vide — un texte réduit à vide équivaut à « pas de note ».
   *
   * Sinon, `create` puis, en cas de conflit sur `(userId, entryId)`,
   * `update` : le contenu remplace toujours l'ancien, jamais de deuxième
   * ligne pour le même couple.
   */
  async save(userId: string, entryId: string, content: string) {
    const trimmed = content.trim();

    if (trimmed === '') {
      await this.prisma.note.deleteMany({ where: { userId, entryId } });
      return null;
    }

    const entry = await this.prisma.entry.findFirst({
      where: { id: entryId, published: true },
      select: { id: true },
    });
    if (!entry) throw new NotFoundException();

    try {
      const note = await this.prisma.note.create({
        data: { userId, entryId, content: trimmed },
        select: NOTE_SELECT,
      });
      return { ...note, created: true };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const note = await this.prisma.note.update({
          where: { userId_entryId: { userId, entryId } },
          data: { content: trimmed },
          select: NOTE_SELECT,
        });
        return { ...note, created: false };
      }
      throw error;
    }
  }

  async remove(userId: string, entryId: string): Promise<void> {
    await this.prisma.note.deleteMany({ where: { userId, entryId } });
  }
}
