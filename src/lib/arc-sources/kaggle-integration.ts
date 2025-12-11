/**
 * Kaggle API Integration for ARC-AGI Competition
 * Tracks leaderboard scores, submissions, and breakthrough approaches
 *
 * Requires: KAGGLE_USERNAME and KAGGLE_KEY environment variables
 * Get credentials from: https://www.kaggle.com/account -> Create New Token
 */

import axios from 'axios';

export interface KaggleLeaderboardEntry {
  teamName: string;
  teamId: number;
  score: number;
  submissionDate: string;
  rank: number;
  delta?: number; // Score change from previous
}

export interface KaggleCompetitionInfo {
  title: string;
  description: string;
  deadline: string;
  prize: string;
  totalTeams: number;
  leaderboard: KaggleLeaderboardEntry[];
}

// Kaggle API base URL
const KAGGLE_API_BASE = 'https://www.kaggle.com/api/v1';

/**
 * Create Kaggle API client with authentication
 */
function getKaggleAuth(): { username: string; key: string } | null {
  const username = process.env.KAGGLE_USERNAME;
  const key = process.env.KAGGLE_KEY;

  if (!username || !key) {
    console.warn('[Kaggle] Missing KAGGLE_USERNAME or KAGGLE_KEY environment variables');
    return null;
  }

  return { username, key };
}

/**
 * Fetch ARC-AGI competition leaderboard from Kaggle API
 */
export async function getARCKaggleLeaderboard(
  competitionSlug = 'arc-prize-2025'
): Promise<KaggleLeaderboardEntry[]> {
  const auth = getKaggleAuth();
  if (!auth) {
    console.log('[Kaggle] Skipping - no credentials configured');
    return [];
  }

  try {
    console.log(`[Kaggle] Fetching leaderboard for ${competitionSlug}...`);

    const response = await axios.get(
      `${KAGGLE_API_BASE}/competitions/${competitionSlug}/leaderboard`,
      {
        auth: {
          username: auth.username,
          password: auth.key
        },
        headers: {
          'Accept': 'application/json',
        },
        timeout: 30000
      }
    );

    const entries: KaggleLeaderboardEntry[] = (response.data.submissions || response.data || [])
      .slice(0, 50) // Top 50 entries
      .map((entry: any, index: number) => ({
        teamName: entry.teamName || entry.displayName || `Team ${index + 1}`,
        teamId: entry.teamId || entry.id || index,
        score: parseFloat(entry.score || entry.publicScore || 0),
        submissionDate: entry.submissionDate || entry.date || new Date().toISOString(),
        rank: entry.rank || index + 1,
      }));

    console.log(`[Kaggle] Found ${entries.length} leaderboard entries`);
    return entries;
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.error('[Kaggle] Authentication failed - check KAGGLE_USERNAME and KAGGLE_KEY');
    } else if (error.response?.status === 404) {
      console.error(`[Kaggle] Competition "${competitionSlug}" not found`);
    } else {
      console.error('[Kaggle] Error fetching leaderboard:', error.message);
    }
    return [];
  }
}

/**
 * Get competition details and metadata
 */
export async function getCompetitionInfo(
  competitionSlug = 'arc-prize-2025'
): Promise<KaggleCompetitionInfo | null> {
  const auth = getKaggleAuth();
  if (!auth) return null;

  try {
    const response = await axios.get(
      `${KAGGLE_API_BASE}/competitions/${competitionSlug}`,
      {
        auth: {
          username: auth.username,
          password: auth.key
        },
        timeout: 30000
      }
    );

    const data = response.data;
    const leaderboard = await getARCKaggleLeaderboard(competitionSlug);

    return {
      title: data.title || 'ARC-AGI-2',
      description: data.description || 'Abstract and Reasoning Corpus benchmark',
      deadline: data.deadline || data.enabledDate || 'Unknown',
      prize: data.rewardQuantity ? `$${data.rewardQuantity}` : 'Unknown',
      totalTeams: data.teamCount || leaderboard.length,
      leaderboard
    };
  } catch (error) {
    console.error('[Kaggle] Error fetching competition info:', error);
    return null;
  }
}

/**
 * Track score improvements for a specific team
 */
export async function trackTeamProgress(
  teamName: string,
  previousScore: number
): Promise<{ improved: boolean; delta: number; newScore: number } | null> {
  const leaderboard = await getARCKaggleLeaderboard();
  const team = leaderboard.find(e => e.teamName.toLowerCase().includes(teamName.toLowerCase()));

  if (!team) return null;

  const delta = team.score - previousScore;
  return {
    improved: delta > 0,
    delta,
    newScore: team.score
  };
}

/**
 * Detect significant breakthroughs (>5% improvement)
 */
export function detectBreakthroughs(
  current: KaggleLeaderboardEntry[],
  previous: KaggleLeaderboardEntry[]
): KaggleLeaderboardEntry[] {
  const previousMap = new Map(previous.map(e => [e.teamName, e.score]));

  return current.filter(entry => {
    const prevScore = previousMap.get(entry.teamName);
    if (prevScore === undefined) return false;

    const delta = entry.score - prevScore;
    return delta > 0.05; // 5% improvement threshold
  }).map(entry => ({
    ...entry,
    delta: entry.score - (previousMap.get(entry.teamName) || 0)
  }));
}

/**
 * Convert Kaggle leaderboard to crawl results for storage
 */
export function kaggleLeaderboardToCrawlResults(entries: KaggleLeaderboardEntry[]): any[] {
  const topScore = entries.length > 0 ? Math.max(...entries.map(e => e.score)) : 0;

  return entries.slice(0, 10).map(entry => ({
    title: `ARC-AGI Kaggle: ${entry.teamName} - ${(entry.score * 100).toFixed(1)}%`,
    content: `Team "${entry.teamName}" ranked #${entry.rank} in ARC-AGI Kaggle competition with score ${(entry.score * 100).toFixed(1)}%. ${entry.delta && entry.delta > 0 ? `Improved by ${(entry.delta * 100).toFixed(1)}% since last check.` : ''} Competition top score: ${(topScore * 100).toFixed(1)}%.`,
    url: 'https://www.kaggle.com/competitions/arc-prize-2025/leaderboard',
    metadata: {
      source: 'ARC Kaggle Competition',
      timestamp: entry.submissionDate || new Date().toISOString(),
      id: `kaggle-arc-${entry.teamId}-${Date.now()}`,
      type: 'benchmark',
      score: entry.score,
      rank: entry.rank,
      delta: entry.delta
    }
  }));
}
