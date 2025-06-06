import axios from 'axios';
import * as cheerio from 'cheerio';
import { chromium, Browser, Page } from 'playwright';
import UserAgent from 'user-agents';
import { parseStringPromise } from 'xml2js';
import { RateLimiter as Limiter } from 'limiter';
import { crawlWithFirecrawl } from './firecrawl-crawler';

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

interface CrawlStrategy {
  name: string;
  execute: () => Promise<CrawledArticle[]>;
}

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
    console.log(`[RSS] Attempting to fetch RSS feed from ${url}`);
    const response = await axios.get(url, { 
      headers: { 
        'User-Agent': getRandomUserAgent(),
        'Accept': 'application/rss+xml, application/xml, text/xml' 
      },
      timeout: 10000 
    });
    
    const parsed = await parseStringPromise(response.data);
    const items = parsed.rss?.channel?.[0]?.item || parsed.feed?.entry || [];
    
    return items.map((item: any) => ({
      title: item.title?.[0]?._ || item.title?.[0] || '',
      content: item.description?.[0] || item.summary?.[0] || item.content?.[0] || '',
      url: item.link?.[0]?.$ ?.href || item.link?.[0] || item.guid?.[0] || '',
      metadata: {
        source: sourceName,
        timestamp: item.pubDate?.[0] || item.updated?.[0] || new Date().toISOString(),
        id: item.guid?.[0] || item.id?.[0] || `${sourceName}-${Date.now()}`
      }
    })).filter(article => article.title && article.content);
  } catch (error) {
    console.log(`[RSS] Failed to parse RSS feed: ${error}`);
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
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=IsolateOrigins',
        '--disable-site-isolation-trials',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });
  }
  return browser;
}

async function crawlWithBrowser(url: string, selectors: any): Promise<CrawledArticle[]> {
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
    
    // Extract articles
    const articles = await page.evaluate((sel) => {
      const results: any[] = [];
      const elements = document.querySelectorAll(sel.selector);
      
      elements.forEach((element) => {
        const title = element.querySelector(sel.titleSelector)?.textContent?.trim() || '';
        const content = element.querySelector(sel.contentSelector)?.textContent?.trim() || '';
        const linkElement = element.querySelector(sel.linkSelector) as HTMLAnchorElement;
        const url = linkElement?.href || '';
        
        if (title && content) {
          results.push({ title, content, url });
        }
      });
      
      return results;
    }, selectors);
    
    return articles.map(article => ({
      ...article,
      metadata: {
        source: selectors.name,
        timestamp: new Date().toISOString(),
        id: `${selectors.name}-${Date.now()}`
      }
    }));
  } catch (error) {
    console.error(`[Browser] Error crawling ${url}:`, error);
    return [];
  } finally {
    await page.close();
  }
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
};

// Multi-strategy crawler
export class AdvancedCrawler {
  private source: any;
  
  constructor(source: any) {
    this.source = source;
  }
  
  async crawl(): Promise<CrawledArticle[]> {
    const strategies: CrawlStrategy[] = [
      // Strategy 1: Try RSS/API feeds
      {
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
      },
      
      // Strategy 2: Simple fetch with advanced headers
      {
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
              // Add cookie jar support
              withCredentials: true,
              // Decompress response
              decompress: true,
            });
            
            if (response.status === 200) {
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
                    metadata: {
                      source: this.source.name,
                      timestamp: new Date().toISOString(),
                      id: `${this.source.name}-${Date.now()}`
                    }
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
      },
      
      // Strategy 3: Firecrawl ONLY for blocked sources (DeepMind & Anthropic)
      {
        name: 'Firecrawl',
        execute: async () => {
          // ONLY use for sources that are completely blocked
          if (['DeepMind Research', 'Anthropic Blog'].includes(this.source.name)) {
            console.log(`[Firecrawl] Using limited API for blocked source: ${this.source.name}`);
            
            // Try direct crawl with Firecrawl
            const articles = await crawlWithFirecrawl(this.source.url, this.source.name);
            return articles;
          }
          return [];
        }
      },
      
      // Strategy 4: Browser automation
      {
        name: 'Browser Automation',
        execute: async () => {
          await limiter.removeTokens(1);
          return await crawlWithBrowser(this.source.url, this.source);
        }
      }
    ];
    
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