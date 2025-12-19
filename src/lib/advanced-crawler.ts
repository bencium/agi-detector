import axios from 'axios';
import * as cheerio from 'cheerio';
import { chromium, Browser, Page } from 'playwright';
import UserAgent from 'user-agents';
import { parseStringPromise } from 'xml2js';
import { RateLimiter as Limiter } from 'limiter';
import { braveWebSearch } from './brave-search';
import { isUrlSafeWithDns } from './security/urlValidator';
import { buildCrawlMetadata } from './evidence';

// Sources that block simple HTTP requests - use Playwright as primary
const BLOCKED_SOURCES = [
  'OpenAI Blog',
  'DeepMind Research',
  'Anthropic Blog',
  'Anthropic Research', // Research papers page (also React SPA)
  'Microsoft AI Blog',
  'BAAI Research',
  'ByteDance Seed Research',
  'Tencent AI Lab',
  'Shanghai AI Lab',
  'ChinaXiv'
];

interface CrawledArticle {
  title: string;
  content: string;
  url: string;
  metadata: {
    source: string;
    timestamp: string;
    id: string;
    fetchedAt?: string;
    canonicalUrl?: string;
    contentHash?: string;
    evidence?: {
      snippets: string[];
      claims: Array<{
        claim: string;
        evidence: string;
        tags: string[];
        numbers: number[];
        benchmark?: string;
        metric?: string;
        value?: number;
        delta?: number;
        unit?: string;
      }>;
    };
  };
}

interface CrawlStrategy {
  name: string;
  execute: () => Promise<CrawledArticle[]>;
}

type AutoDiscoverConfig = {
  autoDiscover?: boolean;
  name?: string;
};

// Rate limiter: 1 request per 2 seconds
const limiter = new Limiter({ tokensPerInterval: 1, interval: 2000 });

// Random delay between requests
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const getRandomDelay = () => Math.floor(Math.random() * 3000) + 2000;

// Generate random user agent
const getRandomUserAgent = () => {
  const userAgent = new UserAgent({ deviceCategory: 'desktop' });
  return userAgent.toString();
};

// Advanced headers with rotation
const getHeaders = () => ({
  'User-Agent': getRandomUserAgent(),
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'DNT': '1',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
});

// RSS feed parser
async function parseRSSFeed(url: string, sourceName: string): Promise<CrawledArticle[]> {
  try {
    // Security: Validate URL before fetching
    const validation = await isUrlSafeWithDns(url);
    if (!validation.safe) {
      console.warn(`[RSS] Blocked unsafe URL: ${url} - ${validation.reason}`);
      return [];
    }

    console.log(`[RSS] Attempting to fetch RSS feed from ${url}`);
    const response = await axios.get(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'application/rss+xml, application/xml, text/xml'
      },
      timeout: 30000,  // Increased timeout for reliability
      maxContentLength: 10 * 1024 * 1024,  // 10MB max response size
      maxRedirects: 3  // Limit redirects
    });
    
    const parsed = await parseStringPromise(response.data);
    const items = parsed.rss?.channel?.[0]?.item || parsed.feed?.entry || [];
    
    const toText = (value: any): string => {
      if (!value) return '';
      if (typeof value === 'string') return value;
      if (typeof value === 'object' && typeof value._ === 'string') return value._;
      return '';
    };

    return items.map((item: any) => {
      const title = toText(item.title?.[0]) || '';
      const content = toText(item.description?.[0]) || toText(item.summary?.[0]) || toText(item.content?.[0]) || '';
      const url = item.link?.[0]?.$ ?.href || item.link?.[0] || item.guid?.[0] || '';
      const publishedAt = item.pubDate?.[0] || item.updated?.[0];
      const author = item.author?.[0] || item['dc:creator']?.[0] || item.creator?.[0] || '';
      const id = item.guid?.[0] || item.id?.[0] || `${sourceName}-${Date.now()}`;
      const metadata = buildCrawlMetadata({
        source: sourceName,
        url,
        content: content || title,
        title,
        publishedAt,
        author,
        id
      });

      return { title, content, url, metadata };
    }).filter((article: { title: string; content: string; url: string; metadata: object }) => article.title && article.content);
  } catch (error) {
    console.log(`[RSS] Failed to parse RSS feed: ${error}`);
    return [];
  }
}

