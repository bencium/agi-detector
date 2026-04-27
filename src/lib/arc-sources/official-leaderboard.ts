/**
 * ARC Prize Official Leaderboard Crawler
 * Monitors arcprize.org/leaderboard for score changes and breakthroughs
 */

import { chromium, Browser } from 'playwright';

export interface ARCLeaderboardEntry {
  rank: number;
  team: string;
  score: number;
  costPerTask?: number;
  submissionDate?: string;
  delta?: number; // Change from previous
}

export interface ARCLeaderboardResult {
  entries: ARCLeaderboardEntry[];
  timestamp: string;
  topScore: number;
  humanBaseline: number;
  gap: number; // Gap to human performance
  sourceStatus: 'live' | 'manual_snapshot' | 'unavailable';
  sourceUrl: string;
  lastVerifiedAt?: string;
  limitations?: string[];
  lastKnownSnapshot?: {
    topScore: number;
    team: string;
    verifiedAt: string;
    sourceUrl: string;
  };
}

let browser: Browser | null = null;

const ARC_LEADERBOARD_URL = 'https://arcprize.org/leaderboard';
const ARC_2025_RESULTS_URL = 'https://arcprize.org/blog/arc-prize-2025-results-analysis';
const LAST_KNOWN_ARC_SNAPSHOT = {
  topScore: 0.2403,
  team: 'NVARC (2025 Kaggle private eval winner)',
  verifiedAt: '2025-12-05',
  sourceUrl: ARC_2025_RESULTS_URL
};

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-first-run',
      ]
    });
  }
  return browser;
}

/**
 * Crawl ARC Prize official leaderboard
 * Uses Playwright since the page is JavaScript-rendered with D3.js
 */
export async function crawlARCLeaderboard(): Promise<ARCLeaderboardResult> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    console.log('[ARC Official] Navigating to leaderboard...');
    await page.goto(ARC_LEADERBOARD_URL, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait longer for D3.js visualization to render
    await page.waitForTimeout(5000);

    // Extract leaderboard data - multiple selector strategies
    const entries = await page.evaluate(() => {
      const results: any[] = [];

      // Strategy 1: Look for leaderboard table rows
      const tableRows = document.querySelectorAll('#leaderboard-table tbody tr, table tbody tr');
      tableRows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const team = cells[0]?.textContent?.trim() || `Team ${index + 1}`;
          const scoreText = cells[1]?.textContent?.trim() || '0';
          const score = parseFloat(scoreText.replace('%', '')) / 100;
          if (!isNaN(score) && score > 0) {
            results.push({ rank: index + 1, team, score });
          }
        }
      });

      if (results.length > 0) return results;

      // Strategy 2: Look for D3 scatter plot points with data attributes
      const points = document.querySelectorAll('circle[data-score], [class*="point"]');
      points.forEach((point, index) => {
        const score = parseFloat(point.getAttribute('data-score') || '0') / 100;
        const team = point.getAttribute('data-team') || `Entry ${index + 1}`;
        if (score > 0) {
          results.push({ rank: index + 1, team, score });
        }
      });

      if (results.length > 0) return results;

      // Strategy 3: Removed - too unreliable, rely on known score fallback instead
      // The page contains many percentages (100% baseline, cost %, etc.) that confuse parsing

      return results;
    });

    let topScore = entries.length > 0 ? Math.max(...entries.map(e => e.score)) : 0;
    const humanBaseline = 1.0;

    // If scraping fails to expose structured data, mark the result as a manual
    // snapshot. This is still useful for analysts, but it must never look live.
    if (topScore === 0) {
      console.log('[ARC Official] Scraping returned no data, using manual 2025 snapshot');
      topScore = LAST_KNOWN_ARC_SNAPSHOT.topScore;
      entries.push({
        rank: 1,
        team: LAST_KNOWN_ARC_SNAPSHOT.team,
        score: LAST_KNOWN_ARC_SNAPSHOT.topScore
      });
    }

    console.log(`[ARC Official] Found ${entries.length} entries, top score: ${(topScore * 100).toFixed(1)}%`);
    const sourceStatus = entries.length > 0 && entries[0]?.team === LAST_KNOWN_ARC_SNAPSHOT.team
      ? 'manual_snapshot'
      : 'live';

    return {
      entries,
      timestamp: new Date().toISOString(),
      topScore,
      humanBaseline,
      gap: humanBaseline - topScore,
      sourceStatus,
      sourceUrl: sourceStatus === 'live' ? ARC_LEADERBOARD_URL : ARC_2025_RESULTS_URL,
      lastVerifiedAt: sourceStatus === 'live' ? new Date().toISOString() : LAST_KNOWN_ARC_SNAPSHOT.verifiedAt,
      limitations: sourceStatus === 'live'
        ? ['ARC-AGI is benchmark evidence only; it is not an AGI meter.']
        : [
            'Live leaderboard scraping did not return structured data.',
            'Using a clearly labeled manual snapshot, not live evidence.',
            'ARC-AGI is benchmark evidence only; it is not an AGI meter.'
          ],
      lastKnownSnapshot: sourceStatus === 'live' ? undefined : LAST_KNOWN_ARC_SNAPSHOT
    };
  } catch (error) {
    console.error('[ARC Official] Error crawling leaderboard:', error);
    // Return source failure plus a labeled last-known snapshot for context.
    return {
      entries: [],
      timestamp: new Date().toISOString(),
      topScore: 0,
      humanBaseline: 1.0,
      gap: 1.0,
      sourceStatus: 'unavailable',
      sourceUrl: ARC_LEADERBOARD_URL,
      limitations: [
        'Live leaderboard fetch failed.',
        'No fresh benchmark score should be inferred from this response.',
        'A last-known snapshot is provided only as historical context.'
      ],
      lastKnownSnapshot: LAST_KNOWN_ARC_SNAPSHOT
    };
  } finally {
    await page.close();
  }
}

/**
 * Convert leaderboard to crawl results for storage
 */
export function leaderboardToCrawlResults(result: ARCLeaderboardResult): any[] {
  return result.entries.slice(0, 10).map(entry => ({
    title: `ARC-AGI-2 Leaderboard: ${entry.team} - ${(entry.score * 100).toFixed(1)}%`,
    content: `Team "${entry.team}" ranked #${entry.rank} on ARC-AGI-2 benchmark with score ${(entry.score * 100).toFixed(1)}%. Current gap to human performance (100%): ${((1 - entry.score) * 100).toFixed(1)}%. Top score on leaderboard: ${(result.topScore * 100).toFixed(1)}%.`,
    url: 'https://arcprize.org/leaderboard',
    metadata: {
      source: 'ARC Prize Leaderboard',
      timestamp: result.timestamp,
      id: `arc-leaderboard-${entry.team.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`,
      type: 'benchmark',
      score: entry.score,
      rank: entry.rank,
      sourceStatus: result.sourceStatus,
      sourceUrl: result.sourceUrl,
      limitations: result.limitations
    }
  }));
}

/**
 * Cleanup browser instance
 */
export async function cleanupARCBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
