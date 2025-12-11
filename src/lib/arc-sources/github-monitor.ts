/**
 * GitHub Repository Monitor for ARC-AGI
 * Tracks discussions, releases, commits, and novel approaches
 *
 * Monitors: arcprize/ARC-AGI-2 and related repositories
 * Requires: GITHUB_TOKEN for higher rate limits (optional but recommended)
 */

import axios from 'axios';

export interface GitHubDiscussion {
  id: number;
  title: string;
  body: string;
  url: string;
  author: string;
  createdAt: string;
  category: string;
  comments: number;
}

export interface GitHubRelease {
  id: number;
  name: string;
  tagName: string;
  body: string;
  url: string;
  publishedAt: string;
  author: string;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

export interface GitHubRepo {
  name: string;
  description: string;
  url: string;
  stars: number;
  updatedAt: string;
  language: string | null;
}

export interface GitHubRepoActivity {
  discussions: GitHubDiscussion[];
  releases: GitHubRelease[];
  commits: GitHubCommit[];
  repos: GitHubRepo[];
  timestamp: string;
}

const GITHUB_API_BASE = 'https://api.github.com';
const ARC_REPO = 'arcprize/ARC-AGI-2';

/**
 * Get GitHub auth headers
 */
function getGitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'AGI-Detector/1.0'
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Fetch recent discussions from ARC-AGI-2 repository
 */
export async function fetchARCDiscussions(): Promise<GitHubDiscussion[]> {
  try {
    console.log('[GitHub] Fetching ARC-AGI-2 discussions...');

    // Note: Discussions API requires GraphQL
    // Fallback to issues for simpler integration
    const response = await axios.get(
      `${GITHUB_API_BASE}/repos/${ARC_REPO}/issues`,
      {
        headers: getGitHubHeaders(),
        params: {
          state: 'all',
          sort: 'created',
          direction: 'desc',
          per_page: 20
        },
        timeout: 15000
      }
    );

    const discussions: GitHubDiscussion[] = response.data.map((issue: any) => ({
      id: issue.id,
      title: issue.title,
      body: issue.body?.slice(0, 500) || '',
      url: issue.html_url,
      author: issue.user?.login || 'unknown',
      createdAt: issue.created_at,
      category: issue.labels?.map((l: any) => l.name).join(', ') || 'general',
      comments: issue.comments || 0
    }));

    console.log(`[GitHub] Found ${discussions.length} discussions/issues`);
    return discussions;
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log('[GitHub] Repository not found or discussions disabled');
    } else if (error.response?.status === 403) {
      console.warn('[GitHub] Rate limited - consider setting GITHUB_TOKEN');
    } else {
      console.error('[GitHub] Error fetching discussions:', error.message);
    }
    return [];
  }
}

/**
 * Fetch recent releases from ARC-AGI-2 repository
 */
export async function fetchARCReleases(): Promise<GitHubRelease[]> {
  try {
    console.log('[GitHub] Fetching ARC-AGI-2 releases...');

    const response = await axios.get(
      `${GITHUB_API_BASE}/repos/${ARC_REPO}/releases`,
      {
        headers: getGitHubHeaders(),
        params: { per_page: 10 },
        timeout: 15000
      }
    );

    const releases: GitHubRelease[] = response.data.map((release: any) => ({
      id: release.id,
      name: release.name || release.tag_name,
      tagName: release.tag_name,
      body: release.body?.slice(0, 500) || '',
      url: release.html_url,
      publishedAt: release.published_at,
      author: release.author?.login || 'unknown'
    }));

    console.log(`[GitHub] Found ${releases.length} releases`);
    return releases;
  } catch (error) {
    console.error('[GitHub] Error fetching releases:', error);
    return [];
  }
}

/**
 * Fetch recent commits from ARC-AGI-2 repository
 */
export async function fetchARCCommits(): Promise<GitHubCommit[]> {
  try {
    console.log('[GitHub] Fetching ARC-AGI-2 commits...');

    const response = await axios.get(
      `${GITHUB_API_BASE}/repos/${ARC_REPO}/commits`,
      {
        headers: getGitHubHeaders(),
        params: { per_page: 20 },
        timeout: 15000
      }
    );

    const commits: GitHubCommit[] = response.data.map((commit: any) => ({
      sha: commit.sha,
      message: commit.commit?.message?.slice(0, 200) || '',
      author: commit.commit?.author?.name || commit.author?.login || 'unknown',
      date: commit.commit?.author?.date || new Date().toISOString(),
      url: commit.html_url
    }));

    console.log(`[GitHub] Found ${commits.length} recent commits`);
    return commits;
  } catch (error) {
    console.error('[GitHub] Error fetching commits:', error);
    return [];
  }
}