async function parseSitemap(url: string, sourceName: string, maxUrls = 8): Promise<CrawledArticle[]> {
  try {
    const base = new URL(url);
    const sitemapCandidates = [
      new URL('/sitemap.xml', base).toString(),
      new URL('/sitemap_index.xml', base).toString(),
      new URL('/sitemap-index.xml', base).toString()
    ];

    const seen = new Set<string>();
    const urls: string[] = [];

    const extractLocs = (parsed: any): string[] => {
      const locs: string[] = [];
      const urlset = parsed?.urlset?.url || [];
      const sitemapIndex = parsed?.sitemapindex?.sitemap || [];
      for (const entry of urlset) {
        const loc = entry?.loc?.[0];
        if (typeof loc === 'string') locs.push(loc);
      }
      for (const entry of sitemapIndex) {
        const loc = entry?.loc?.[0];
        if (typeof loc === 'string') locs.push(loc);
      }
      return locs;
    };

    const fetchAndParse = async (sitemapUrl: string): Promise<string[]> => {
      const validation = await isUrlSafeWithDns(sitemapUrl);
      if (!validation.safe) return [];
      const response = await axios.get(sitemapUrl, {
        headers: { 'User-Agent': getRandomUserAgent() },
        timeout: 20000,
        maxRedirects: 3
      });
      const parsed = await parseStringPromise(response.data);
      return extractLocs(parsed);
    };

    for (const sitemapUrl of sitemapCandidates) {
      const locs = await fetchAndParse(sitemapUrl);
      if (locs.length === 0) continue;

      // If sitemap index, follow up to 2 child sitemaps for coverage.
      const childSitemaps = locs.filter((loc: string) => loc.includes('sitemap')).slice(0, 2);
      let resolved = locs;
      if (childSitemaps.length > 0) {
        resolved = [];
        for (const child of childSitemaps) {
          const childLocs = await fetchAndParse(child);
          resolved.push(...childLocs);
          if (resolved.length >= maxUrls * 2) break;
        }
      }

      const filtered = resolved.filter((loc: string) => {
        if (!loc || seen.has(loc)) return false;
        if (!loc.startsWith('http')) return false;
        if (new URL(loc).host !== base.host) return false;
        const lower = loc.toLowerCase();
        return /(research|publication|paper|news|blog|report|announcement|release|project)/.test(lower);
      });

      for (const loc of filtered) {
        if (seen.size >= maxUrls) break;
        seen.add(loc);
        urls.push(loc);
      }

      if (urls.length > 0) break;
    }

    if (urls.length === 0) return [];

    const slugToTitle = (link: string) => {
      try {
        const pathname = new URL(link).pathname.split('/').filter(Boolean);
        const slug = pathname[pathname.length - 1] || link;
        return slug
          .replace(/[-_]/g, ' ')
          .replace(/\.\w+$/, '')
          .replace(/\b\w/g, c => c.toUpperCase());
      } catch {
        return link;
      }
    };

    return urls.map((loc) => ({
      title: slugToTitle(loc),
      content: `Discovered via sitemap for ${sourceName}.`,
      url: loc,
      metadata: buildCrawlMetadata({
        source: sourceName,
        url: loc,
        content: `Discovered via sitemap for ${sourceName}.`,
        title: slugToTitle(loc)
      })
    }));
  } catch (error) {
    console.log(`[Sitemap] Failed to parse sitemap for ${sourceName}: ${error}`);
    return [];
  }
}

// Browser automation with stealth
let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: [
        // Stealth features
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        // SECURITY: Removed dangerous flags:
        // - '--disable-web-security' (allows cross-origin access)
        // - '--disable-site-isolation-trials' (removes security boundaries)
        // - '--no-sandbox' (removes sandboxing protection)
        // - '--disable-setuid-sandbox' (unsafe)
        // Performance optimizations only:
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu'
      ]
    });
  }
  return browser;
}

