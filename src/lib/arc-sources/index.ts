/**
 * Unified ARC-AGI Data Sources
 * Aggregates data from Official Leaderboard, Kaggle, and GitHub
 */

import {
  crawlARCLeaderboard,
  leaderboardToCrawlResults,
  cleanupARCBrowser,
  ARCLeaderboardResult
} from './official-leaderboard';

import {
  getARCKaggleLeaderboard,
  getCompetitionInfo,
  detectBreakthroughs,
  kaggleLeaderboardToCrawlResults,
  KaggleLeaderboardEntry,
  KaggleCompetitionInfo
} from './kaggle-integration';

import {
  fetchAllARCActivity,
  fetchARCDiscussions,
  fetchARCReleases,
  fetchARCCommits,
  searchARCApproaches,
  detectSignificantActivity,
  githubActivityToCrawlResults,
  GitHubRepoActivity,
  GitHubDiscussion,
  GitHubRelease,
  GitHubCommit,
  GitHubRepo
} from './github-monitor';

// Re-export all types
export type {
  ARCLeaderboardResult,
  KaggleLeaderboardEntry,
  KaggleCompetitionInfo,
  GitHubRepoActivity,
  GitHubDiscussion,
  GitHubRelease,
  GitHubCommit,
  GitHubRepo
};

export interface ARCAggregatedData {
  official: ARCLeaderboardResult | null;
  kaggle: KaggleLeaderboardEntry[];
  github: GitHubRepoActivity | null;
  timestamp: string;
  summary: ARCSummary;
}

export interface ARCSummary {
  topScore: number;
  humanBaseline: number;
  gapToHuman: number;
  totalTeams: number;
  recentActivity: number;
  significantEvents: SignificantEvent[];
}

