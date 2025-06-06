// scraper-implementation.ts
// Practical web scraper implementation for Next.js/TypeScript

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { PlaywrightExtra } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { RateLimiter } from 'limiter';
import Parser from 'rss-parser';

// Types
interface ScraperConfig {
  headless?: boolean;
  timeout?: number;
  maxRetries?: number;
  rateLimit?: {
    requests: number;
    per: 'second' | 'minute' | 'hour';
  };
  proxies?: Proxy[];
  userAgents?: string[];
}

interface Proxy {
  server: string;
  username?: string;
  password?: string;
}

interface ScrapeResult {
  url: string;
  success: boolean;
  data?: any;
  error?: string;
  method: 'browser' | 'rss' | 'api' | 'fetch';
}

// Default User Agents
const DEFAULT_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
];

export class ModernWebScraper {
  private browser: Browser | null = null;
  private rateLimiter: RateLimiter;
  private rssParser: Parser;
  private config: ScraperConfig;
  private proxyIndex: number = 0;
  private userAgentIndex: number = 0;

  constructor(config: ScraperConfig = {}) {
    this.config = {
      headless: true,
      timeout: 30000,
      maxRetries: 3,
      rateLimit: { requests: 10, per: 'minute' },
      userAgents: DEFAULT_USER_AGENTS,
      ...config
    };

    // Initialize rate limiter
    const { requests, per } = this.config.rateLimit!;
    this.rateLimiter = new RateLimiter({
      tokensPerInterval: requests,
      interval: per,
      fireImmediately: true
    });

    // Initialize RSS parser
    this.rssParser = new Parser({
      customFields: {
        item: ['media:content', 'content:encoded', 'dc:creator']
      }
    });
  }

  // Main scraping method with fallback strategies
  async scrape(url: string): Promise<ScrapeResult> {
    // Wait for rate limit
    await this.rateLimiter.removeTokens(1);

    // Try different strategies in order
    const strategies = [
      { method: 'rss' as const, fn: () => this.tryRSSFeed(url) },
      { method: 'api' as const, fn: () => this.tryAPI(url) },
      { method: 'fetch' as const, fn: () => this.trySimpleFetch(url) },
      { method: 'browser' as const, fn: () => this.tryBrowserScraping(url) }
    ];

    for (const { method, fn } of strategies) {
      try {
        const data = await fn();
        if (data) {
          return { url, success: true, data, method };
        }
      } catch (error) {
        console.log(`${method} strategy failed for ${url}:`, error);
      }
    }

    return { 
      url, 
      success: false, 
      error: 'All scraping strategies failed',
      method: 'browser'
    };
  }

  // Strategy 1: Try RSS feeds
  private async tryRSSFeed(url: string): Promise<any | null> {
    const domain = new URL(url).hostname;
    const feedPaths = ['/rss', '/feed', '/rss.xml', '/feed.xml', '/atom.xml'];
    
    for (const path of feedPaths) {
      try {
        const feedUrl = `https://${domain}${path}`;
        const feed = await this.rssParser.parseURL(feedUrl);
        
        if (feed && feed.items.length > 0) {
          return {
            type: 'rss',
            title: feed.title,
            description: feed.description,
            items: feed.items.slice(0, 50).map(item => ({
              title: item.title,
              link: item.link,
              pubDate: item.pubDate,
              content: item['content:encoded'] || item.content || item.summary,
              author: item['dc:creator'] || item.creator
            }))
          };
        }
      } catch (error) {
        // RSS feed not found, continue
      }
    }
    
    return null;
  }