/**
 * Search for ARC-related repositories with novel approaches
 * Finds other teams' implementations, not just the official repo
 */
export async function searchARCApproaches(): Promise<GitHubRepo[]> {
  try {
    console.log('[GitHub] Searching for ARC-related repositories...');

    const response = await axios.get(
      `${GITHUB_API_BASE}/search/repositories`,
      {
        headers: getGitHubHeaders(),
        params: {
          q: 'ARC-AGI OR "Abstract Reasoning Corpus" OR arc-prize OR "ARC challenge"',
          sort: 'updated',
          order: 'desc',
          per_page: 20
        },
        timeout: 15000
      }
    );

    const repos: GitHubRepo[] = response.data.items?.map((repo: any) => ({
      name: repo.full_name,
      description: repo.description?.slice(0, 200) || '',
      url: repo.html_url,
      stars: repo.stargazers_count || 0,
      updatedAt: repo.updated_at,
      language: repo.language || null
    })) || [];

    console.log(`[GitHub] Found ${repos.length} ARC-related repositories`);
    return repos;
  } catch (error: any) {
    if (error.response?.status === 403) {
      console.warn('[GitHub] Rate limited on search - consider setting GITHUB_TOKEN');
    } else {
      console.error('[GitHub] Error searching repositories:', error.message);
    }
    return [];
  }
}

/**
 * Fetch all ARC-AGI GitHub activity
 * Includes official repo activity + community implementations
 */
export async function fetchAllARCActivity(): Promise<GitHubRepoActivity> {
  const [discussions, releases, commits, repos] = await Promise.all([
    fetchARCDiscussions(),
    fetchARCReleases(),
    fetchARCCommits(),
    searchARCApproaches()
  ]);

  return {
    discussions,
    releases,
    commits,
    repos,
    timestamp: new Date().toISOString()
  };
}

/**
 * Detect significant activity (new approaches, major updates)
 */
export function detectSignificantActivity(activity: GitHubRepoActivity): any[] {
  const significant: any[] = [];

  // Check for approach-related discussions
  const approachKeywords = ['solution', 'approach', 'method', 'technique', 'breakthrough', 'novel'];
  activity.discussions.forEach(d => {
    const text = `${d.title} ${d.body}`.toLowerCase();
    if (approachKeywords.some(k => text.includes(k))) {
      significant.push({
        type: 'discussion',
        title: d.title,
        url: d.url,
        date: d.createdAt,
        significance: 'Novel approach mentioned'
      });
    }
  });

  // Check for benchmark/score mentions
  activity.commits.forEach(c => {
    const msg = c.message.toLowerCase();
    if (msg.includes('score') || msg.includes('benchmark') || msg.includes('improvement')) {
      significant.push({
        type: 'commit',
        title: c.message,
        url: c.url,
        date: c.date,
        significance: 'Benchmark-related update'
      });
    }
  });

  return significant;
}

/**
 * Convert GitHub activity to crawl results for storage
 */
export function githubActivityToCrawlResults(activity: GitHubRepoActivity): any[] {
  const results: any[] = [];

  // Add discussions
  activity.discussions.slice(0, 5).forEach(d => {
    results.push({
      title: `ARC-AGI GitHub: ${d.title}`,
      content: `Discussion by ${d.author} in ARC-AGI-2 repository: ${d.body}. Category: ${d.category}. ${d.comments} comments.`,
      url: d.url,
      metadata: {
        source: 'ARC GitHub Discussions',
        timestamp: d.createdAt,
        id: `github-discussion-${d.id}`,
        type: 'discussion'
      }
    });
  });

  // Add releases
  activity.releases.forEach(r => {
    results.push({
      title: `ARC-AGI Release: ${r.name}`,
      content: `New release ${r.tagName} published by ${r.author}: ${r.body}`,
      url: r.url,
      metadata: {
        source: 'ARC GitHub Releases',
        timestamp: r.publishedAt,
        id: `github-release-${r.id}`,
        type: 'release'
      }
    });
  });

  // Add community ARC implementations (sorted by stars)
  const sortedRepos = [...activity.repos].sort((a, b) => b.stars - a.stars);
  sortedRepos.slice(0, 10).forEach(repo => {
    results.push({
      title: `ARC Implementation: ${repo.name}`,
      content: `Community ARC-AGI implementation: ${repo.description}. Language: ${repo.language || 'Unknown'}. Stars: ${repo.stars}. This repository may contain novel approaches to the ARC-AGI challenge.`,
      url: repo.url,
      metadata: {
        source: 'ARC GitHub Implementations',
        timestamp: repo.updatedAt,
        id: `github-repo-${repo.name.replace('/', '-')}`,
        type: 'implementation',
        stars: repo.stars,
        language: repo.language
      }
    });
  });

  return results;
}