export interface SignificantEvent {
  type: 'score_jump' | 'new_approach' | 'major_release' | 'discussion';
  title: string;
  description: string;
  url: string;
  date: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Fetch all ARC data from all sources
 * Returns aggregated data with summary statistics
 */
export async function fetchAllARCData(): Promise<ARCAggregatedData> {
  console.log('[ARC Sources] Fetching data from all sources...');

  const [official, kaggle, github] = await Promise.allSettled([
    crawlARCLeaderboard(),
    getARCKaggleLeaderboard(),
    fetchAllARCActivity()
  ]);

  const officialData = official.status === 'fulfilled' ? official.value : null;
  const kaggleData = kaggle.status === 'fulfilled' ? kaggle.value : [];
  const githubData = github.status === 'fulfilled' ? github.value : null;

  // Calculate summary statistics
  const topScore = Math.max(
    officialData?.topScore || 0,
    kaggleData.length > 0 ? Math.max(...kaggleData.map(e => e.score)) : 0
  );

  const significantEvents = detectAllSignificantEvents(officialData, kaggleData, githubData);

  const summary: ARCSummary = {
    topScore,
    humanBaseline: 1.0, // 100% human performance
    gapToHuman: 1.0 - topScore,
    totalTeams: Math.max(
      officialData?.entries.length || 0,
      kaggleData.length
    ),
    recentActivity: (githubData?.discussions.length || 0) +
                    (githubData?.commits.length || 0),
    significantEvents
  };

  console.log(`[ARC Sources] Aggregated data - Top score: ${(topScore * 100).toFixed(1)}%, Gap to human: ${((1 - topScore) * 100).toFixed(1)}%`);

  return {
    official: officialData,
    kaggle: kaggleData,
    github: githubData,
    timestamp: new Date().toISOString(),
    summary
  };
}

/**
 * Detect significant events across all sources
 */
function detectAllSignificantEvents(
  official: ARCLeaderboardResult | null,
  kaggle: KaggleLeaderboardEntry[],
  github: GitHubRepoActivity | null
): SignificantEvent[] {
  const events: SignificantEvent[] = [];

  // Check for high scores (>10% is significant, >25% is critical)
  const maxScore = Math.max(
    official?.topScore || 0,
    kaggle.length > 0 ? Math.max(...kaggle.map(e => e.score)) : 0
  );

  if (maxScore > 0.25) {
    events.push({
      type: 'score_jump',
      title: 'Major Capability Leap Detected',
      description: `Top ARC-AGI score exceeds 25% - significant progress toward human-level performance`,
      url: 'https://arcprize.org/leaderboard',
      date: new Date().toISOString(),
      severity: 'critical'
    });
  } else if (maxScore > 0.10) {
    events.push({
      type: 'score_jump',
      title: 'Significant Breakthrough',
      description: `Top ARC-AGI score exceeds 10% - notable improvement over previous SOTA`,
      url: 'https://arcprize.org/leaderboard',
      date: new Date().toISOString(),
      severity: 'high'
    });
  }

  // Check Kaggle for score improvements
  const breakthroughs = kaggle.filter(e => e.delta && e.delta > 0.05);
  breakthroughs.forEach(entry => {
    events.push({
      type: 'score_jump',
      title: `${entry.teamName} improved by ${((entry.delta || 0) * 100).toFixed(1)}%`,
      description: `Team "${entry.teamName}" achieved ${(entry.score * 100).toFixed(1)}% on ARC-AGI-2`,
      url: 'https://www.kaggle.com/competitions/arc-agi-2025/leaderboard',
      date: entry.submissionDate,
      severity: entry.delta && entry.delta > 0.10 ? 'high' : 'medium'
    });
  });

  // Check GitHub for significant activity
  if (github) {
    const significant = detectSignificantActivity(github);
    significant.forEach(item => {
      events.push({
        type: item.type === 'discussion' ? 'new_approach' : 'discussion',
        title: item.title,
        description: item.significance,
        url: item.url,
        date: item.date,
        severity: 'medium'
      });
    });

    // Check for major releases
    github.releases.forEach(release => {
      events.push({
        type: 'major_release',
        title: `ARC-AGI Release: ${release.name}`,
        description: release.body.slice(0, 200),
        url: release.url,
        date: release.publishedAt,
        severity: 'medium'
      });
    });
  }

  // Sort by severity (critical first) then by date
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  events.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return events;
}

/**
 * Convert all ARC data to crawl results for storage
 */
export function arcDataToCrawlResults(data: ARCAggregatedData): any[] {
  const results: any[] = [];

  // Add official leaderboard results
  if (data.official) {
    results.push(...leaderboardToCrawlResults(data.official));
  }

  // Add Kaggle results
  if (data.kaggle.length > 0) {
    results.push(...kaggleLeaderboardToCrawlResults(data.kaggle));
  }

  // Add GitHub activity
  if (data.github) {
    results.push(...githubActivityToCrawlResults(data.github));
  }

  // Add summary as a special result
  results.push({
    title: `ARC-AGI Progress Summary: ${(data.summary.topScore * 100).toFixed(1)}% (Gap: ${(data.summary.gapToHuman * 100).toFixed(1)}%)`,
    content: `Current top score on ARC-AGI-2: ${(data.summary.topScore * 100).toFixed(1)}%. Human baseline: 100%. Gap to human-level: ${(data.summary.gapToHuman * 100).toFixed(1)}%. ${data.summary.totalTeams} teams competing. ${data.summary.significantEvents.length} significant events detected. When no remaining tasks challenge AI while remaining accessible to humans, AGI is achieved.`,
    url: 'https://arcprize.org/',
    metadata: {
      source: 'ARC-AGI Aggregated',
      timestamp: data.timestamp,
      id: `arc-summary-${Date.now()}`,
      type: 'benchmark_summary',
      topScore: data.summary.topScore,
      gap: data.summary.gapToHuman,
      eventCount: data.summary.significantEvents.length
    }
  });

  return results;
}

/**
 * Get AGI progress percentage based on ARC scores
 * 0% = Current AI capabilities (baseline ~4%)
 * 100% = Human-level performance (100% ARC score)
 */
export function calculateAGIProgress(topScore: number): {
  progress: number;
  status: 'baseline' | 'improving' | 'significant' | 'breakthrough' | 'near_agi' | 'agi';
  description: string;
} {
  // Normalize: 4% is baseline (0% progress), 100% is AGI (100% progress)
  const baseline = 0.04; // Current SOTA (o3-preview-low)
  const normalized = Math.max(0, (topScore - baseline) / (1 - baseline)) * 100;

  let status: 'baseline' | 'improving' | 'significant' | 'breakthrough' | 'near_agi' | 'agi';
  let description: string;

  if (topScore >= 1.0) {
    status = 'agi';
    description = 'AGI achieved - AI matches human performance on novel reasoning tasks';
  } else if (topScore >= 0.75) {
    status = 'near_agi';
    description = 'Near AGI - AI exceeds most humans on abstract reasoning';
  } else if (topScore >= 0.50) {
    status = 'breakthrough';
    description = 'Major breakthrough - significant progress toward human-level';
  } else if (topScore >= 0.25) {
    status = 'significant';
    description = 'Significant advancement - clear improvement over baseline';
  } else if (topScore >= 0.10) {
    status = 'improving';
    description = 'Notable improvement - above baseline capabilities';
  } else {
    status = 'baseline';
    description = 'Baseline - current AI capabilities on novel reasoning';
  }

  return {
    progress: Math.min(100, Math.max(0, normalized)),
    status,
    description
  };
}

/**
 * Cleanup resources (browser instances, etc.)
 */
export async function cleanupARCSources(): Promise<void> {
  await cleanupARCBrowser();
}

// Re-export individual source functions for direct access
export {
  crawlARCLeaderboard,
  leaderboardToCrawlResults,
  getARCKaggleLeaderboard,
  getCompetitionInfo,
  detectBreakthroughs,
  kaggleLeaderboardToCrawlResults,
  fetchAllARCActivity,
  fetchARCDiscussions,
  fetchARCReleases,
  fetchARCCommits,
  searchARCApproaches,
  detectSignificantActivity,
  githubActivityToCrawlResults
};
