import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { scoreQuiz } from '../common/score-quiz';
import {
  parseQuizQuestions,
  toPublicQuestions,
  QUIZ_GENERATOR,
  type QuizGenerator,
  type QuizQuestion,
} from './quiz-generator';

export type QuizAnswer = {
  questionId: string;
  choiceIndex: number;
};

/** Fiche telle qu'affichée sur l'écran d'examen (pas son corps entier). */
type QuizEntryPublic = {
  title: string;
  slug: string;
  summary: string;
};

/**
 * Longueur minimale du corps d'une fiche pour tenter une génération.
 *
 * En dessous, il n'y a pas de quoi poser quatre questions honnêtes : le service
 * répond « pas d'épreuve » (`attempt: null`) au lieu de faire inventer un QCM.
 */
const MIN_BODY_LENGTH = 80;

function toEntryPublic(entry: QuizEntryPublic): QuizEntryPublic {
  return { title: entry.title, slug: entry.slug, summary: entry.summary };
}

/**
 * Vérifie que les réponses reçues correspondent à l'instantané des questions.
 *
 * Le DTO a déjà validé la *forme* (tableau, entiers positifs). Ici on vérifie
 * la *cohérence* avec la tentative en base : une réponse par question, pas de
 * doublon, aucune question inconnue, et un index qui existe dans les
 * propositions de **cette** question.
 *
 * Ce contrôle fait doublon avec les garde-fous de `scoreQuiz`, et c'est
 * volontaire : ici un écart est une erreur du client (400, message clair) ;
 * là-bas, ce serait un bug de notre code (500). Les deux ne se traitent pas de
 * la même façon.
 */
