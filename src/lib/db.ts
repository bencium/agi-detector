import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

// Connection pool (singleton)
const globalForPg = globalThis as unknown as { pool: Pool | undefined };

export const isDbEnabled = !!process.env.DATABASE_URL;

function createPool(): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
}

export const pool: Pool = isDbEnabled
  ? (globalForPg.pool ?? createPool())
  : (null as unknown as Pool);

if (process.env.NODE_ENV !== 'production' && isDbEnabled) {
  globalForPg.pool = pool;
}

if (!isDbEnabled) {
  console.warn('[DB] DATABASE_URL not set; running in no-DB mode.');
}

// Helper for parameterized queries
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  if (!isDbEnabled) return [];
  const result: QueryResult<T> = await pool.query<T>(text, params);
  return result.rows;
}

// Get single row
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

// Insert and return inserted row
export async function insert<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  if (!isDbEnabled) return null;
  const result: QueryResult<T> = await pool.query<T>(text, params);
  return result.rows[0] ?? null;
}

// Execute without returning rows (for updates/deletes)
export async function execute(
  text: string,
  params?: unknown[]
): Promise<number> {
  if (!isDbEnabled) return 0;
  const result = await pool.query(text, params);
  return result.rowCount ?? 0;
}

// Transaction helper
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  if (!isDbEnabled) throw new Error('Database not available');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// Vector search: find similar articles by embedding
export async function findSimilar(
  embedding: number[],
  limit = 5,
  excludeId?: string
): Promise<Array<{
  id: string;
  crawlId: string;
  title: string;
  url: string;
  score: number;
  similarity: number;
}>> {
  if (!isDbEnabled) return [];

  const embeddingStr = `[${embedding.join(',')}]`;
  const excludeClause = excludeId ? 'AND ar.id != $3' : '';

  const sql = `
    SELECT
      ar.id,
      ar."crawlId",
      cr.title,
      cr.url,
      ar.score,
      1 - (ar.embedding <=> $1::vector) as similarity
    FROM "AnalysisResult" ar
    JOIN "CrawlResult" cr ON ar."crawlId" = cr.id
    WHERE ar.embedding IS NOT NULL ${excludeClause}
    ORDER BY ar.embedding <=> $1::vector
    LIMIT $2
  `;

  const params = excludeId
    ? [embeddingStr, limit, excludeId]
    : [embeddingStr, limit];

  return query(sql, params);
}

// Find anomalies (articles with embeddings far from cluster center)
export async function findAnomalies(
  limit = 10,
  minScore = 0.2
): Promise<Array<{
  id: string;
  title: string;
  url: string;
  score: number;
  avgDistance: number;
}>> {
  if (!isDbEnabled) return [];

  // Get articles with highest average distance to their source group centroid
  const sql = `
    WITH labeled AS (
      SELECT
        ar.id,
        ar.embedding,
        ar.score,
        cr.title,
        cr.url,
        CASE
          WHEN COALESCE(cr.metadata->>'source', '') IN ('OpenAI Blog', 'DeepMind Research', 'Anthropic Blog', 'Microsoft AI Blog', 'BAAI Research', 'ByteDance Seed Research', 'Tencent AI Lab', 'Shanghai AI Lab', 'Qwen GitHub Releases', 'Huawei Noah Research', 'ModelScope Releases')
            THEN 'research'
          WHEN COALESCE(cr.metadata->>'source', '') IN ('TechCrunch AI', 'VentureBeat AI')
            THEN 'news'
          WHEN COALESCE(cr.metadata->>'source', '') IN ('arXiv AI', 'Anthropic Research', 'ChinaXiv')
            THEN 'academic'
          ELSE 'other'
        END AS source_group
      FROM "AnalysisResult" ar
      JOIN "CrawlResult" cr ON ar."crawlId" = cr.id
      WHERE ar.embedding IS NOT NULL
        AND ar.score >= $2
    ),
    avg_embeddings AS (
      SELECT source_group, AVG(embedding) as center
      FROM labeled
      GROUP BY source_group
    )
    SELECT
      l.id,
      l.title,
      l.url,
      l.score,
      l.embedding <=> c.center as "avgDistance"
    FROM labeled l
    JOIN avg_embeddings c ON c.source_group = l.source_group
    ORDER BY l.embedding <=> c.center DESC
    LIMIT $1
  `;

  return query(sql, [limit, minScore]);
}

// Graceful shutdown
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
  }
}
