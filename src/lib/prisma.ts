import 'server-only';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaAdapter: PrismaPg | undefined;
};

function readPositiveIntEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set.');
  }

  const maxConnections = readPositiveIntEnv('PRISMA_PG_POOL_MAX', 5);
  const idleTimeoutMs = readPositiveIntEnv('PRISMA_PG_IDLE_TIMEOUT_MS', 10_000);
  const connectionTimeoutMs = readPositiveIntEnv(
    'PRISMA_PG_CONNECTION_TIMEOUT_MS',
    10_000,
  );

  globalForPrisma.prismaAdapter ??= new PrismaPg({
    connectionString,
    connectionTimeoutMillis: connectionTimeoutMs,
    idleTimeoutMillis: idleTimeoutMs,
    max: maxConnections,
  });

  return new PrismaClient({
    adapter: globalForPrisma.prismaAdapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

function getPrismaClient() {
  globalForPrisma.prisma ??= createPrismaClient();
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    return Reflect.get(getPrismaClient(), property, receiver);
  },
});
