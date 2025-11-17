/**
 * Papers with Code API Integration
 *
 * Tracks State-of-the-Art (SOTA) results across 5000+ benchmarks
 * Free API, no authentication required
 */

import axios from 'axios';

const API_BASE = 'https://paperswithcode.com/api/v1';
const RATE_LIMIT_DELAY = 1000; // 1 second between requests

interface PapersWithCodePaper {
  title: string;
  content: string;
  url: string;
  metadata: {
    source: string;
    timestamp: string;
    id: string;
    paperUrl: string;
    arxivId?: string;
    githubUrl?: string;
    stars?: number;
    tasks: string[];
    benchmarks: Array<{
      name: string;
      metric: string;
      value: number;
      isSOTA: boolean;
    }>;
  };
}

// AGI-relevant tasks to monitor
const AGI_TASKS = [
  'Question Answering',
  'Common Sense Reasoning',
  'Multi-Task Learning',
  'Transfer Learning',
  'Few-Shot Learning',
  'Zero-Shot Learning',
  'Meta-Learning',
  'Reinforcement Learning',
  'Multi-Modal Learning',
  'Language Modelling',
  'Code Generation',
  'Mathematical Reasoning',
];

/**
 * Get papers for a specific task
 */
export async function getPapersForTask(
  task: string,
  limit: number = 10
): Promise<PapersWithCodePaper[]> {
  try {
    console.log(`[Papers with Code] Fetching papers for task: ${task}`);

    const response = await axios.get(`${API_BASE}/papers/`, {
      params: {
        tasks: task,
        ordering: '-stars', // Sort by GitHub stars
        limit,
      },
      timeout: 30000,
    });

    const papers: PapersWithCodePaper[] = [];

    for (const paper of response.data.results || []) {
      papers.push({
        title: paper.title,
        content: paper.abstract || paper.title,
        url: `https://paperswithcode.com${paper.url}`,
        metadata: {
          source: 'Papers with Code',
          timestamp: new Date().toISOString(),
          id: paper.id,
          paperUrl: paper.paper_url,
          arxivId: paper.arxiv_id,
          githubUrl: paper.github_url,
          stars: paper.stars || 0,
          tasks: [task],
          benchmarks: [],
        },
      });
    }

    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));

    console.log(`[Papers with Code] Found ${papers.length} papers for ${task}`);
    return papers;

  } catch (error: any) {
    console.error(`[Papers with Code] Error fetching task ${task}:`, error.message);
    return [];
  }
}

/**
 * Get recent SOTA (State-of-the-Art) results
 */
export async function getRecentSOTAResults(): Promise<PapersWithCodePaper[]> {
  try {
    console.log('[Papers with Code] Fetching recent SOTA results...');

    const response = await axios.get(`${API_BASE}/sota/`, {
      params: {
        ordering: '-published', // Most recent first
        limit: 20,
      },
      timeout: 30000,
    });

    const papers: PapersWithCodePaper[] = [];

    for (const sota of response.data.results || []) {
      // Fetch paper details
      if (sota.paper) {
        try {
          const paperResponse = await axios.get(`${API_BASE}/papers/${sota.paper}/`);
          const paper = paperResponse.data;

          papers.push({
            title: paper.title,
            content: paper.abstract || paper.title,
            url: `https://paperswithcode.com${paper.url}`,
            metadata: {
              source: 'Papers with Code (SOTA)',
              timestamp: new Date().toISOString(),
              id: paper.id,
              paperUrl: paper.paper_url,
              arxivId: paper.arxiv_id,
              githubUrl: paper.github_url,
              stars: paper.stars || 0,
              tasks: [sota.task],
              benchmarks: [{
                name: sota.dataset,
                metric: sota.metric,
                value: sota.value,
                isSOTA: true,
              }],
            },
          });

          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
        } catch (err) {
          console.error(`[Papers with Code] Error fetching paper ${sota.paper}`);
        }
      }
    }

    console.log(`[Papers with Code] Found ${papers.length} SOTA papers`);
    return papers;

  } catch (error: any) {
    console.error('[Papers with Code] Error fetching SOTA:', error.message);
    return [];
  }
}

/**
 * Monitor AGI-relevant tasks for new papers
 */
export async function monitorAGITasks(): Promise<PapersWithCodePaper[]> {
  console.log('[Papers with Code] Monitoring AGI-relevant tasks...');

  const allPapers: PapersWithCodePaper[] = [];

  // Fetch top papers for each AGI task (limit to avoid rate limits)
  for (const task of AGI_TASKS.slice(0, 5)) {
    const papers = await getPapersForTask(task, 5);
    allPapers.push(...papers);
  }

  // Deduplicate by paper ID
  const uniquePapers = Array.from(
    new Map(allPapers.map(p => [p.metadata.id, p])).values()
  );

  console.log(`[Papers with Code] Total unique papers: ${uniquePapers.length}`);
  return uniquePapers;
}

