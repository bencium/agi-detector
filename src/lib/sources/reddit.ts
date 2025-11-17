/**
 * Reddit API Integration
 *
 * Monitors key AI/ML subreddits for AGI-relevant discussions
 * Free API, 60 requests/minute limit
 */

import snoowrap from 'snoowrap';

interface RedditPost {
  title: string;
  content: string;
  url: string;
  metadata: {
    source: string;
    timestamp: string;
    id: string;
    subreddit: string;
    score: number;
    numComments: number;
    author: string;
    flair?: string;
    created: number;
  };
}

// High-signal subreddits for AGI monitoring
const TARGET_SUBREDDITS = [
  'MachineLearning',     // 2.7M members, [R] research posts
  'artificial',          // 1M+ members, AGI discussions
  'singularity',         // 240K members, AGI/ASI focused
  'ControlProblem',      // AI safety discussions
  'mlscaling',           // Scaling laws and capabilities
];

// High-signal post flairs
const HIGH_SIGNAL_FLAIRS = [
  'Research',            // [R] Research papers
  'Discussion',          // [D] Technical discussions
  'Project',             // [P] Project demonstrations
  'News',                // Breaking news
];

let redditClient: snoowrap | null = null;

/**
 * Initialize Reddit API client
 */
function getRedditClient(): snoowrap | null {
  if (redditClient) return redditClient;

  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const userAgent = process.env.REDDIT_USER_AGENT || 'AGI-Detector-Bot/1.0';

  if (!clientId || !clientSecret) {
    console.warn('[Reddit] Missing credentials (REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET)');
    return null;
  }

  try {
    redditClient = new snoowrap({
      userAgent,
      clientId,
      clientSecret,
      // Application-only auth (no user context)
    } as any);

    console.log('[Reddit] Client initialized successfully');
    return redditClient;
  } catch (error) {
    console.error('[Reddit] Failed to initialize client:', error);
    return null;
  }
}

/**
 * Fetch hot/trending posts from AGI-relevant subreddits
 */
export async function fetchRedditPosts(
  timeFilter: 'hour' | 'day' | 'week' = 'day',
  limit: number = 25
): Promise<RedditPost[]> {
  const client = getRedditClient();
  if (!client) {
    console.warn('[Reddit] Client not available, skipping Reddit crawl');
    return [];
  }

  const posts: RedditPost[] = [];

  for (const subreddit of TARGET_SUBREDDITS) {
    try {
      console.log(`[Reddit] Fetching from r/${subreddit}...`);

      // Fetch hot posts (most active/trending)
      const hotPosts = await client.getSubreddit(subreddit).getHot({ limit });

      for (const post of hotPosts) {
        // Filter by score (upvotes) to ensure quality
        if (post.score < 10) continue; // Skip low-engagement posts

        // Check if post has high-signal flair
        const flair = post.link_flair_text || '';
        const isHighSignal = HIGH_SIGNAL_FLAIRS.some(f =>
          flair.toLowerCase().includes(f.toLowerCase())
        );

        // For r/MachineLearning, prioritize [R] research posts
        if (subreddit === 'MachineLearning' && !flair.includes('[R]') && post.score < 50) {
          continue; // Skip non-research posts unless highly upvoted
        }

        const content = post.selftext || post.title; // Use selftext or fall back to title

        posts.push({
          title: post.title,
          content,
          url: post.url.startsWith('http') ? post.url : `https://reddit.com${post.permalink}`,
          metadata: {
            source: 'Reddit',
            timestamp: new Date().toISOString(),
            id: post.id,
            subreddit: `r/${subreddit}`,
            score: post.score,
            numComments: post.num_comments,
            author: post.author.name,
            flair: flair || undefined,
            created: post.created_utc,
          },
        });
      }

      console.log(`[Reddit] Found ${posts.length} posts from r/${subreddit}`);

      // Rate limiting: Wait 1 second between subreddit requests
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`[Reddit] Error fetching r/${subreddit}:`, error);
    }
  }

  // Sort by score (engagement) descending
  posts.sort((a, b) => b.metadata.score - a.metadata.score);

  console.log(`[Reddit] Total posts fetched: ${posts.length}`);
  return posts;
}

/**
 * Search Reddit for specific AGI-related keywords
 */
export async function searchReddit(
  query: string,
  timeFilter: 'day' | 'week' | 'month' = 'week',
  limit: number = 50
): Promise<RedditPost[]> {
  const client = getRedditClient();
  if (!client) return [];

  const posts: RedditPost[] = [];

  try {
    console.log(`[Reddit] Searching for: "${query}"`);

    // Search across all AGI-relevant subreddits
    for (const subreddit of TARGET_SUBREDDITS) {
      const results = await client
        .getSubreddit(subreddit)
        .search({
          query,
          time: timeFilter,
          sort: 'relevance',
        } as any)
        .slice(0, Math.floor(limit / TARGET_SUBREDDITS.length));

      for (const post of results) {
        if (post.score < 5) continue; // Filter low-quality

        const content = post.selftext || post.title;

        posts.push({
          title: post.title,
          content,
          url: post.url.startsWith('http') ? post.url : `https://reddit.com${post.permalink}`,
          metadata: {
            source: 'Reddit',
            timestamp: new Date().toISOString(),
            id: post.id,
            subreddit: `r/${subreddit}`,
            score: post.score,
            numComments: post.num_comments,
            author: post.author.name,
            flair: post.link_flair_text || undefined,
            created: post.created_utc,
          },
        });
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    posts.sort((a, b) => b.metadata.score - a.metadata.score);
    console.log(`[Reddit] Search found ${posts.length} posts`);

  } catch (error) {
    console.error('[Reddit] Search error:', error);
  }

  return posts;
}

/**
 * Monitor for AGI breakthrough discussions
 * Uses high-signal keywords
 */
export async function monitorAGIBreakthroughs(): Promise<RedditPost[]> {
  const keywords = [
    'AGI breakthrough',
    'recursive self-improvement',
    'emergent capability',
    'artificial general intelligence',
    'superintelligence',
  ];

  const allPosts: RedditPost[] = [];

  for (const keyword of keywords) {
    const posts = await searchReddit(keyword, 'week', 20);
    allPosts.push(...posts);

    // Rate limiting between searches
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Deduplicate by post ID
  const uniquePosts = Array.from(
    new Map(allPosts.map(post => [post.metadata.id, post])).values()
  );

  return uniquePosts;
}

/**
 * Example environment variables needed:
 *
 * REDDIT_CLIENT_ID=your_client_id_here
 * REDDIT_CLIENT_SECRET=your_client_secret_here
 * REDDIT_USER_AGENT=AGI-Detector-Bot/1.0 (by /u/your_username)
 *
 * Get credentials at: https://www.reddit.com/prefs/apps
 * Create "script" type app for server-side access
 */
