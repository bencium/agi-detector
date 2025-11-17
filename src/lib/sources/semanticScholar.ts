/**
 * Semantic Scholar API Integration
 *
 * Free academic search API with 200M+ papers, citation graphs, and AI recommendations
 * Rate limit: 100 requests/5 minutes (5000/day), no API key required (but recommended)
 */

import axios from 'axios';

interface SemanticScholarPaper {
  title: string;
  content: string;
  url: string;
  metadata: {
    source: string;
    timestamp: string;
    id: string;
    paperId: string;
    citations: number;
    influentialCitations: number;
    citationVelocity: number;
    year: number;
    authors: Array<{
      name: string;
      affiliation?: string;
      hIndex?: number;
    }>;
    venue?: string;
    doi?: string;
    arxivId?: string;
  };
}

const API_BASE = 'https://api.semanticscholar.org/graph/v1';
const RATE_LIMIT_DELAY = 1000; // 1 second between requests

// High-signal AI venues and conferences
const TOP_VENUES = [
  'NeurIPS', 'ICML', 'ICLR', 'AAAI', 'CVPR', 'ICCV', 'ECCV',
  'ACL', 'EMNLP', 'NAACL', 'IJCAI', 'KDD', 'ICRA',
];

// Prestigious institutions
const TOP_INSTITUTIONS = [
  'OpenAI', 'DeepMind', 'Anthropic', 'Google Brain', 'Meta AI',
  'MIT', 'Stanford', 'Berkeley', 'CMU', 'Oxford', 'Cambridge',
];

/**
 * Search papers by keyword with AGI relevance
 */
export async function searchPapers(
  query: string,
  limit: number = 20,
  yearFilter?: string
): Promise<SemanticScholarPaper[]> {
  try {
    console.log(`[Semantic Scholar] Searching for: "${query}"`);

    const params: any = {
      query,
      limit,
      fields: 'paperId,title,abstract,year,authors,venue,citationCount,influentialCitationCount,externalIds,publicationDate',
    };

    if (yearFilter) {
      params.year = yearFilter; // e.g., "2024-" for 2024 onwards
    }

    const response = await axios.get(`${API_BASE}/paper/search`, {
      params,
      headers: getHeaders(),
      timeout: 30000,
    });

    const papers: SemanticScholarPaper[] = [];

    for (const paper of response.data.data || []) {
      const citationVelocity = calculateCitationVelocity(
        paper.citationCount || 0,
        paper.publicationDate || paper.year
      );

      papers.push({
        title: paper.title,
        content: paper.abstract || paper.title,
        url: `https://www.semanticscholar.org/paper/${paper.paperId}`,
        metadata: {
          source: 'Semantic Scholar',
          timestamp: new Date().toISOString(),
          id: paper.paperId,
          paperId: paper.paperId,
          citations: paper.citationCount || 0,
          influentialCitations: paper.influentialCitationCount || 0,
          citationVelocity,
          year: paper.year || 0,
          authors: (paper.authors || []).map((a: any) => ({
            name: a.name,
            affiliation: extractAffiliation(a),
          })),
          venue: paper.venue,
          doi: paper.externalIds?.DOI,
          arxivId: paper.externalIds?.ArXiv,
        },
      });
    }

    console.log(`[Semantic Scholar] Found ${papers.length} papers for "${query}"`);

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));

    return papers;

  } catch (error: any) {
    console.error(`[Semantic Scholar] Search error:`, error.message);
    return [];
  }
}

/**
 * Get trending papers by citation velocity
 */
export async function getTrendingPapers(
  fieldsOfStudy: string[] = ['Computer Science'],
  minCitations: number = 10
): Promise<SemanticScholarPaper[]> {
  console.log('[Semantic Scholar] Fetching trending papers...');

  const queries = [
    'artificial general intelligence',
    'emergent capabilities',
    'recursive self-improvement',
    'meta-learning',
    'autonomous agents',
    'world models',
  ];

  const allPapers: SemanticScholarPaper[] = [];

  for (const query of queries) {
    const papers = await searchPapers(query, 10, '2024-'); // Only 2024+ papers
    allPapers.push(...papers);
  }

  // Filter by citation velocity (rapid growth)
  const trending = allPapers
    .filter(p => p.metadata.citationVelocity > 3) // >3 citations/day
    .sort((a, b) => b.metadata.citationVelocity - a.metadata.citationVelocity);

  console.log(`[Semantic Scholar] Found ${trending.length} trending papers`);
  return trending;
}

/**
 * Get highly influential papers (high influential citation count)
 */
export async function getInfluentialPapers(
  query: string,
  minInfluentialCitations: number = 5
): Promise<SemanticScholarPaper[]> {
  const papers = await searchPapers(query, 50);

  const influential = papers
    .filter(p => p.metadata.influentialCitations >= minInfluentialCitations)
    .sort((a, b) => b.metadata.influentialCitations - a.metadata.influentialCitations);

  console.log(`[Semantic Scholar] Found ${influential.length} influential papers`);
  return influential;
}

