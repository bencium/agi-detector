import { canonicalizeUrl, hashContent } from '@/lib/evidence/provenance';
import { extractEvidenceSnippets, extractEvidenceClaims } from '@/lib/evidence/extract';
import { detectLanguage, normalizeDate, normalizeSourceName } from '@/lib/metadata/normalize';

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
  author?: string;
  id?: string;
}): Record<string, unknown> {
  const now = new Date().toISOString();
  const normalizedTimestamp = normalizeDate(input.publishedAt) || now;
  const normalizedSource = normalizeSourceName(input.source);
  const language = detectLanguage(`${input.title || ''} ${input.content || ''}`);
  const evidence = buildEvidence(input.content);
  return {
    source: normalizedSource,
    timestamp: normalizedTimestamp,
    fetchedAt: now,
    id: input.id || `${input.source}-${Date.now()}`,
    canonicalUrl: canonicalizeUrl(input.url),
    contentHash: hashContent(input.content),
    title: input.title,
    author: input.author,
    language,
    evidence
  };
}
