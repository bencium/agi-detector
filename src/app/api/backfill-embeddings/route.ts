import { NextRequest, NextResponse } from 'next/server';
import { query, execute, isDbEnabled } from '@/lib/db';
import { generateEmbedding } from '@/lib/openai';
import { enforceRateLimit } from '@/lib/security/rateLimit';

interface AnalysisForEmbedding {
  id: string;
  title: string;
  content: string;
}

export async function POST(request: NextRequest) {
  if (!isDbEnabled) {
    return NextResponse.json({
      success: false,
      error: 'Database not configured'
    }, { status: 503 });
  }

  const limited = enforceRateLimit(request, { windowMs: 60_000, max: 1, keyPrefix: 'backfill-embeddings' });
  if (limited) return limited;

  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const batchSize = parseInt(searchParams.get('batch') || '5', 10);

  try {
    // Get analyses without embeddings
    const analyses = await query<AnalysisForEmbedding>(`
      SELECT ar.id, cr.title, cr.content
      FROM "AnalysisResult" ar
      JOIN "CrawlResult" cr ON ar."crawlId" = cr.id
      WHERE ar.embedding IS NULL
      ORDER BY ar.timestamp DESC
      LIMIT $1
    `, [limit]);

    if (analyses.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All analyses already have embeddings',
        data: { processed: 0, total: 0 }
      });
    }

    console.log(`[Backfill] Starting embedding generation for ${analyses.length} articles`);

    let processed = 0;
    let errors = 0;

    // Process in batches
    for (let i = 0; i < analyses.length; i += batchSize) {
      const batch = analyses.slice(i, i + batchSize);

      for (const analysis of batch) {
        try {
          const text = `${analysis.title}\n\n${analysis.content.slice(0, 7500)}`; // Leave room for title
          const embedding = await generateEmbedding(text);

          const embeddingStr = `[${embedding.join(',')}]`;
          await execute(
            `UPDATE "AnalysisResult" SET embedding = $1::vector WHERE id = $2`,
            [embeddingStr, analysis.id]
          );

          processed++;
          console.log(`[Backfill] Processed ${processed}/${analyses.length}: ${analysis.title.slice(0, 50)}...`);
        } catch (err) {
          console.error(`[Backfill] Failed to generate embedding for ${analysis.id}:`, err);
          errors++;
        }
      }

      // Small delay between batches to avoid rate limits
      if (i + batchSize < analyses.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`[Backfill] Completed: ${processed} processed, ${errors} errors`);

    return NextResponse.json({
      success: true,
      data: {
        processed,
        errors,
        total: analyses.length,
        remaining: await query<{ count: number }>(
          `SELECT COUNT(*) as count FROM "AnalysisResult" WHERE embedding IS NULL`
        ).then(r => r[0]?.count || 0)
      }
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to backfill embeddings'
    }, { status: 500 });
  }
}

// GET to check status
export async function GET() {
  if (!isDbEnabled) {
    return NextResponse.json({
      success: false,
      error: 'Database not configured'
    }, { status: 503 });
  }

  try {
    const stats = await query<{ with_embedding: number; without_embedding: number }>(`
      SELECT
        COUNT(*) FILTER (WHERE embedding IS NOT NULL) as with_embedding,
        COUNT(*) FILTER (WHERE embedding IS NULL) as without_embedding
      FROM "AnalysisResult"
    `);

    const stat = stats[0] || { with_embedding: 0, without_embedding: 0 };

    return NextResponse.json({
      success: true,
      data: {
        withEmbedding: Number(stat.with_embedding),
        withoutEmbedding: Number(stat.without_embedding),
        total: Number(stat.with_embedding) + Number(stat.without_embedding),
        percentComplete: stat.with_embedding + stat.without_embedding > 0
          ? Math.round((Number(stat.with_embedding) / (Number(stat.with_embedding) + Number(stat.without_embedding))) * 100)
          : 0
      }
    });
  } catch (error) {
    console.error('Backfill status error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get backfill status'
    }, { status: 500 });
  }
}
