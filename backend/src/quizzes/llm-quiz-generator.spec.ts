import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { LlmQuizGenerator } from './llm-quiz-generator';

const apiKey = 'sk-test-secret-do-not-log';
const baseUrl = 'https://llm.test/v1';
const model = 'test-model';

const llmQuestions = [
  {
    id: 'from-the-model',
    prompt: 'À quoi sert useState ?',
    choices: ['Garder une valeur', 'Remplacer React', 'Appeler l’API'],
    correctIndex: 0,
  },
  {
    id: 'also-from-the-model',
    prompt: 'Comment mets-tu à jour un compteur ?',
    choices: ['setCount(count + 1)', 'setCount((c) => c + 1)', 'count = count + 1'],
    correctIndex: 1,
  },
];

const completion = {
  choices: [
    {
      message: {
        content: JSON.stringify({ questions: llmQuestions }),
      },
    },
  ],
};

function configOf(overrides: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    QUIZ_LLM_API_KEY: apiKey,
    QUIZ_LLM_BASE_URL: baseUrl,
    QUIZ_LLM_MODEL: model,
    ...overrides,
  };
  return {
    get: jest.fn((key: string) => values[key]),
  };
}

describe('LlmQuizGenerator', () => {
  let generator: LlmQuizGenerator;
  let fetchMock: jest.Mock;
  const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

  async function compile(config: ReturnType<typeof configOf>) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LlmQuizGenerator, { provide: ConfigService, useValue: config }],
    }).compile();
    return module.get(LlmQuizGenerator);
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
    generator = await compile(configOf());
  });

  it('returns parsed questions with server UUIDs when the JSON is valid', async () => {
    const uuidA = '11111111-1111-4111-8111-111111111111';
    const uuidB = '22222222-2222-4222-8222-222222222222';
    const uuidSpy = jest
      .spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce(uuidA)
      .mockReturnValueOnce(uuidB);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => completion,
    });

    await expect(
      generator.generate({
        title: 'useState',
        summary: 'État local',
        bodyMdx: 'Le hook useState garde une valeur entre les rendus.',
      }),
    ).resolves.toEqual([
      { ...llmQuestions[0], id: uuidA },
      { ...llmQuestions[1], id: uuidB },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${baseUrl}/chat/completions`);
    expect(uuidSpy).toHaveBeenCalledTimes(2);
  });

  it('returns null when the API key is missing and does not fetch', async () => {
    generator = await compile(configOf({ QUIZ_LLM_API_KEY: undefined }));

    await expect(
      generator.generate({ title: 't', summary: 's', bodyMdx: 'corps assez long' }),
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null on HTTP 500 without logging the API key', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    await expect(
      generator.generate({ title: 't', summary: 's', bodyMdx: 'corps' }),
    ).resolves.toBeNull();
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain(apiKey);
  });

  it('returns null on timeout', async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'TimeoutError' }));

    await expect(
      generator.generate({ title: 't', summary: 's', bodyMdx: 'corps' }),
    ).resolves.toBeNull();
  });

  it('returns null when the message JSON is broken', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{not-json' } }],
      }),
    });

    await expect(
      generator.generate({ title: 't', summary: 's', bodyMdx: 'corps' }),
    ).resolves.toBeNull();
  });
});
