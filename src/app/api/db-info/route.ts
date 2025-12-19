import { NextResponse } from 'next/server';
import { query, queryOne, isDbEnabled } from '@/lib/db';

export async function GET() {
  if (!isDbEnabled) {
    return NextResponse.json({ success: false, error: 'DB disabled (no DATABASE_URL)' }, { status: 503 });
  }

  try {
    const info = await queryOne<{
      db: string;
      usr: string;
      schema: string;
      host: string | null;
      port: number | null;
      now: Date;
    }>(`
      SELECT current_database() as db,
             current_user as usr,
             current_schema() as schema,
             inet_server_addr()::text as host,
             inet_server_port() as port,
             now() as now
    `);

    const [cr, ar, ta] = await Promise.all([
      queryOne<{ min: Date | null; max: Date | null; cnt: string }>(
        'SELECT MIN("timestamp") as min, MAX("timestamp") as max, COUNT(*) as cnt FROM "CrawlResult"'
      ),
      queryOne<{ min: Date | null; max: Date | null; cnt: string }>(
        'SELECT MIN("timestamp") as min, MAX("timestamp") as max, COUNT(*) as cnt FROM "AnalysisResult"'
      ),
      queryOne<{ min: Date | null; max: Date | null; cnt: string }>(
        'SELECT MIN("timestamp") as min, MAX("timestamp") as max, COUNT(*) as cnt FROM "TrendAnalysis"'
      )
    ]);

    // Ensure values are JSON-serializable
    const safe = (v: unknown): unknown => {
      if (typeof v === 'bigint') return Number(v);
      if (v instanceof Date) return v.toISOString();
      if (Array.isArray(v)) return v.map(safe);
      if (v && typeof v === 'object') {
        const o: Record<string, unknown> = {};
        for (const [k, val] of Object.entries(v)) o[k] = safe(val);
        return o;
      }
      return v;
    };

    return NextResponse.json(safe({
      success: true,
      env: {
        DATABASE_URL_set: !!process.env.DATABASE_URL,
        DIRECT_URL_set: !!process.env.DIRECT_URL,
        NEON_ONLY: process.env.NEON_ONLY !== 'false'
      },
      info: {
        ...info,
        envHost: (() => {
          try {
            return process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : null;
          } catch {
            return null;
          }
        })()
      },
      tables: {
        CrawlResult: { ...cr, cnt: Number(cr?.cnt || 0) },
        AnalysisResult: { ...ar, cnt: Number(ar?.cnt || 0) },
        TrendAnalysis: { ...ta, cnt: Number(ta?.cnt || 0) }
      }
    }));
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ success: false, error: err?.message || 'DB info failed' }, { status: 500 });
  }
}
