/**
 * Comprehensive Source Integration
 *
 * Aggregates content from 40+ sources:
 * - Traditional web scraping (7 sources)
 * - arXiv (4 categories)
 * - Reddit (5 subreddits)
 * - GitHub (trending + key repos)
 * - Semantic Scholar (200M papers)
 * - Papers with Code (SOTA tracking)
 */

import { crawlAllSources } from '../crawler';
import { fetchRedditPosts, monitorAGIBreakthroughs } from './reddit';
import { fetchAllGitHubSources } from './github';
import { fetchAllSemanticScholarSources } from './semanticScholar';
import { fetchAllPapersWithCodeSources } from './papersWithCode';
import { analyzeKeywordHeuristics, quickFilter } from '../filters/keywordHeuristics';
import { detectLanguage } from '../nlp/multilingual';

interface UnifiedArticle {
  title: string;
  content: string;
  url: string;
  metadata: {
    source: string;
    sourceType: 'web' | 'academic' | 'social' | 'code_repo' | 'news';
    timestamp: string;
    id: string;
    [key: string]: any; // Additional source-specific metadata
  };
  heuristicAnalysis?: ReturnType<typeof analyzeKeywordHeuristics>;
  language?: string;
}

/**
 * Fetch from all traditional web sources (existing crawler)
 */
async function fetchTraditionalSources(): Promise<UnifiedArticle[]> {
  console.log('[All Sources] Fetching traditional web sources...');

  const articles = await crawlAllSources();

  return articles.map(article => ({
    ...article,
    metadata: {
      ...article.metadata,
      sourceType: article.metadata.source.includes('arXiv') ? 'academic' :
                  article.metadata.source.includes('Blog') || article.metadata.source.includes('Research') ? 'web' :
                  'news',
    },
  }));
}

/**
 * Fetch from all Reddit sources
 */
async function fetchRedditSources(): Promise<UnifiedArticle[]> {
  if (!process.env.REDDIT_CLIENT_ID) {
    console.log('[All Sources] Reddit disabled (no credentials)');
    return [];
  }

  console.log('[All Sources] Fetching Reddit sources...');

  try {
    const [hotPosts, breakthroughs] = await Promise.all([
      fetchRedditPosts('day', 25),
      monitorAGIBreakthroughs(),
    ]);

    const combined = [...hotPosts, ...breakthroughs];

    // Deduplicate
    const unique = Array.from(
      new Map(combined.map(post => [post.metadata.id, post])).values()
    );

    return unique.map(post => ({
      ...post,
      metadata: {
        ...post.metadata,
        sourceType: 'social' as const,
      },
    }));
  } catch (error) {
    console.error('[All Sources] Reddit error:', error);
    return [];
  }
}

/**
 * Fetch from all GitHub sources
 */
async function fetchGitHubSources(): Promise<UnifiedArticle[]> {
  console.log('[All Sources] Fetching GitHub sources...');

  try {
    const repos = await fetchAllGitHubSources();

    return repos.map(repo => ({
      ...repo,
      metadata: {
        ...repo.metadata,
        sourceType: 'code_repo' as const,
      },
    }));
  } catch (error) {
    console.error('[All Sources] GitHub error:', error);
    return [];
  }
}

/**
 * Fetch from Semantic Scholar
 */
async function fetchSemanticScholarSources(): Promise<UnifiedArticle[]> {
  console.log('[All Sources] Fetching Semantic Scholar sources...');

  try {
    const papers = await fetchAllSemanticScholarSources();

    return papers.map(paper => ({
      ...paper,
      metadata: {
        ...paper.metadata,
        sourceType: 'academic' as const,
      },
    }));
  } catch (error) {
    console.error('[All Sources] Semantic Scholar error:', error);
    return [];
  }
}

/**
 * Fetch from Papers with Code
 */
async function fetchPapersWithCodeSources(): Promise<UnifiedArticle[]> {
  console.log('[All Sources] Fetching Papers with Code sources...');

  try {
    const papers = await fetchAllPapersWithCodeSources();

    return papers.map(paper => ({
      ...paper,
      metadata: {
        ...paper.metadata,
        sourceType: 'academic' as const,
      },
    }));
  } catch (error) {
    console.error('[All Sources] Papers with Code error:', error);
    return [];
  }
}

/**
 * Apply heuristic filtering to all articles
 */
function applyHeuristicFiltering(articles: UnifiedArticle[]): UnifiedArticle[] {
  console.log(`[All Sources] Applying heuristic filtering to ${articles.length} articles...`);

  const filtered: UnifiedArticle[] = [];

  for (const article of articles) {
    // Quick filter first (fast rejection)
    if (!quickFilter(article.title, article.content)) {
      console.log(`[Heuristics] ⛔ Rejected (quick filter): ${article.title.substring(0, 50)}...`);
      continue;
    }

    // Detailed heuristic analysis
    const heuristicAnalysis = analyzeKeywordHeuristics(article.title, article.content);

    if (!heuristicAnalysis.shouldAnalyze) {
      console.log(`[Heuristics] ⛔ Rejected: ${article.title.substring(0, 50)}... (${heuristicAnalysis.reasons.join(', ')})`);
      continue;
    }

    // Detect language
    const languageDetection = detectLanguage(`${article.title} ${article.content}`);

    filtered.push({
      ...article,
      heuristicAnalysis,
      language: languageDetection.language,
    });
  }

  const rejectionRate = ((articles.length - filtered.length) / articles.length * 100).toFixed(1);
  console.log(`[Heuristics] ✅ Passed: ${filtered.length}/${articles.length} (${rejectionRate}% rejected)`);

  return filtered;
}