  // Strategy 2: Try common API endpoints
  private async tryAPI(url: string): Promise<any | null> {
    const domain = new URL(url).hostname;
    const apiPaths = ['/api', '/v1', '/v2', '/graphql', '/.well-known'];
    
    for (const path of apiPaths) {
      try {
        const apiUrl = `https://${domain}${path}`;
        const response = await fetch(apiUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': this.getNextUserAgent()
          }
        });
        
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            return await response.json();
          }
        }
      } catch (error) {
        // API endpoint not found, continue
      }
    }
    
    return null;
  }

  // Strategy 3: Simple fetch with parsing
  private async trySimpleFetch(url: string): Promise<any | null> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.getNextUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        if (response.status === 403 || response.status === 429) {
          throw new Error(`Rate limited or blocked: ${response.status}`);
        }
        return null;
      }

      const html = await response.text();
      
      // Basic HTML parsing (you might want to use cheerio here)
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const metaDescription = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i);
      
      return {
        type: 'fetch',
        title: titleMatch ? titleMatch[1] : '',
        description: metaDescription ? metaDescription[1] : '',
        html: html.substring(0, 50000) // Limit HTML size
      };
    } catch (error) {
      return null;
    }
  }

  // Strategy 4: Full browser automation
  private async tryBrowserScraping(url: string): Promise<any> {
    const context = await this.createBrowserContext();
    const page = await context.newPage();

    try {
      // Set up page event handlers
      await this.setupPageHandlers(page);

      // Navigate with retry logic
      await this.navigateWithRetry(page, url);

      // Handle Cloudflare if present
      await this.handleCloudflare(page);

      // Wait for content
      await this.waitForContent(page);

      // Extract data
      const data = await page.evaluate(() => {
        const extractText = (selector: string): string | null => {
          const element = document.querySelector(selector);
          return element?.textContent?.trim() || null;
        };

        const extractMeta = (name: string): string | null => {
          const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
          return meta?.getAttribute('content') || null;
        };

        return {
          type: 'browser',
          title: document.title,
          url: window.location.href,
          meta: {
            description: extractMeta('description'),
            keywords: extractMeta('keywords'),
            author: extractMeta('author'),
            ogTitle: extractMeta('og:title'),
            ogDescription: extractMeta('og:description'),
            ogImage: extractMeta('og:image')
          },
          content: {
            h1: extractText('h1'),
            main: extractText('main, article, [role="main"], #content, .content'),
            paragraphs: Array.from(document.querySelectorAll('p'))
              .slice(0, 10)
              .map(p => p.textContent?.trim())
              .filter(Boolean)
          },
          links: Array.from(document.querySelectorAll('a[href]'))
            .slice(0, 50)
            .map(a => ({
              text: a.textContent?.trim(),
              href: a.getAttribute('href')
            }))
            .filter(link => link.href && link.text),
          images: Array.from(document.querySelectorAll('img[src]'))
            .slice(0, 20)
            .map(img => ({
              src: img.getAttribute('src'),
              alt: img.getAttribute('alt'),
              width: img.width,
              height: img.height
            }))
        };
      });

      return data;
    } finally {
      await page.close();
      await context.close();
    }
  }

  // Create browser context with stealth settings
  private async createBrowserContext(): Promise<BrowserContext> {
    if (!this.browser) {
      await this.initializeBrowser();
    }

    const contextOptions: any = {
      userAgent: this.getNextUserAgent(),
      viewport: {
        width: 1920 + Math.floor(Math.random() * 100),
        height: 1080 + Math.floor(Math.random() * 100)
      },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['geolocation'],
      geolocation: { latitude: 40.7128, longitude: -74.0060 },
      colorScheme: 'light',
      reducedMotion: 'reduce',
      forcedColors: 'none'
    };

    // Add proxy if configured
    if (this.config.proxies && this.config.proxies.length > 0) {
      const proxy = this.getNextProxy();
      if (proxy) {
        contextOptions.proxy = proxy;
      }
    }

    const context = await this.browser!.newContext(contextOptions);

    // Add extra headers
    await context.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    });

    return context;
  }

  // Initialize browser with stealth plugin
  private async initializeBrowser() {
    const playwrightExtra = new PlaywrightExtra(chromium);
    playwrightExtra.use(StealthPlugin());

    this.browser = await playwrightExtra.launch({
      headless: this.config.headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-web-security',
        '--disable-setuid-sandbox',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
  }

  // Set up page event handlers
  private async setupPageHandlers(page: Page) {
    // Override navigator.webdriver
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false
      });
    });

    // Add some fake plugins
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          { name: 'Native Client', filename: 'internal-nacl-plugin' }
        ]
      });
    });

    // Handle dialog boxes
    page.on('dialog', async dialog => {
      await dialog.dismiss();
    });

    // Handle new popups
    page.on('popup', async popup => {
      await popup.close();
    });
  }

  // Navigate with retry and error handling
  private async navigateWithRetry(page: Page, url: string) {
    const maxRetries = this.config.maxRetries || 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: this.config.timeout
        });
        
        // Check for common error pages
        const title = await page.title();
        if (title.includes('404') || title.includes('Not Found')) {
          throw new Error('Page not found');
        }
        
        return; // Success
      } catch (error) {
        lastError = error as Error;
        console.log(`Navigation attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          // Exponential backoff
          await page.waitForTimeout(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw lastError || new Error('Navigation failed');
  }

  // Handle Cloudflare challenges
  private async handleCloudflare(page: Page) {
    try {
      const hasCloudflare = await page.evaluate(() => {
        const title = document.title.toLowerCase();
        return title.includes('just a moment') || 
               title.includes('cloudflare') ||
               document.querySelector('.cf-browser-verification') !== null;
      });

      if (hasCloudflare) {
        console.log('Cloudflare challenge detected, waiting...');
        
        // Wait for challenge to complete
        await page.waitForFunction(
          () => !document.title.toLowerCase().includes('just a moment'),
          { timeout: 30000 }
        );
        
        // Additional wait for redirect
        await page.waitForTimeout(2000);
      }
    } catch (error) {
      console.log('Cloudflare handling error:', error);
    }
  }

  // Wait for content to load
  private async waitForContent(page: Page) {
    try {
      // Wait for common content selectors
      await Promise.race([
        page.waitForSelector('main', { timeout: 5000 }),
        page.waitForSelector('article', { timeout: 5000 }),
        page.waitForSelector('#content', { timeout: 5000 }),
        page.waitForSelector('.content', { timeout: 5000 }),
        page.waitForSelector('[role="main"]', { timeout: 5000 })
      ]);
    } catch {
      // If no content selectors found, wait for network idle
      try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
      } catch {
        // Even if network idle fails, continue
      }
    }

    // Always wait a bit for dynamic content
    await page.waitForTimeout(1000);
  }

  // Get next user agent in rotation
  private getNextUserAgent(): string {
    const userAgents = this.config.userAgents || DEFAULT_USER_AGENTS;
    const userAgent = userAgents[this.userAgentIndex];
    this.userAgentIndex = (this.userAgentIndex + 1) % userAgents.length;
    return userAgent;
  }

  // Get next proxy in rotation
  private getNextProxy(): Proxy | null {
    if (!this.config.proxies || this.config.proxies.length === 0) {
      return null;
    }
    
    const proxy = this.config.proxies[this.proxyIndex];
    this.proxyIndex = (this.proxyIndex + 1) % this.config.proxies.length;
    return proxy;
  }

  // Batch scraping with concurrency control
  async scrapeBatch(urls: string[], concurrency: number = 3): Promise<ScrapeResult[]> {
    const results: ScrapeResult[] = [];
    
    // Process URLs in chunks
    for (let i = 0; i < urls.length; i += concurrency) {
      const chunk = urls.slice(i, i + concurrency);
      const chunkPromises = chunk.map(url => this.scrape(url));
      
      const chunkResults = await Promise.allSettled(chunkPromises);
      
      chunkResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            url: chunk[index],
            success: false,
            error: result.reason?.message || 'Unknown error',
            method: 'browser'
          });
        }
      });
      
      // Delay between chunks
      if (i + concurrency < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    return results;
  }

  // Clean up resources
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// Example usage in Next.js API route
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return Response.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  const scraper = new ModernWebScraper({
    headless: true,
    rateLimit: { requests: 10, per: 'minute' },
    maxRetries: 2
  });

  try {
    const result = await scraper.scrape(url);
    return Response.json(result);
  } catch (error) {
    return Response.json({ 
      error: error instanceof Error ? error.message : 'Scraping failed' 
    }, { status: 500 });
  } finally {
    await scraper.close();
  }
}