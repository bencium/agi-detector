import FirecrawlApp from '@mendable/firecrawl-js';

interface CrawledArticle {
  title: string;
  content: string;
  url: string;
  metadata: {
    source: string;
    timestamp: string;
    id: string;
  };
}

// Initialize Firecrawl with API key from environment (no default)
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

// Track API usage to respect limits
let firecrawlUsageCount = 0;
const FIRECRAWL_DAILY_LIMIT = 50; // Conservative limit
const FIRECRAWL_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Simple in-memory cache to avoid repeated API calls
const firecrawlCache = new Map<string, { data: CrawledArticle[], timestamp: number }>();

export async function crawlWithFirecrawl(url: string, sourceName: string): Promise<CrawledArticle[]> {
  if (!FIRECRAWL_API_KEY) {
    console.log(`[Firecrawl] No API key found, skipping ${sourceName}`);
    return [];
  }

  // Check cache first
  const cacheKey = `${sourceName}-${url}`;
  const cached = firecrawlCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < FIRECRAWL_CACHE_DURATION) {
    console.log(`[Firecrawl] Using cached data for ${sourceName} (${cached.data.length} articles)`);
    return cached.data;
  }

  // Check daily limit
  if (firecrawlUsageCount >= FIRECRAWL_DAILY_LIMIT) {
    console.log(`[Firecrawl] Daily limit reached (${FIRECRAWL_DAILY_LIMIT}), skipping ${sourceName}`);
    return [];
  }

  try {
    firecrawlUsageCount++;
    console.log(`[Firecrawl] Attempting to crawl ${sourceName} at ${url}`);
    
    const app = new FirecrawlApp({ apiKey: FIRECRAWL_API_KEY });
    const articles: CrawledArticle[] = [];
    
    // For DeepMind, try specific URLs
    if (sourceName === 'DeepMind Research') {
      console.log(`[Firecrawl] Using alternate approach for DeepMind`);
      
      // Simple scrape since crawl seems to have issues
      try {
        const result = await app.scrapeUrl('https://deepmind.google/discover/blog/', {
          formats: ['markdown', 'html']
        });
        
        if (result.success && result.data) {
          articles.push({
            title: result.data.metadata?.title || 'DeepMind Research Updates',
            content: (result.data.markdown || result.data.html || '').substring(0, 1000),
            url: 'https://deepmind.google/discover/blog/',
            metadata: {
              source: sourceName,
              timestamp: new Date().toISOString(),
              id: `${sourceName}-${Date.now()}`
            }
          });
        }
      } catch (err) {
        console.log(`[Firecrawl] DeepMind scrape failed: ${err}`);
      }
    } 
    
    // For Anthropic, try search
    else if (sourceName === 'Anthropic Blog') {
      console.log(`[Firecrawl] Using search for Anthropic`);
      
      try {
        const searchResults = await app.search('site:anthropic.com AI safety AGI', {
          limit: 3
        });
        
        if (searchResults.success && searchResults.data) {
          searchResults.data.forEach((result, index) => {
            articles.push({
              title: result.title || 'Anthropic Research',
              content: result.markdown || result.snippet || result.description || `Research article from Anthropic on AI safety and alignment. Visit ${result.url} for full details.`,
              url: result.url,
              metadata: {
                source: sourceName,
                timestamp: new Date().toISOString(),
                id: `${sourceName}-${Date.now()}-${index}`
              }
            });
          });
        }
      } catch (err) {
        console.log(`[Firecrawl] Anthropic search failed: ${err}`);
      }
    }
    
    console.log(`[Firecrawl] Found ${articles.length} articles from ${sourceName}`);
    console.log(`[Firecrawl] API usage: ${firecrawlUsageCount}/${FIRECRAWL_DAILY_LIMIT}`);
    
    // Cache the results
    if (articles.length > 0) {
      firecrawlCache.set(cacheKey, { data: articles, timestamp: Date.now() });
    }
    
    return articles;
    
  } catch (error) {
    console.error(`[Firecrawl] Error crawling ${sourceName}:`, error);
    return [];
  }
}

// Reset usage counter daily
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() === 0) {
    firecrawlUsageCount = 0;
    console.log('[Firecrawl] Daily usage counter reset');
  }
}, 60 * 1000); // Check every minute