/**
 * Deduplicate articles across sources
 */
function deduplicateArticles(articles: UnifiedArticle[]): UnifiedArticle[] {
  console.log(`[All Sources] Deduplicating ${articles.length} articles...`);

  // Deduplicate by URL
  const byUrl = new Map<string, UnifiedArticle>();

  for (const article of articles) {
    const normalizedUrl = article.url.toLowerCase().replace(/\/$/, '');

    if (!byUrl.has(normalizedUrl)) {
      byUrl.set(normalizedUrl, article);
    } else {
      // Keep the one with more content
      const existing = byUrl.get(normalizedUrl)!;
      if (article.content.length > existing.content.length) {
        byUrl.set(normalizedUrl, article);
      }
    }
  }

  const unique = Array.from(byUrl.values());
  console.log(`[All Sources] Removed ${articles.length - unique.length} duplicates`);

  return unique;
}

/**
 * Fetch from ALL sources and return unified, filtered, deduplicated results
 */
export async function fetchAllAGISources(options: {
  includeReddit?: boolean;
  includeGitHub?: boolean;
  includeSemanticScholar?: boolean;
  includePapersWithCode?: boolean;
  applyHeuristics?: boolean;
} = {}): Promise<UnifiedArticle[]> {
  const {
    includeReddit = true,
    includeGitHub = true,
    includeSemanticScholar = true,
    includePapersWithCode = true,
    applyHeuristics = true,
  } = options;

  console.log('\n=== Starting Comprehensive AGI Source Monitoring ===\n');

  const startTime = Date.now();

  // Fetch from all sources in parallel for maximum speed
  const [
    traditionalArticles,
    redditPosts,
    githubRepos,
    semanticScholarPapers,
    papersWithCodePapers,
  ] = await Promise.all([
    fetchTraditionalSources(),
    includeReddit ? fetchRedditSources() : Promise.resolve([]),
    includeGitHub ? fetchGitHubSources() : Promise.resolve([]),
    includeSemanticScholar ? fetchSemanticScholarSources() : Promise.resolve([]),
    includePapersWithCode ? fetchPapersWithCodeSources() : Promise.resolve([]),
  ]);

  // Combine all articles
  let allArticles = [
    ...traditionalArticles,
    ...redditPosts,
    ...githubRepos,
    ...semanticScholarPapers,
    ...papersWithCodePapers,
  ];

  console.log('\n=== Source Breakdown ===');
  console.log(`Traditional web sources: ${traditionalArticles.length}`);
  console.log(`Reddit: ${redditPosts.length}`);
  console.log(`GitHub: ${githubRepos.length}`);
  console.log(`Semantic Scholar: ${semanticScholarPapers.length}`);
  console.log(`Papers with Code: ${papersWithCodePapers.length}`);
  console.log(`Total raw articles: ${allArticles.length}\n`);

  // Deduplicate
  allArticles = deduplicateArticles(allArticles);

  // Apply heuristic filtering if enabled
  if (applyHeuristics) {
    allArticles = applyHeuristicFiltering(allArticles);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n=== Monitoring Complete ===');
  console.log(`Final article count: ${allArticles.length}`);
  console.log(`Duration: ${duration}s`);
  console.log(`Average: ${(allArticles.length / parseFloat(duration)).toFixed(1)} articles/second\n`);

  return allArticles;
}

/**
 * Get statistics about sources
 */
export function getSourceStatistics(articles: UnifiedArticle[]): {
  totalArticles: number;
  bySourceType: Record<string, number>;
  byLanguage: Record<string, number>;
  heuristicFiltered: number;
  avgHeuristicScore: number;
  avgMediaNoiseScore: number;
} {
  const stats = {
    totalArticles: articles.length,
    bySourceType: {} as Record<string, number>,
    byLanguage: {} as Record<string, number>,
    heuristicFiltered: 0,
    avgHeuristicScore: 0,
    avgMediaNoiseScore: 0,
  };

  for (const article of articles) {
    // Count by source type
    const sourceType = article.metadata.sourceType;
    stats.bySourceType[sourceType] = (stats.bySourceType[sourceType] || 0) + 1;

    // Count by language
    if (article.language) {
      stats.byLanguage[article.language] = (stats.byLanguage[article.language] || 0) + 1;
    }

    // Heuristic scores
    if (article.heuristicAnalysis) {
      stats.avgHeuristicScore += article.heuristicAnalysis.heuristicScore;
      stats.avgMediaNoiseScore += article.heuristicAnalysis.mediaNoiseScore;
      if (article.heuristicAnalysis.shouldAnalyze) {
        stats.heuristicFiltered++;
      }
    }
  }

  if (articles.length > 0) {
    stats.avgHeuristicScore /= articles.length;
    stats.avgMediaNoiseScore /= articles.length;
  }

  return stats;
}