/**
 * Search for papers by keyword
 */
export async function searchPapers(query: string): Promise<PapersWithCodePaper[]> {
  try {
    console.log(`[Papers with Code] Searching for: "${query}"`);

    const response = await axios.get(`${API_BASE}/papers/`, {
      params: {
        q: query,
        ordering: '-stars',
        limit: 20,
      },
      timeout: 30000,
    });

    const papers: PapersWithCodePaper[] = [];

    for (const paper of response.data.results || []) {
      papers.push({
        title: paper.title,
        content: paper.abstract || paper.title,
        url: `https://paperswithcode.com${paper.url}`,
        metadata: {
          source: 'Papers with Code',
          timestamp: new Date().toISOString(),
          id: paper.id,
          paperUrl: paper.paper_url,
          arxivId: paper.arxiv_id,
          githubUrl: paper.github_url,
          stars: paper.stars || 0,
          tasks: [],
          benchmarks: [],
        },
      });
    }

    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));

    console.log(`[Papers with Code] Search found ${papers.length} papers`);
    return papers;

  } catch (error: any) {
    console.error('[Papers with Code] Search error:', error.message);
    return [];
  }
}

/**
 * Get trending papers (high GitHub stars)
 */
export async function getTrendingPapers(minStars: number = 100): Promise<PapersWithCodePaper[]> {
  try {
    console.log('[Papers with Code] Fetching trending papers...');

    const response = await axios.get(`${API_BASE}/papers/`, {
      params: {
        ordering: '-stars',
        limit: 20,
      },
      timeout: 30000,
    });

    const papers: PapersWithCodePaper[] = [];

    for (const paper of response.data.results || []) {
      if ((paper.stars || 0) >= minStars) {
        papers.push({
          title: paper.title,
          content: paper.abstract || paper.title,
          url: `https://paperswithcode.com${paper.url}`,
          metadata: {
            source: 'Papers with Code (Trending)',
            timestamp: new Date().toISOString(),
            id: paper.id,
            paperUrl: paper.paper_url,
            arxivId: paper.arxiv_id,
            githubUrl: paper.github_url,
            stars: paper.stars,
            tasks: [],
            benchmarks: [],
          },
        });
      }
    }

    console.log(`[Papers with Code] Found ${papers.length} trending papers`);
    return papers;

  } catch (error: any) {
    console.error('[Papers with Code] Error fetching trending:', error.message);
    return [];
  }
}

/**
 * Comprehensive Papers with Code monitoring
 */
export async function fetchAllPapersWithCodeSources(): Promise<PapersWithCodePaper[]> {
  console.log('[Papers with Code] Starting comprehensive monitoring...');

  const results: PapersWithCodePaper[]  = [];

  // 1. Recent SOTA results
  const sota = await getRecentSOTAResults();
  results.push(...sota);

  // 2. AGI-relevant tasks
  const agiPapers = await monitorAGITasks();
  results.push(...agiPapers);

  // 3. High-signal keywords
  const keywords = ['AGI', 'emergent capabilities', 'meta-learning'];
  for (const keyword of keywords) {
    const papers = await searchPapers(keyword);
    results.push(...papers);
  }

  // Deduplicate
  const uniquePapers = Array.from(
    new Map(results.map(p => [p.metadata.id, p])).values()
  );

  console.log(`[Papers with Code] Total unique papers: ${uniquePapers.length}`);
  return uniquePapers;
}

/**
 * Calculate AGI relevance boost based on Papers with Code data
 */
export function getPapersWithCodeBoost(paper: PapersWithCodePaper): number {
  let boost = 1.0;

  // GitHub stars indicate implementation quality/interest
  if (paper.metadata.stars && paper.metadata.stars > 1000) {
    boost *= 1.3; // 30% boost for >1000 stars
  } else if (paper.metadata.stars && paper.metadata.stars > 500) {
    boost *= 1.2; // 20% boost for >500 stars
  } else if (paper.metadata.stars && paper.metadata.stars > 100) {
    boost *= 1.1; // 10% boost for >100 stars
  }

  // SOTA results are significant
  const hasSOTA = paper.metadata.benchmarks.some(b => b.isSOTA);
  if (hasSOTA) {
    boost *= 1.25; // 25% boost for SOTA results
  }

  // AGI-relevant tasks
  const agiTaskCount = paper.metadata.tasks.filter(t =>
    AGI_TASKS.some(agiTask => t.toLowerCase().includes(agiTask.toLowerCase()))
  ).length;

  if (agiTaskCount > 0) {
    boost *= 1.1 + (agiTaskCount * 0.05); // 10% + 5% per AGI task
  }

  return Math.min(boost, 2.0); // Cap at 2x
}