function answersMatchSnapshot(questions: QuizQuestion[], answers: QuizAnswer[]): boolean {
  if (answers.length !== questions.length) {
    return false;
  }

  const seen = new Set<string>();
  const byId = new Map(questions.map((question) => [question.id, question]));

  for (const answer of answers) {
    if (seen.has(answer.questionId)) {
      return false;
    }
    seen.add(answer.questionId);

    const question = byId.get(answer.questionId);
    if (!question) {
      return false;
    }

    if (
      !Number.isInteger(answer.choiceIndex) ||
      answer.choiceIndex < 0 ||
      answer.choiceIndex >= question.choices.length
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Récapitulatif après correction : pour chaque question, le choix de
 * l'utilisateur et la bonne réponse.
 *
 * C'est le seul moment où `correctIndex` sort vers le client — l'examen est
 * terminé, la réponse ne peut plus être devinée à l'avance.
 */
function toRecapQuestions(questions: QuizQuestion[], answers: QuizAnswer[]) {
  const selectedById = new Map(answers.map((answer) => [answer.questionId, answer.choiceIndex]));

  return questions.map((question) => {
    const selectedIndex = selectedById.get(question.id);

    if (selectedIndex === undefined) {
      throw new BadRequestException();
    }

    return {
      id: question.id,
      prompt: question.prompt,
      choices: question.choices,
      selectedIndex,
      correctIndex: question.correctIndex,
      selectedChoice: question.choices[selectedIndex],
      correctChoice: question.choices[question.correctIndex],
    };
  });
}

/**
 * Examens : génération du QCM, puis correction.
 *
 * Le principe de la *tentative* (`QuizAttempt`) : au démarrage, les questions
 * générées sont figées en base avec leur bonne réponse. La correction relit cet
 * instantané au lieu de faire confiance à ce que renvoie le navigateur. Sans
 * lui, un client pourrait renvoyer ses propres questions… et son propre
 * corrigé.
 */
@Injectable()
export class QuizzesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(QUIZ_GENERATOR) private readonly generator: QuizGenerator,
  ) {}

  /**
   * Démarre une épreuve, ou reprend celle qui est en cours.
   *
   * Trois issues possibles :
   * - une tentative (nouvelle ou reprise) avec les questions **sans** les
   *   bonnes réponses ;
   * - `attempt: null` si la fiche est trop courte pour un QCM ;
   * - 503 si la génération échoue — aucune tentative n'est créée, l'utilisateur
   *   peut réessayer.
   */
  async start(userId: string, slug: string) {
    const entry = await this.prisma.entry.findFirst({
      // `published: true` : pas d'examen sur un brouillon.
      where: { slug, published: true },
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        bodyMdx: true,
      },
    });

    if (!entry) {
      throw new NotFoundException();
    }

    const entryPublic = toEntryPublic(entry);

    /**
     * Tentative en cours = créée mais pas encore corrigée (`answers` et `score`
     * vides). La reprendre évite qu'un rafraîchissement de page relance une
     * génération, donc un appel payant au modèle et un nouveau questionnaire.
     *
     * `Prisma.DbNull` désigne le `NULL` de la colonne JSON, à ne pas confondre
     * avec `JsonNull`, qui serait la valeur JSON `null` *stockée* dedans.
     */
    const inProgress = await this.prisma.quizAttempt.findFirst({
      where: {
        userId,
        entryId: entry.id,
        answers: { equals: Prisma.DbNull },
        score: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (inProgress) {
      // L'instantané est relu et revalidé : une colonne JSON n'offre aucune
      // garantie de forme (ancien format, écriture manuelle…).
      const snapshot = parseQuizQuestions(inProgress.questions);

      if (!snapshot) {
        throw new ServiceUnavailableException();
      }

      return {
        attempt: {
          id: inProgress.id,
          score: null,
          questions: toPublicQuestions(snapshot),
        },
        entry: entryPublic,
      };
    }

    if (entry.bodyMdx.trim().length < MIN_BODY_LENGTH) {
      return { attempt: null, entry: entryPublic };
    }

    let generated: QuizQuestion[] | null;
    try {
      generated = await this.generator.generate({
        title: entry.title,
        summary: entry.summary,
        bodyMdx: entry.bodyMdx,
      });
    } catch {
      // Le générateur ne devrait pas lever d'exception (il renvoie `null`),
      // mais on ferme la porte quand même plutôt que de laisser passer un 500.
      throw new ServiceUnavailableException();
    }

    const questions = parseQuizQuestions(generated);
    if (!questions) {
      throw new ServiceUnavailableException();
    }

    const created = await this.prisma.quizAttempt.create({
      data: {
        userId,
        entryId: entry.id,
        // Questions figées avec leur `correctIndex` : c'est le corrigé de
        // référence pour la correction à venir.
        questions,
      },
    });

    return {
      attempt: {
        id: created.id,
        score: null,
        questions: toPublicQuestions(questions),
      },
      entry: entryPublic,
    };
  }

  /**
   * Corrige une tentative et renvoie le score avec le récapitulatif.
   *
   * Le `where` porte à la fois sur l'id, sur `userId` et sur l'absence de
   * score : on ne corrige que sa propre tentative, et une seule fois. Une
   * tentative appartenant à un autre compte donne 404, pas 403 — inutile de
   * confirmer son existence.
   */
  async submit(userId: string, attemptId: string, answers: QuizAnswer[]) {
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: {
        id: attemptId,
        userId,
        answers: { equals: Prisma.DbNull },
        score: null,
        entry: { published: true },
      },
      select: {
        id: true,
        questions: true,
        entry: {
          select: {
            title: true,
            slug: true,
            summary: true,
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException();
    }

    const questions = parseQuizQuestions(attempt.questions);
    if (!questions) {
      throw new NotFoundException();
    }

    // Réponses incohérentes avec l'instantané : erreur du client, donc 400.
    if (!answersMatchSnapshot(questions, answers)) {
      throw new BadRequestException();
    }

    const scored = scoreQuiz(questions, answers);

    // Écrire `answers` et `score` clôt la tentative : elle ne sera plus
    // reprise par `start`, ni corrigée une seconde fois.
    await this.prisma.quizAttempt.update({
      where: { id: attempt.id },
      data: {
        answers,
        score: scored.score,
      },
    });

    return {
      id: attempt.id,
      score: scored.score,
      correctCount: scored.correctCount,
      total: scored.total,
      questions: toRecapQuestions(questions, answers),
      entry: toEntryPublic(attempt.entry),
    };
  }
}
