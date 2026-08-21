import { betterAuth } from 'better-auth';
import { PrismaClient } from '../generated/prisma/client';
import { prismaAdapter } from 'better-auth/adapters/prisma';

export function buildAuth(prisma: PrismaClient) {
  return betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'],
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    emailAndPassword: { enabled: true },
    session: {
      cookieCache: { enabled: false },
    },
  });
}