async function crawlWithBrowser(url: string, selectors: any): Promise<CrawledArticle[]> {
  // Security: Validate URL before crawling
  const validation = await isUrlSafeWithDns(url);
  if (!validation.safe) {
    console.warn(`[Browser] Blocked unsafe URL: ${url} - ${validation.reason}`);
    return [];
  }

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Stealth settings
    await page.setViewportSize({ 
      width: 1920 + Math.floor(Math.random() * 100), 
      height: 1080 + Math.floor(Math.random() * 100) 
    });
    
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });
    
    // Navigate with random user agent
    await page.route('**/*', async route => {
      const headers = {
        ...route.request().headers(),
        'user-agent': getRandomUserAgent()
      };
      await route.continue({ headers });
    });
    
    console.log(`[Browser] Navigating to ${url}`);
    await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Random delay to appear more human
    await delay(getRandomDelay());
    
    if (selectors.autoDiscover) {
      const html = await page.content();
      return discoverArticlesFromHtml(html, url, selectors as AutoDiscoverConfig);
    }

    // Extract articles
    const articles = await page.evaluate((sel) => {
      const results: any[] = [];
      const elements = document.querySelectorAll(sel.selector);

      elements.forEach((element) => {
        let title = element.querySelector(sel.titleSelector)?.textContent?.trim() || '';
        let content = element.querySelector(sel.contentSelector)?.textContent?.trim() || '';
        // Handle empty linkSelector - element itself might be the link
        let url = '';
        if (sel.linkSelector) {
          const linkElement = element.querySelector(sel.linkSelector) as HTMLAnchorElement;
          url = linkElement?.href || '';
        } else if (element instanceof HTMLAnchorElement) {
          url = element.href;
        }

        // Special handling for Anthropic (news or research): extract from fullText if selectors fail
        if ((sel.isAnthropicNews || sel.isAnthropicResearch) && (!title || !content)) {
          const fullText = element.textContent?.trim() || '';
          // Anthropic format: "CategoryDateTitleDescription" or "DateCategoryTitleDescription"
          // Try to extract title from URL slug as backup
          if (!title && url) {
            const slug = url.split('/').pop() || '';
            title = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          }
          // Use fullText as content if no content found
          if (!content && fullText) {
            content = fullText.substring(0, 500); // Limit length
          }
        }

        if (title && content) {
          results.push({ title, content, url });
        }
      });

      return results;
    }, selectors);
    
    return articles.map(article => ({
      ...article,
      metadata: buildCrawlMetadata({
        source: selectors.name,
        url: article.url,
        content: article.content,
        title: article.title
      })
    }));
  } catch (error) {
    console.error(`[Browser] Error crawling ${url}:`, error);
    return [];
  } finally {
    await page.close();
  }
}

function discoverArticlesFromHtml(html: string, baseUrl: string, config: AutoDiscoverConfig): CrawledArticle[] {
  const $ = cheerio.load(html);
  const candidates: CrawledArticle[] = [];
  const dateRegex = /(\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日?)/;

  $('article, li, div').each((_, element) => {
    const $el = $(element);
    const text = $el.text().replace(/\s+/g, ' ').trim();
    if (text.length < 40) return;

    const link = $el.find('a[href]').first();
    const href = link.attr('href') || '';
    if (!href) return;

    const title = link.text().replace(/\s+/g, ' ').trim();
    if (title.length < 6) return;

    const dateMatch = text.match(dateRegex);
    const url = href.startsWith('http') ? href : new URL(href, baseUrl).href;
    candidates.push({
      title,
      content: text.slice(0, 500),
      url,
      metadata: buildCrawlMetadata({
        source: config.name || 'Unknown',
        url,
        content: text,
        title,
        publishedAt: dateMatch?.[0]
      })
    });
  });

  const deduped = new Map<string, CrawledArticle>();
  for (const candidate of candidates) {
    const key = candidate.url || candidate.title.toLowerCase();
    if (!deduped.has(key)) deduped.set(key, candidate);
  }

  return Array.from(deduped.values()).slice(0, 20);
}

async function crawlWithBrowserWithRetries(url: string, selectors: any): Promise<CrawledArticle[]> {
  const retries = selectors.playwrightRetries ?? 0;
  const maxAttempts = Math.max(1, retries + 1);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const articles = await crawlWithBrowser(url, selectors);
    if (articles.length > 0) return articles;
    if (attempt < maxAttempts) {
      const waitMs = 1000 * attempt;
      console.log(`[Browser] Retry ${attempt}/${maxAttempts} after ${waitMs}ms for ${url}`);
      await delay(waitMs);
    }
  }
  return [];
}