/**
 * Monitor papers from top AI research labs
 */
export async function monitorTopLabs(): Promise<SemanticScholarPaper[]> {
  console.log('[Semantic Scholar] Monitoring top AI research labs...');

  const papers: SemanticScholarPaper[] = [];

  for (const institution of TOP_INSTITUTIONS.slice(0, 5)) { // Limit to top 5 to avoid rate limits
    try {
      const results = await searchPapers(`${institution} AGI machine learning`, 5, '2024-');
      papers.push(...results);

      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    } catch (error: any) {
      console.error(`[Semantic Scholar] Error fetching ${institution}:`, error.message);
    }
  }

  // Filter for papers from these institutions in author affiliations
  const labPapers = papers.filter(paper =>
    paper.metadata.authors.some(author =>
      TOP_INSTITUTIONS.some(inst =>
        author.affiliation?.toLowerCase().includes(inst.toLowerCase())
      )
    )
  );

  console.log(`[Semantic Scholar] Found ${labPapers.length} papers from top labs`);
  return labPapers;
}

/**
 * Comprehensive Semantic Scholar monitoring
 */
export async function fetchAllSemanticScholarSources(): Promise<SemanticScholarPaper[]> {
  console.log('[Semantic Scholar] Starting comprehensive monitoring...');

  const results: SemanticScholarPaper[] = [];

  // 1. Trending papers by citation velocity
  const trending = await getTrendingPapers();
  results.push(...trending);

  // 2. Top lab publications
  const labPapers = await monitorTopLabs();
  results.push(...labPapers);

  // 3. Highly influential papers
  const influential = await getInfluentialPapers('artificial general intelligence', 5);
  results.push(...influential);

  // Deduplicate by paper ID
  const uniquePapers = Array.from(
    new Map(results.map(p => [p.metadata.paperId, p])).values()
  );

  console.log(`[Semantic Scholar] Total unique papers: ${uniquePapers.length}`);
  return uniquePapers;
}

/**
 * Calculate citation velocity (citations per day)
 */
function calculateCitationVelocity(citations: number, publicationDate: string | number): number {
  try {
    const pubDate = typeof publicationDate === 'string'
      ? new Date(publicationDate)
      : new Date(publicationDate, 0, 1); // Year only

    const daysSincePublished = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSincePublished < 1) return 0; // Too new

    const velocity = citations / daysSincePublished;

    // Return citations per day
    return Math.round(velocity * 10) / 10; // Round to 1 decimal
  } catch (error) {
    return 0;
  }
}

/**
 * Extract affiliation from author object
 */
function extractAffiliation(author: any): string | undefined {
  // Semantic Scholar doesn't always provide affiliation in basic search
  // Would need to make additional API calls per author for full details
  return undefined; // Placeholder for now
}

/**
 * Get headers for API requests
 */
function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': 'AGI-Detector-Bot/1.0 (https://github.com/bencium/agi-detector)',
  };

  // Optional: Add API key for higher rate limits
  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
  if (apiKey) {
    headers['x-api-key'] = apiKey;
    console.log('[Semantic Scholar] Using API key for higher rate limits');
  }

  return headers;
}

/**
 * Get AGI relevance score boost based on venue and authors
 */
export function getPrestigeBoost(paper: SemanticScholarPaper): number {
  let boost = 1.0;

  // Venue prestige
  if (paper.metadata.venue && TOP_VENUES.some(v =>
    paper.metadata.venue!.toUpperCase().includes(v.toUpperCase())
  )) {
    boost *= 1.3; // 30% boost for top venues
  }

  // Author affiliation prestige
  const hasTopAffiliation = paper.metadata.authors.some(author =>
    TOP_INSTITUTIONS.some(inst =>
      author.affiliation?.toLowerCase().includes(inst.toLowerCase())
    )
  );

  if (hasTopAffiliation) {
    boost *= 1.2; // 20% boost for top institutions
  }

  // Citation velocity boost
  if (paper.metadata.citationVelocity > 50) {
    boost *= 1.5; // 50% boost for viral papers (>50 cit/day)
  } else if (paper.metadata.citationVelocity > 10) {
    boost *= 1.3; // 30% boost for highly cited (>10 cit/day)
  } else if (paper.metadata.citationVelocity > 3) {
    boost *= 1.15; // 15% boost for notable (>3 cit/day)
  }

  return Math.min(boost, 2.0); // Cap at 2x boost
}

/**
 * Optional environment variable for higher rate limits:
 *
 * SEMANTIC_SCHOLAR_API_KEY=your_api_key_here
 *
 * Get API key at: https://www.semanticscholar.org/product/api
 * Free tier: 5000 requests/day
 * With key: Higher limits available
 */
