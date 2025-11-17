/**
 * GitHub Monitoring Integration
 *
 * Monitors trending AI/ML repositories for AGI-relevant code and breakthroughs
 * Free API: 5000 requests/hour authenticated, 60/hour unauthenticated
 */

import { Octokit } from '@octokit/rest';

interface GitHubRepo {
  title: string;
  content: string;
  url: string;
  metadata: {
    source: string;
    timestamp: string;
    id: string;
    repoName: string;
    stars: number;
    language: string;
    topics: string[];
    weeklyStars?: number;
    hasCode: boolean;
  };
}

// High-signal keywords for AGI research
const AGI_KEYWORDS = [
  'AGI', 'artificial-general-intelligence', 'recursive-self-improvement',
  'meta-learning', 'autonomous-agent', 'emergent-capabilities',
  'self-modifying', 'world-model', 'reasoning-engine',
];

// Major AI research organizations to monitor
const KEY_ORGANIZATIONS = [
  'openai', 'google-deepmind', 'anthropics', 'meta', 'microsoft',
  'google-research', 'facebookresearch', 'EleutherAI',
];

// Key individual repos to monitor
const WATCH_REPOS = [
  { owner: 'openai', repo: 'gpt-4' },
  { owner: 'openai', repo: 'openai-cookbook' },
  { owner: 'anthropics', repo: 'anthropic-sdk-python' },
  { owner: 'google-deepmind', repo: 'alphafold' },
  { owner: 'huggingface', repo: 'transformers' },
  { owner: 'EleutherAI', repo: 'gpt-neox' },
  { owner: 'microsoft', repo: 'autogen' },
  { owner: 'langchain-ai', repo: 'langchain' },
];

let octokit: Octokit | null = null;

/**
 * Initialize GitHub API client
 */
function getGitHubClient(): Octokit {
  if (octokit) return octokit;

  const token = process.env.GITHUB_TOKEN;

  octokit = new Octokit({
    auth: token,
    userAgent: 'AGI-Detector-Bot/1.0',
    request: {
      timeout: 30000,
    },
  });

  if (!token) {
    console.warn('[GitHub] No auth token, using unauthenticated API (60 req/hr limit)');
  } else {
    console.log('[GitHub] Client initialized with authentication (5000 req/hr)');
  }

  return octokit;
}

/**
 * Search for AGI-related repositories
 */
export async function searchAGIRepositories(
  minStars: number = 100,
  daysBack: number = 30
): Promise<GitHubRepo[]> {
  const client = getGitHubClient();
  const results: GitHubRepo[] = [];

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - daysBack);
  const dateStr = sinceDate.toISOString().split('T')[0];

  for (const keyword of AGI_KEYWORDS) {
    try {
      console.log(`[GitHub] Searching repositories for: ${keyword}`);

      const response = await client.search.repos({
        q: `${keyword} stars:>${minStars} created:>${dateStr}`,
        sort: 'stars',
        order: 'desc',
        per_page: 10,
      });

      for (const repo of response.data.items) {
        if (!repo.owner) continue;
        const readme = await fetchReadme(repo.owner.login, repo.name);

        results.push({
          title: repo.name,
          content: readme || repo.description || '',
          url: repo.html_url,
          metadata: {
            source: 'GitHub',
            timestamp: new Date().toISOString(),
            id: repo.id.toString(),
            repoName: repo.full_name,
            stars: repo.stargazers_count,
            language: repo.language || 'Unknown',
            topics: repo.topics || [],
            hasCode: true,
          },
        });
      }

      // Rate limiting: 1 second between searches
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error: any) {
      if (error.status === 403) {
        console.error('[GitHub] Rate limit exceeded, add GITHUB_TOKEN to .env.local');
        break;
      }
      console.error(`[GitHub] Error searching for ${keyword}:`, error.message);
    }
  }

  return results;
}

/**
 * Monitor trending repositories in AI/ML
 */
