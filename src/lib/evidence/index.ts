import { canonicalizeUrl, hashContent } from '@/lib/evidence/provenance';
import { extractEvidenceSnippets, extractEvidenceClaims } from '@/lib/evidence/extract';

export type EvidenceBundle = {
  snippets: string[];
  claims: Array<{
    claim: string;
    evidence: string;
    tags: string[];
    numbers: number[];
    benchmark?: string;
    metric?: string;
    value?: number;
    delta?: number;
    unit?: string;
  }>;
};

export function buildEvidence(content: string): EvidenceBundle {
  const snippets = extractEvidenceSnippets(content);
  const claims = extractEvidenceClaims(snippets);
  return {
    snippets: snippets.map(s => s.text),
    claims
  };
}

export function buildCrawlMetadata(input: {
  source: string;
  url: string;
  content: string;
  title?: string;
  publishedAt?: string;
  id?: string;
}): Record<string, unknown> {
  const now = new Date().toISOString();
  const evidence = buildEvidence(input.content);
  return {
    source: input.source,
    timestamp: input.publishedAt || now,
    fetchedAt: now,
    id: input.id || `${input.source}-${Date.now()}`,
    canonicalUrl: canonicalizeUrl(input.url),
    contentHash: hashContent(input.content),
    title: input.title,
    evidence
  };
}
