import { withTimeout } from './with-timeout';

describe('withTimeout', () => {
  afterEach(() => jest.useRealTimers());

  it('renvoie la valeur d’une promesse qui se résout à temps', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000)).resolves.toBe('ok');
  });

  it('rejette quand le délai est dépassé', async () => {
    jest.useFakeTimers();
    const pending = withTimeout(new Promise<never>(() => undefined), 1000);
    const assertion = expect(pending).rejects.toThrow('Timeout');

    await jest.advanceTimersByTimeAsync(1000);

    await assertion;
  });

  it('propage le rejet de la promesse d’origine', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000)).rejects.toThrow('boom');
  });
});
