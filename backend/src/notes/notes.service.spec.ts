import { Test } from '@nestjs/testing';
import { NotesService } from './notes.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';

describe('NotesService', () => {
  let service: NotesService;
  let prisma: {
    note: {
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      deleteMany: jest.Mock;
    };
    entry: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      note: {
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      entry: {
        findFirst: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [NotesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(NotesService);
  });

  describe('findMany', () => {
    it('filtre par userId et ne renvoie que les fiches publiées', async () => {
      prisma.note.findMany.mockResolvedValue([]);
      prisma.note.count.mockResolvedValue(0);

      await service.findMany('user-1', { page: 1, limit: 50 });

      expect(prisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', entry: { published: true } },
        }),
      );
    });

    it('ajoute le filtre entryId quand il est fourni', async () => {
      prisma.note.findMany.mockResolvedValue([]);
      prisma.note.count.mockResolvedValue(0);

      await service.findMany('user-1', { page: 1, limit: 50, entryId: 'entry-1' });

      expect(prisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', entry: { published: true }, entryId: 'entry-1' },
        }),
      );
    });

    it('trie par updatedAt décroissant', async () => {
      prisma.note.findMany.mockResolvedValue([]);
      prisma.note.count.mockResolvedValue(0);

      await service.findMany('user-1', { page: 1, limit: 50 });

      expect(prisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { updatedAt: 'desc' } }),
      );
    });

    it('applique la pagination et retourne { items, total, page, limit }', async () => {
      const note = {
        id: 'note-1',
        content: "Piège : useState ne fusionne pas l'objet.",
        updatedAt: new Date('2026-09-12T09:30:00.000Z'),
        entry: { id: 'entry-1', title: 'useState', slug: 'use-state' },
      };
      prisma.note.findMany.mockResolvedValue([note]);
      prisma.note.count.mockResolvedValue(1);

      const result = await service.findMany('user-1', { page: 2, limit: 10 });

      expect(prisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
      expect(result).toEqual({ items: [note], total: 1, page: 2, limit: 10 });
    });

    it('ne sélectionne jamais bodyMdx, quizQuestions ni userId sur la fiche imbriquée', async () => {
      prisma.note.findMany.mockResolvedValue([]);
      prisma.note.count.mockResolvedValue(0);

      await service.findMany('user-1', { page: 1, limit: 50 });

      const call = prisma.note.findMany.mock.calls[0][0] as {
        select: { userId?: boolean; entry: { select: Record<string, unknown> } };
      };
      expect(call.select.userId).toBeUndefined();
      expect(call.select.entry.select.bodyMdx).toBeUndefined();
      expect(call.select.entry.select.quizQuestions).toBeUndefined();
    });

    it('renvoie une liste vide sans erreur si aucune note ne correspond', async () => {
      prisma.note.findMany.mockResolvedValue([]);
      prisma.note.count.mockResolvedValue(0);

      const result = await service.findMany('user-1', { page: 1, limit: 50 });

      expect(result).toEqual({ items: [], total: 0, page: 1, limit: 50 });
    });
  });
  function knownRequestError(code: string) {
    return new Prisma.PrismaClientKnownRequestError('conflict', {
      code,
      clientVersion: 'test',
    });
  }

  describe('save', () => {
    it('supprime la note existante quand le contenu est vide après trim, sans vérifier la fiche', async () => {
      prisma.note.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.save('user-1', 'entry-1', '   ');

      expect(prisma.entry.findFirst).not.toHaveBeenCalled();
      expect(prisma.note.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', entryId: 'entry-1' },
      });
      expect(result).toBeNull();
    });

    it("ne crée rien si le contenu est vide et qu'aucune note n'existait", async () => {
      prisma.note.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.save('user-1', 'entry-1', '');

      expect(result).toBeNull();
      expect(prisma.note.create).not.toHaveBeenCalled();
    });

    it('refuse une fiche brouillon ou inconnue avec un contenu non vide', async () => {
      prisma.entry.findFirst.mockResolvedValue(null);

      await expect(service.save('user-1', 'entry-1', 'un texte')).rejects.toThrow();
      expect(prisma.note.create).not.toHaveBeenCalled();
    });

    it('crée la note sur une fiche publiée sans note existante', async () => {
      prisma.entry.findFirst.mockResolvedValue({ id: 'entry-1' });
      prisma.note.create.mockResolvedValue({
        id: 'note-1',
        entryId: 'entry-1',
        content: 'un texte',
        updatedAt: new Date(),
      });

      const result = await service.save('user-1', 'entry-1', '  un texte  ');

      expect(prisma.note.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { userId: 'user-1', entryId: 'entry-1', content: 'un texte' },
        }),
      );
      expect(result).toMatchObject({ created: true, content: 'un texte' });
    });

    it('remplace le contenu existant plutôt que de créer une deuxième ligne (course P2002)', async () => {
      prisma.entry.findFirst.mockResolvedValue({ id: 'entry-1' });
      prisma.note.create.mockRejectedValue(knownRequestError('P2002'));
      prisma.note.update.mockResolvedValue({
        id: 'note-1',
        entryId: 'entry-1',
        content: 'nouveau texte',
        updatedAt: new Date(),
      });

      const result = await service.save('user-1', 'entry-1', 'nouveau texte');

      expect(prisma.note.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_entryId: { userId: 'user-1', entryId: 'entry-1' } },
          data: { content: 'nouveau texte' },
        }),
      );
      expect(result).toMatchObject({ created: false, content: 'nouveau texte' });
    });

    it('propage une erreur Prisma qui ne relève pas d’un conflit d’unicité', async () => {
      prisma.entry.findFirst.mockResolvedValue({ id: 'entry-1' });
      prisma.note.create.mockRejectedValue(new Error('boom'));

      await expect(service.save('user-1', 'entry-1', 'texte')).rejects.toThrow('boom');
    });
  });
  describe('remove', () => {
    it('supprime la note du compte courant sur cette fiche', async () => {
      prisma.note.deleteMany.mockResolvedValue({ count: 1 });

      await service.remove('user-1', 'entry-1');

      expect(prisma.note.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', entryId: 'entry-1' },
      });
    });

    it("ne lève pas d'erreur si la note n'existait pas", async () => {
      prisma.note.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.remove('user-1', 'entry-1')).resolves.toBeUndefined();
    });
  });
});
