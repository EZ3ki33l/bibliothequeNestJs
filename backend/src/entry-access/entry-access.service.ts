import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { freeEntryIds, VERIFIED_EMAIL_REQUIRED } from '../common/free-access';
import {
  PUBLISHED_PATHS_WHERE,
  VISIBLE_STEP_WHERE,
} from '../learning-paths/learning-paths.service';

/** Accès d'une fiche publiée : `free` vrai = lisible sans compte. */
export type EntryAccessItem = { entryId: string; free: boolean };

/**
 * La règle d'accès aux fiches, en **un seul endroit**.
 *
 * Trois domaines la consultent (lecture d'une fiche, examens, trace de
 * lecture) : chacun appelle ce service, aucun ne recalcule « libre ou
 * réservée » de son côté. Quatre copies d'un contrôle de sécurité, ce serait
 * quatre occasions de les voir diverger.
 *
 * Le service charge les parcours publiés, puis laisse la décision à la
 * fonction pure `freeEntryIds` (`common/free-access.ts`). Aucun cache : la
 * règle est recalculée à chaque lecture, donc recomposer ou dépublier un
 * parcours s'applique à la requête suivante.
 *
 * **Une erreur de lecture remonte telle quelle.** Aucune méthode ne l'attrape
 * pour répondre « libre », et aucun appelant ne doit le faire : si le serveur
 * ne peut pas établir qu'une fiche est en accès libre, il ne la transmet pas.
 * Refuser dans le doute (fail closed) coûte une erreur 500 pendant une panne ;
 * l'inverse livrerait tout le catalogue à chaque défaillance de la base.
 */
@Injectable()
export class EntryAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Identifiants des fiches en accès libre.
   *
   * La requête reprend exactement le filtre de la page publique d'un parcours
   * (`PUBLISHED_PATHS_WHERE`, modules par `position`, `VISIBLE_STEP_WHERE`) :
   * le premier module que le visiteur voit est celui qu'il peut lire. Seul
   * `entryId` est sélectionné, la règle n'a besoin de rien d'autre.
   *
   * La lecture est bornée par les plafonds de composition des parcours
   * (30 modules, 200 étapes), posés à l'écriture.
   */
  async freeEntryIds(): Promise<Set<string>> {
    const paths = await this.prisma.learningPath.findMany({
      where: PUBLISHED_PATHS_WHERE,
      select: {
        modules: {
          orderBy: { position: 'asc' },
          select: {
            steps: { where: VISIBLE_STEP_WHERE, select: { entryId: true } },
          },
        },
      },
    });

    return freeEntryIds(paths);
  }

  /** La fiche se lit-elle sans compte ? */
  async isFree(entryId: string): Promise<boolean> {
    return (await this.freeEntryIds()).has(entryId);
  }

  /**
   * Refuse (403) quand ce lecteur n'a pas le droit de lire cette fiche.
   *
   * Une adresse vérifiée ouvre tout le catalogue : la règle des parcours n'est
   * même pas consultée. `=== true` et non une valeur « vraie » : un champ
   * absent, ou autre chose qu'un booléen, ne vaut jamais « vérifié ».
   *
   * 403 et non 404 : l'existence d'une fiche publiée est publique, il n'y a
   * rien à cacher, et l'écran doit pouvoir distinguer « adresse à vérifier »
   * de « fiche introuvable ». L'appelant a déjà écarté les brouillons (404).
   */
  async assertReadable(entryId: string, emailVerified: boolean): Promise<void> {
    if (emailVerified === true) {
      return;
    }

    if (!(await this.isFree(entryId))) {
      throw new ForbiddenException(VERIFIED_EMAIL_REQUIRED);
    }
  }

  /**
   * Accès d'une liste de fiches, pour les mentions des cartes.
   *
   * Seules les fiches **publiées** de la liste reçoivent une réponse : un
   * identifiant inconnu ou celui d'un brouillon est omis sans erreur, pour ne
   * pas confirmer qu'un brouillon existe sous cet identifiant.
   */
  async findAccess(entryIds: string[]): Promise<{ items: EntryAccessItem[] }> {
    const [published, free] = await Promise.all([
      this.prisma.entry.findMany({
        where: { id: { in: [...new Set(entryIds)] }, published: true },
        select: { id: true },
      }),
      this.freeEntryIds(),
    ]);

    return { items: published.map(({ id }) => ({ entryId: id, free: free.has(id) })) };
  }

  /** Nombre de fiches en accès libre : `0` signale un catalogue fermé aux visiteurs. */
  async summary(): Promise<{ freeEntryCount: number }> {
    return { freeEntryCount: (await this.freeEntryIds()).size };
  }
}
