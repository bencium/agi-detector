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
  sourceStatus: 'live' | 'cached_fresh' | 'cached_stale' | 'manual_snapshot' | 'unavailable';
  benchmarkEvidence: ARCBenchmarkEvidence;
}

export interface ARCBenchmarkEvidence {
  benchmark: 'ARC-AGI-2';
  topScore: number;
  status: 'baseline' | 'watch' | 'notable' | 'strong' | 'exceptional';
  watchPriority: 'low' | 'medium' | 'high' | 'critical';
  evidenceConfidence: 'none' | 'weak' | 'moderate' | 'strong';
  sourceStatus: 'live' | 'cached_fresh' | 'cached_stale' | 'manual_snapshot' | 'unavailable';
  interpretation: string;
  limitations: string[];
  requiredVerification: string[];
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
  const sourceStatus = getAggregateSourceStatus(officialData, kaggleData);
  const benchmarkEvidence = classifyARCBenchmarkEvidence(topScore, sourceStatus);

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
    significantEvents,
    sourceStatus,
    benchmarkEvidence
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

  // Check for high ARC-AGI scores. These are benchmark watch signals, not
  // direct AGI/ASI claims.
  const maxScore = Math.max(
    official?.topScore || 0,
    kaggle.length > 0 ? Math.max(...kaggle.map(e => e.score)) : 0
  );

  if (maxScore > 0.25) {
    events.push({
      type: 'score_jump',
      title: 'Major ARC-AGI Benchmark Movement',
      description: `Top ARC-AGI score exceeds 25%. This is a high-watch benchmark signal, not proof of AGI.`,
      url: 'https://arcprize.org/leaderboard',
      date: new Date().toISOString(),
      severity: 'high'
    });
  } else if (maxScore > 0.10) {
    events.push({
      type: 'score_jump',
      title: 'Notable ARC-AGI Benchmark Movement',
      description: `Top ARC-AGI score exceeds 10%. This should be reviewed with source freshness and corroboration.`,
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
    title: `ARC-AGI Benchmark Signal: ${(data.summary.topScore * 100).toFixed(1)}% (Gap: ${(data.summary.gapToHuman * 100).toFixed(1)}%)`,
    content: `Current top score on ARC-AGI-2: ${(data.summary.topScore * 100).toFixed(1)}%. Human baseline: 100%. Gap to human-level on this benchmark: ${(data.summary.gapToHuman * 100).toFixed(1)}%. ${data.summary.totalTeams} teams competing. ${data.summary.significantEvents.length} significant events detected. ARC-AGI is benchmark evidence only and cannot, by itself, establish AGI or ASI.`,
    url: 'https://arcprize.org/',
    metadata: {
      source: 'ARC-AGI Aggregated',
      timestamp: data.timestamp,
      id: `arc-summary-${Date.now()}`,
      type: 'benchmark_summary',
      topScore: data.summary.topScore,
      gap: data.summary.gapToHuman,
      eventCount: data.summary.significantEvents.length,
      sourceStatus: data.summary.sourceStatus,
      benchmarkEvidence: data.summary.benchmarkEvidence
    }
  });

  return results;
}

/**
 * Classify ARC scores as benchmark evidence.
 * This deliberately does not return "AGI" or "near AGI": one benchmark is
 * a signal, not a conclusion.
 */
export function calculateAGIProgress(topScore: number): {
  progress: number;
  status: 'baseline' | 'watch' | 'notable' | 'strong' | 'exceptional';
  description: string;
} {
  // Normalize against the original ARC-AGI-2 launch baseline for charting only.
  const baseline = 0.04;
  const normalized = Math.max(0, (topScore - baseline) / (1 - baseline)) * 100;

  let status: 'baseline' | 'watch' | 'notable' | 'strong' | 'exceptional';
  let description: string;

  if (topScore >= 0.75) {
    status = 'exceptional';
    description = 'Exceptional ARC-AGI benchmark result - requires independent review and broader evidence';
  } else if (topScore >= 0.50) {
    status = 'strong';
    description = 'Strong ARC-AGI benchmark signal - not sufficient alone for an AGI conclusion';
  } else if (topScore >= 0.25) {
    status = 'notable';
    description = 'Notable ARC-AGI benchmark movement - needs corroboration and method review';
  } else if (topScore >= 0.10) {
    status = 'watch';
    description = 'ARC-AGI watch signal - above launch baseline, but not an AGI claim';
  } else {
    status = 'baseline';
    description = 'Baseline ARC-AGI benchmark signal';
  }

  return {
    progress: Math.min(100, Math.max(0, normalized)),
    status,
    description
  };
}

export function classifyARCBenchmarkEvidence(
  topScore: number,
  sourceStatus: ARCBenchmarkEvidence['sourceStatus'] = 'live'
): ARCBenchmarkEvidence {
  const progress = calculateAGIProgress(topScore);
  const stale = sourceStatus === 'cached_stale' || sourceStatus === 'manual_snapshot' || sourceStatus === 'unavailable';
  const watchPriority: ARCBenchmarkEvidence['watchPriority'] =
    progress.status === 'exceptional' ? 'critical' :
    progress.status === 'strong' ? 'high' :
    progress.status === 'notable' ? 'high' :
    progress.status === 'watch' ? 'medium' :
    'low';
  const evidenceConfidence: ARCBenchmarkEvidence['evidenceConfidence'] =
    sourceStatus === 'live' ? 'strong' :
    sourceStatus === 'cached_fresh' ? 'moderate' :
    sourceStatus === 'unavailable' ? 'none' :
    'weak';

  return {
    benchmark: 'ARC-AGI-2',
    topScore,
    status: progress.status,
    watchPriority,
    evidenceConfidence,
    sourceStatus,
    interpretation: progress.description,
    limitations: [
      'ARC-AGI is one benchmark signal, not an AGI or ASI meter.',
      'Scores require method review for leakage, cost, compute, and reproducibility.',
      ...(stale ? ['This result is not fresh live evidence.'] : [])
    ],
    requiredVerification: [
      'Fresh primary-source leaderboard or official result',
      'Method details and cost/task context',
      'Independent corroboration outside the benchmark page'
    ]
  };
}

function getAggregateSourceStatus(
  official: ARCLeaderboardResult | null,
  kaggle: KaggleLeaderboardEntry[]
): ARCSummary['sourceStatus'] {
  if (official?.sourceStatus === 'live' || kaggle.length > 0) return 'live';
  if (official?.sourceStatus === 'manual_snapshot') return 'manual_snapshot';
  if (official?.sourceStatus === 'unavailable') return 'unavailable';
  return 'unavailable';
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
