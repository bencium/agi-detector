import { NextRequest, NextResponse } from 'next/server';
import { query, findSimilar, isDbEnabled } from '@/lib/db';
import { generateEmbedding } from '@/lib/openai';

interface AnalysisWithEmbedding {
  id: string;
  crawlId: string;
  embedding: number[] | null;
  title: string;
  content: string;
}

export async function GET(request: NextRequest) {
  if (!isDbEnabled) {
    return NextResponse.json({
      success: false,
      error: 'Database not configured'
    }, { status: 503 });
  }

  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const limit = parseInt(searchParams.get('limit') || '5', 10);

  if (!id) {
    return NextResponse.json({
      success: false,
      error: 'Missing id parameter'
    }, { status: 400 });
  }

  try {
    // Get the analysis with its embedding
    const results = await query<AnalysisWithEmbedding>(`
      SELECT ar.id, ar."crawlId", ar.embedding, cr.title, cr.content
      FROM "AnalysisResult" ar
      JOIN "CrawlResult" cr ON ar."crawlId" = cr.id
      WHERE ar.id = $1
      LIMIT 1
    `, [id]);

    if (results.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Analysis not found'
      }, { status: 404 });
    }

    const analysis = results[0];
    let embedding: number[];

    // Parse embedding if it exists (pgvector returns as string)
    if (analysis.embedding) {
      if (typeof analysis.embedding === 'string') {
        // Parse pgvector string format "[0.1, 0.2, ...]"
        embedding = JSON.parse(analysis.embedding);
      } else if (Array.isArray(analysis.embedding)) {
        embedding = analysis.embedding;
      } else {
        // Unknown format, regenerate
        embedding = [];
      }
    } else {
      embedding = [];
    }

    // Generate embedding if missing or empty
    if (embedding.length === 0) {
      const text = `${analysis.title}\n\n${analysis.content}`;
      embedding = await generateEmbedding(text);

      // Store the embedding for future use
      const embeddingStr = `[${embedding.join(',')}]`;
      await query(
        `UPDATE "AnalysisResult" SET embedding = $1::vector WHERE id = $2`,
        [embeddingStr, id]
      );
    }

    // Find similar articles
    const similar = await findSimilar(embedding, limit, id);

    return NextResponse.json({
      success: true,
      data: {
        sourceId: id,
        similar: similar.map(s => ({
          id: s.id,
          crawlId: s.crawlId,
          title: s.title,
          url: s.url,
          score: s.score,
          similarity: Math.round(s.similarity * 100) / 100
        }))
      }
    });
  } catch (error) {
    console.error('Similar search error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to find similar articles'
    }, { status: 500 });
  }
}
