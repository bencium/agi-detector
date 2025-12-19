import { execute, queryOne } from '@/lib/db';
import { buildEvidence } from '@/lib/evidence';

export type StructuredClaim = {
  claim: string;
  evidence: string;
  tags: string[];
  numbers: number[];
  benchmark?: string;
  metric?: string;
  value?: number;
  delta?: number;
  unit?: string;
};

let evidenceSchemaEnsured = false;

export async function ensureEvidenceSchema(): Promise<void> {
  if (evidenceSchemaEnsured) return;
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS "EvidenceClaim" (
        id TEXT NOT NULL DEFAULT gen_random_uuid(),
        "crawlId" TEXT NOT NULL,
        claim TEXT NOT NULL,
        evidence TEXT NOT NULL,
        benchmark TEXT,
        metric TEXT,
        value DOUBLE PRECISION,
        delta DOUBLE PRECISION,
        unit TEXT,
        tags TEXT[] NOT NULL DEFAULT '{}',
        numbers DOUBLE PRECISION[] NOT NULL DEFAULT '{}',
        url TEXT,
        "canonicalUrl" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "EvidenceClaim_pkey" PRIMARY KEY (id)
      )
    `);
    await execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS "EvidenceClaim_crawlId_claim_key"
       ON "EvidenceClaim"("crawlId", claim)`
    );
    await execute(
      `CREATE INDEX IF NOT EXISTS "EvidenceClaim_crawlId_idx"
       ON "EvidenceClaim"("crawlId")`
    );
    await execute(
      `CREATE INDEX IF NOT EXISTS "EvidenceClaim_benchmark_idx"
       ON "EvidenceClaim"(benchmark)`
    );
    evidenceSchemaEnsured = true;
  } catch (error) {
    console.warn('[EvidenceClaim] Failed to ensure schema:', error);
  }
}

export async function upsertEvidenceClaims(input: {
  crawlId: string;
  claims: StructuredClaim[];
  url?: string | null;
  canonicalUrl?: string | null;
}): Promise<number> {
  if (!input.claims || input.claims.length === 0) return 0;
  await ensureEvidenceSchema();

  let inserted = 0;
  for (const claim of input.claims) {
    await execute(
      `INSERT INTO "EvidenceClaim"
       ("crawlId", claim, evidence, benchmark, metric, value, delta, unit, tags, numbers, url, "canonicalUrl")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT ("crawlId", claim) DO NOTHING`,
      [
        input.crawlId,
        claim.claim,
        claim.evidence,
        claim.benchmark || null,
        claim.metric || null,
        claim.value ?? null,
        claim.delta ?? null,
        claim.unit || null,
        claim.tags || [],
        claim.numbers || [],
        input.url || null,
        input.canonicalUrl || null
      ]
    );
    inserted += 1;
  }

  return inserted;
}

export async function ensureEvidenceClaimsForCrawl(input: {
  crawlId: string;
  content: string;
  metadata?: Record<string, any> | null;
  url?: string | null;
  canonicalUrl?: string | null;
}): Promise<StructuredClaim[]> {
  await ensureEvidenceSchema();
  const existing = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM "EvidenceClaim" WHERE "crawlId" = $1`,
    [input.crawlId]
  );

  const metadataClaims = Array.isArray(input.metadata?.evidence?.claims)
    ? (input.metadata?.evidence?.claims as StructuredClaim[])
    : [];

  const claims = metadataClaims.length > 0
    ? metadataClaims
    : buildEvidence(input.content).claims;

  const existingCount = Number(existing?.count || 0);
  if (existingCount === 0 && claims.length > 0) {
    await upsertEvidenceClaims({
      crawlId: input.crawlId,
      claims,
      url: input.url || null,
      canonicalUrl: (input.metadata?.canonicalUrl as string | undefined) || input.canonicalUrl || null
    });
  }

  return claims;
}
