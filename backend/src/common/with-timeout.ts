/**
 * Sans délai maximum, une API muette bloquerait la requête HTTP jusqu'au
 * timeout du navigateur (le SDK Resend n'expose pas d'`AbortSignal`).
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Timeout')), ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
