import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const isDbEnabled = !!process.env.DATABASE_URL;

function createPrismaStub() {
  const empty = async () => [] as any[];
  const emptyObj = async () => ({}) as any;
  return {
    crawlResult: { findMany: empty },
    analysisResult: { findMany: empty },
    trendAnalysis: { findMany: empty },
    historicalData: { findMany: empty, create: emptyObj },
    $disconnect: async () => {},
    $connect: async () => {},
  } as unknown as PrismaClient;
}

const client = isDbEnabled ? (globalForPrisma.prisma ?? new PrismaClient()) : createPrismaStub();

export const prisma = client;

if (process.env.NODE_ENV !== 'production' && isDbEnabled) {
  globalForPrisma.prisma = client as PrismaClient;
}

if (!isDbEnabled) {
  console.warn('[DB] DATABASE_URL not set; running in no-DB mode (API returns empty data).');
}
