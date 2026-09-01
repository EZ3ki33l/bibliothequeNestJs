import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
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

type QuizEntryPublic = {
  title: string;
  slug: string;
  summary: string;
};

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

@Injectable()
export class QuizzesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(QUIZ_GENERATOR) private readonly generator: QuizGenerator,
  ) {}

  async start(userId: string, slug: string) {
    const entry = await this.prisma.entry.findFirst({
      where: { slug, published: true },
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        quizQuestions: true,
      },
    });

    if (!entry) {
      throw new NotFoundException();
    }

    const entryPublic: QuizEntryPublic = {
      title: entry.title,
      slug: entry.slug,
      summary: entry.summary,
    };

    const questions = parseQuizQuestions(entry.quizQuestions);
    if (!questions) {
      return { attempt: null, entry: entryPublic };
    }

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
      const snapshot = parseQuizQuestions(inProgress.questions) ?? questions;
      return {
        attempt: {
          id: inProgress.id,
          score: null,
          questions: toPublicQuestions(snapshot),
        },
        entry: entryPublic,
      };
    }
    const created = await this.prisma.quizAttempt.create({
      data: {
        userId,
        entryId: entry.id,
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

    if (!answersMatchSnapshot(questions, answers)) {
      throw new BadRequestException();
    }

    const scored = scoreQuiz(questions, answers);

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
      entry: {
        title: attempt.entry.title,
        slug: attempt.entry.slug,
        summary: attempt.entry.summary,
      },
    };
  }
}