export async function monitorTrendingAI(): Promise<GitHubRepo[]> {
  const client = getGitHubClient();
  const results: GitHubRepo[] = [];

  try {
    console.log('[GitHub] Fetching trending AI/ML repositories...');

    // Search for recently active AI repos
    const response = await client.search.repos({
      q: 'machine-learning OR artificial-intelligence OR deep-learning stars:>500 pushed:>2024-11-01',
      sort: 'stars',
      order: 'desc',
      per_page: 20,
    });

    for (const repo of response.data.items) {
      if (!repo.owner) continue;
      // Check if repo is gaining stars rapidly
      const weeklyStars = await getWeeklyStarGrowth(repo.owner.login, repo.name);

      // High signal: >100 stars in last week
      if (weeklyStars && weeklyStars > 100) {
        const readme = await fetchReadme(repo.owner.login, repo.name);

        results.push({
          title: repo.name,
          content: readme || repo.description || '',
          url: repo.html_url,
          metadata: {
            source: 'GitHub',
            timestamp: new Date().toISOString(),
            id: repo.id.toString(),
            repoName: repo.full_name,
            stars: repo.stargazers_count,
            language: repo.language || 'Unknown',
            topics: repo.topics || [],
            weeklyStars,
            hasCode: true,
          },
        });

        console.log(`[GitHub] 🔥 ${repo.full_name}: +${weeklyStars} stars this week`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

  } catch (error: any) {
    console.error('[GitHub] Error monitoring trending:', error.message);
  }

  return results;
}

/**
 * Monitor releases from key AI organizations
 */
export async function monitorKeyReleases(): Promise<GitHubRepo[]> {
  const client = getGitHubClient();
  const results: GitHubRepo[] = [];

  for (const { owner, repo } of WATCH_REPOS) {
    try {
      console.log(`[GitHub] Checking releases for ${owner}/${repo}...`);

      // Get recent releases
      const releases = await client.repos.listReleases({
        owner,
        repo,
        per_page: 3,
      });

      for (const release of releases.data) {
        // Only include recent releases (last 7 days)
        const releaseDate = new Date(release.published_at || release.created_at || Date.now());
        const daysSince = (Date.now() - releaseDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSince <= 7) {
          results.push({
            title: `${repo}: ${release.name || release.tag_name}`,
            content: release.body || '',
            url: release.html_url,
            metadata: {
              source: 'GitHub Release',
              timestamp: new Date().toISOString(),
              id: release.id.toString(),
              repoName: `${owner}/${repo}`,
              stars: 0 as number, // Releases don't have stars
              language: 'Release',
              topics: [],
              hasCode: false,
            },
          });

          console.log(`[GitHub] 📦 New release: ${owner}/${repo} - ${release.tag_name}`);
        }
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error: any) {
      if (error.status === 404) {
        console.warn(`[GitHub] Repo not found: ${owner}/${repo}`);
      } else {
        console.error(`[GitHub] Error fetching releases for ${owner}/${repo}:`, error.message);
      }
    }
  }

  return results;
}

/**
 * Fetch README content
 */
async function fetchReadme(owner: string, repo: string): Promise<string | null> {
  const client = getGitHubClient();

  try {
    const response = await client.repos.getReadme({ owner, repo });
    const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
    return content.substring(0, 5000); // Limit to first 5000 chars
  } catch (error) {
    return null;
  }
}

/**
 * Estimate weekly star growth (simplified)
 */
async function getWeeklyStarGrowth(owner: string, repo: string): Promise<number | null> {
  const client = getGitHubClient();

  try {
    // Get stargazers with timestamps (requires additional API calls, so we estimate)
    // For simplicity, we'll use a heuristic based on total stars and creation date
    const repoData = await client.repos.get({ owner, repo });
    const createdAt = new Date(repoData.data.created_at);
    const daysSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const avgStarsPerDay = repoData.data.stargazers_count / daysSinceCreation;
    const estimatedWeeklyStars = avgStarsPerDay * 7;

    // If repo is very new (<30 days) and has many stars, likely trending
    if (daysSinceCreation < 30 && repoData.data.stargazers_count > 1000) {
      return estimatedWeeklyStars;
    }

    return null; // Not enough data
  } catch (error) {
    return null;
  }
}

/**
 * Monitor specific organization activity
 */
export async function monitorOrganization(orgName: string): Promise<GitHubRepo[]> {
  const client = getGitHubClient();
  const results: GitHubRepo[] = [];

  try {
    console.log(`[GitHub] Monitoring organization: ${orgName}`);

    // Get recent repos
    const repos = await client.repos.listForOrg({
      org: orgName,
      sort: 'updated',
      per_page: 10,
    });

    for (const repo of repos.data) {
      // Check if updated in last 7 days
      const updatedAt = new Date(repo.updated_at);
      const daysSince = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSince <= 7) {
        const readme = await fetchReadme(repo.owner.login, repo.name);

        results.push({
          title: repo.name,
          content: readme || repo.description || '',
          url: repo.html_url,
          metadata: {
            source: `GitHub (${orgName})`,
            timestamp: new Date().toISOString(),
            id: repo.id.toString(),
            repoName: repo.full_name,
            stars: repo.stargazers_count,
            language: repo.language || 'Unknown',
            topics: repo.topics || [],
            hasCode: true,
          },
        });
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

  } catch (error: any) {
    console.error(`[GitHub] Error monitoring ${orgName}:`, error.message);
  }

  return results;
}

/**
 * Comprehensive GitHub monitoring
 * Combines trending, releases, and keyword searches
 */
export async function fetchAllGitHubSources(): Promise<GitHubRepo[]> {
  console.log('[GitHub] Starting comprehensive monitoring...');

  const results: GitHubRepo[] = [];

  // 1. Search for AGI keywords
  const agiRepos = await searchAGIRepositories(100, 30);
  results.push(...agiRepos);

  // 2. Monitor trending AI repos
  const trending = await monitorTrendingAI();
  results.push(...trending);

  // 3. Check key releases
  const releases = await monitorKeyReleases();
  results.push(...releases);

  // Deduplicate by repo ID
  const uniqueResults = Array.from(
    new Map(results.map(item => [item.metadata.id, item])).values()
  );

  console.log(`[GitHub] Total unique items found: ${uniqueResults.length}`);
  return uniqueResults;
}

/**
 * Environment variable needed:
 *
 * GITHUB_TOKEN=ghp_your_personal_access_token
 *
 * Get token at: https://github.com/settings/tokens
 * Scopes needed: public_repo (read access)
 */