// API endpoints to try - verified working RSS feeds
const API_ENDPOINTS: Record<string, string[]> = {
  'OpenAI Blog': [
    'https://openai.com/blog/rss.xml', // Updated working RSS feed
    'https://openai.com/blog/rss/', // Fallback
  ],
  'DeepMind Research': [
    'https://www.deepmind.com/blog/rss.xml', // Updated working RSS feed
    'https://deepmind.google/discover/feed.xml',
    'https://deepmind.google/feed.xml',
    'https://deepmind.google/research/feed.xml',
  ],
  'Anthropic Blog': [
    // No working RSS feed - will use Firecrawl
    'https://www.anthropic.com/rss.xml',
    'https://www.anthropic.com/feed.xml',
    'https://www.anthropic.com/news/feed.xml',
    'https://www.anthropic.com/index/feed.xml'
  ],
  'Microsoft AI Blog': [
    'https://blogs.microsoft.com/ai/feed/', // Working RSS feed
  ],
  'TechCrunch AI': [
    'https://techcrunch.com/category/artificial-intelligence/feed/', // Working RSS feed
  ],
  'VentureBeat AI': [
    'https://venturebeat.com/ai/feed/',
    'https://venturebeat.com/feed/',
    'https://feeds.feedburner.com/venturebeat/ai'
  ]
  ,
  'arXiv AI': [
    'http://export.arxiv.org/rss/cs.AI',
    'https://export.arxiv.org/rss/cs.AI'
  ],
  'Qwen GitHub Releases': [
    'https://github.com/QwenLM/Qwen/tags.atom',
    'https://github.com/QwenLM/Qwen/commits/main.atom',
    'https://github.com/QwenLM/Qwen/commits/master.atom'
  ],
  'Huawei Noah Research': [
    'https://github.com/huawei-noah/noah-research/tags.atom',
    'https://github.com/huawei-noah/noah-research/commits/main.atom',
    'https://github.com/huawei-noah/noah-research/commits/master.atom'
  ],
  'ModelScope Releases': [
    'https://github.com/modelscope/modelscope/releases.atom'
  ]
};

// Multi-strategy crawler
export class AdvancedCrawler {
  private source: any;
  
  constructor(source: any) {
    this.source = source;
  }
  
