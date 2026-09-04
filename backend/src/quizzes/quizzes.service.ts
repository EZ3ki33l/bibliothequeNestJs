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
        bodyMdx: true,
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

    if (entry.bodyMdx.trim().length < 80) {
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
      questions: toRecapQuestions(questions, answers),
      entry: {
        title: attempt.entry.title,
        slug: attempt.entry.slug,
        summary: attempt.entry.summary,
      },
    };
  }
}
