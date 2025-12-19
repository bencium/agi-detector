import { NextRequest, NextResponse } from 'next/server';
import { findSimilar, isDbEnabled } from '@/lib/db';
import { generateEmbedding } from '@/lib/openai';
import { enforceRateLimit } from '@/lib/security/rateLimit';

export async function GET(request: NextRequest) {
  if (!isDbEnabled) {
    return NextResponse.json({
      success: false,
      error: 'Database not configured'
    }, { status: 503 });
  }

  const limited = enforceRateLimit(request, { windowMs: 60_000, max: 20, keyPrefix: 'semantic-search' });
  if (limited) return limited;

  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get('q');
  const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);

  if (!q || q.length < 2) {
    return NextResponse.json({
      success: false,
      error: 'Query parameter "q" required (min 2 characters)'
    }, { status: 400 });
  }

  try {
    console.log(`[Semantic Search] Query: "${q}" (limit: ${limit})`);

    // Generate embedding for query text
    const embedding = await generateEmbedding(q);

    // Find similar articles using pgvector
    const results = await findSimilar(embedding, limit);

    console.log(`[Semantic Search] Found ${results.length} results`);

    return NextResponse.json({
      success: true,
      data: {
        query: q,
        count: results.length,
        results: results.map(r => ({
          id: r.id,
          crawlId: r.crawlId,
          title: r.title,
          url: r.url,
          score: r.score,
          similarity: Math.round(r.similarity * 100) / 100
        }))
      }
    });
  } catch (error) {
    console.error('[Semantic Search] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search articles'
    }, { status: 500 });
  }
}