  async crawl(): Promise<CrawledArticle[]> {
    const isBlockedSource = BLOCKED_SOURCES.includes(this.source.name);
    const validation = await isUrlSafeWithDns(this.source.url);
    if (!validation.safe) {
      console.warn(`[${this.source.name}] Blocked unsafe URL: ${this.source.url} - ${validation.reason}`);
      return [];
    }

    // Build strategy list based on source type
    const strategies: CrawlStrategy[] = [];

    // Strategy 1: Always try RSS first (fastest, free)
    strategies.push({
      name: 'RSS Feed',
      execute: async () => {
        const feeds = API_ENDPOINTS[this.source.name] || [];
        for (const feedUrl of feeds) {
          console.log(`[${this.source.name}] Checking RSS feed: ${feedUrl}`);
          const articles = await parseRSSFeed(feedUrl, this.source.name);
          if (articles.length > 0) {
            return articles;
          }
        }
        return [];
      }
    });

    if (this.source.playwrightFirst) {
      strategies.push({
        name: 'Playwright (Priority)',
        execute: async () => {
          console.log(`[${this.source.name}] Using Playwright with retries (priority)`);
          await limiter.removeTokens(1);
          return await crawlWithBrowserWithRetries(this.source.url, this.source);
        }
      });
    }

    // Strategy 2: For BLOCKED sources, use Playwright immediately after RSS fails
    if (isBlockedSource) {
      strategies.push({
        name: 'Playwright (Blocked Source)',
        execute: async () => {
          console.log(`[${this.source.name}] Using Playwright for blocked source`);
          await limiter.removeTokens(1);
          return await crawlWithBrowserWithRetries(this.source.url, this.source);
        }
      });
    }

    // Strategy 3: Simple fetch with advanced headers (works for unblocked sources)
    strategies.push({
      name: 'Advanced Fetch',
      execute: async () => {
        await limiter.removeTokens(1);
        await delay(getRandomDelay());

        try {
          const response = await axios.get(this.source.url, {
            headers: getHeaders(),
            timeout: 15000,
            maxRedirects: 5,
            validateStatus: (status) => status < 500,
            withCredentials: true,
            decompress: true,
          });

          if (response.status === 200) {
            if (this.source.autoDiscover) {
              return discoverArticlesFromHtml(response.data, this.source.url, this.source as AutoDiscoverConfig);
            }

            const $ = cheerio.load(response.data);
            const articles: CrawledArticle[] = [];

            $(this.source.selector).each((_, element) => {
              const $element = $(element);
              const title = $element.find(this.source.titleSelector).text().trim();
              const content = $element.find(this.source.contentSelector).text().trim();
              let url = $element.find(this.source.linkSelector).attr('href') || '';

              // Handle relative URLs
              if (url && !url.startsWith('http')) {
                const baseUrl = new URL(this.source.url);
                url = new URL(url, baseUrl.origin).href;
              }

              if (title && content) {
                articles.push({
                  title,
                  content,
                  url,
                  metadata: buildCrawlMetadata({
                    source: this.source.name,
                    url,
                    content,
                    title
                  })
                });
              }
            });

            return articles;
          }
        } catch (error) {
          console.log(`[Advanced Fetch] Failed for ${this.source.name}: ${error}`);
        }
        return [];
      }
    });

    // Strategy 4: For NON-BLOCKED sources, try Playwright as fallback
    if (!isBlockedSource) {
      strategies.push({
        name: 'Playwright (Fallback)',
        execute: async () => {
          console.log(`[${this.source.name}] Using Playwright as fallback`);
          await limiter.removeTokens(1);
          return await crawlWithBrowserWithRetries(this.source.url, this.source);
        }
      });
    }

    // Strategy 5: Sitemap fallback for auto-discover sources (China labs, etc.)
    if (this.source.autoDiscover) {
      strategies.push({
        name: 'Sitemap (Fallback)',
        execute: async () => {
          console.log(`[${this.source.name}] Using sitemap fallback`);
          await limiter.removeTokens(1);
          return await parseSitemap(this.source.url, this.source.name, 8);
        }
      });
    }

    // Strategy 6: Brave Search as last resort (limited free tier)
    strategies.push({
      name: 'Brave Search',
      execute: async () => {
        if (!process.env.BRAVE_API_KEY) return [];
        try {
          console.log(`[${this.source.name}] Using Brave Search as last resort`);
          const host = new URL(this.source.url).host;
          let q = `site:${host}`;
          if (this.source.name === 'Anthropic Blog') q += ' (news OR blog) (AI OR research)';
          if (this.source.name === 'DeepMind Research') q += ' (blog OR research)';
          const results = await braveWebSearch(q, { count: 6, freshness: 'pm', country: 'us' });
          return (results || []).map((r) => ({
            title: r.title,
            content: r.snippet || 'Search result from Brave; open the URL for full content.',
            url: r.url,
            metadata: {
              source: this.source.name,
              timestamp: new Date().toISOString(),
              id: `${this.source.name}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`
            }
          }));
        } catch (e) {
          console.log(`[Brave Search] Failed for ${this.source.name}: ${e}`);
          return [];
        }
      }
    });
    
    // Try each strategy in order
    for (const strategy of strategies) {
      console.log(`[${this.source.name}] Trying ${strategy.name}...`);
      const articles = await strategy.execute();
      if (articles.length > 0) {
        console.log(`[${this.source.name}] ✅ Success with ${strategy.name}: Found ${articles.length} articles`);
        return articles;
      }
    }
    
    console.log(`[${this.source.name}] ❌ All strategies failed`);
    return [];
  }
}

// Cleanup function
export async function cleanupBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

// Export main crawl function
export async function crawlWithAdvancedMethods(source: any): Promise<CrawledArticle[]> {
  const crawler = new AdvancedCrawler(source);
  return await crawler.crawl();
}
