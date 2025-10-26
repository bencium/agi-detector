import { NextResponse } from 'next/server';
import { prisma, isDbEnabled } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET() {
  if (!isDbEnabled) {
    return NextResponse.json({ success: false, error: 'DB disabled (no DATABASE_URL)' }, { status: 503 });
  }

  try {
    const [info] = await prisma.$queryRaw<Array<{
      db: string; usr: string; schema: string; host: string | null; port: number | null; now: Date;
    }>>(Prisma.sql`
      SELECT current_database() as db,
             current_user as usr,
             current_schema() as schema,
             inet_server_addr()::text as host,
             inet_server_port() as port,
             now() as now
    `);

    const [[cr], [ar], [ta]] = await Promise.all([
      prisma.$queryRaw<Array<{ min: Date | null; max: Date | null; cnt: number }>>(Prisma.sql`
        SELECT MIN("timestamp") as min, MAX("timestamp") as max, COUNT(*) as cnt FROM "CrawlResult"
      `),
      prisma.$queryRaw<Array<{ min: Date | null; max: Date | null; cnt: number }>>(Prisma.sql`
        SELECT MIN("timestamp") as min, MAX("timestamp") as max, COUNT(*) as cnt FROM "AnalysisResult"
      `),
      prisma.$queryRaw<Array<{ min: Date | null; max: Date | null; cnt: number }>>(Prisma.sql`
        SELECT MIN("timestamp") as min, MAX("timestamp") as max, COUNT(*) as cnt FROM "TrendAnalysis"
      `),
    ]);

    // Ensure BigInt values are JSON-serializable
    const safe = (v: any): any => {
      if (typeof v === 'bigint') return Number(v);
      if (v instanceof Date) return v.toISOString();
      if (Array.isArray(v)) return v.map(safe);
      if (v && typeof v === 'object') {
        const o: any = {};
        for (const [k, val] of Object.entries(v)) o[k] = safe(val as any);
        return o;
      }
      return v;
    };

    return NextResponse.json(safe({
      success: true,
      env: {
        DATABASE_URL_set: !!process.env.DATABASE_URL,
        DIRECT_URL_set: !!process.env.DIRECT_URL,
      },
      info,
      tables: {
        CrawlResult: cr,
        AnalysisResult: ar,
        TrendAnalysis: ta,
      },
    }));
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'DB info failed' }, { status: 500 });
  }
}
