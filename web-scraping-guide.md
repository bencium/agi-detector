# Modern Web Scraping & Crawling Techniques Guide

## Overview

This guide covers modern approaches to web scraping that can handle various anti-bot measures, JavaScript-rendered content, and rate limiting challenges in 2024.

## 1. Browser Automation Solutions

### Playwright (Recommended)

Playwright is Microsoft's modern browser automation framework that's more robust than Puppeteer for handling anti-bot measures.

```typescript
import { chromium } from 'playwright';
import { PlaywrightExtra } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Enhanced Playwright setup with stealth
const playwrightExtra = new PlaywrightExtra(chromium);
playwrightExtra.use(StealthPlugin());

async function scrapePage(url: string) {
  const browser = await playwrightExtra.launch({
    headless: false, // Set to true in production
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });

  const page = await context.newPage();
  
  // Random delays to appear more human
  await page.waitForTimeout(Math.random() * 2000 + 1000);
  
  await page.goto(url, { 
    waitUntil: 'networkidle',
    timeout: 30000 
  });

  return page;
}
```

### Puppeteer with Stealth

```typescript
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

async function stealthScrape(url: string) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });

  const page = await browser.newPage();
  
  // Randomize viewport
  await page.setViewport({
    width: 1920 + Math.floor(Math.random() * 100),
    height: 1080 + Math.floor(Math.random() * 100)
  });

  // Override navigator properties
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  });

  return { browser, page };
}
```

## 2. Handling Cloudflare Protection

### CloudflareBypasser Approach

```typescript
import { CloudflareBypasser } from 'cloudflare-bypasser';

class CloudflareHandler {
  private bypasser: CloudflareBypasser;

  constructor() {
    this.bypasser = new CloudflareBypasser();
  }

  async handleCloudflare(page: any) {
    // Wait for Cloudflare challenge
    const hasChallenge = await page.evaluate(() => {
      return document.title.includes('Just a moment') || 
             document.querySelector('.cf-browser-verification');
    });

    if (hasChallenge) {
      console.log('Cloudflare challenge detected, waiting...');
      await page.waitForTimeout(5000);
      
      // Wait for redirect after challenge
      await page.waitForNavigation({ 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
    }

    return page;
  }
}
```

### Using Undetected-Chromedriver Alternative

```typescript
import { Browser } from 'playwright';

async function createStealthBrowser(): Promise<Browser> {
  const browser = await chromium.launch({
    channel: 'chrome', // Use actual Chrome
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--exclude-switches=enable-automation',
      '--disable-infobars',
      '--disable-dev-shm-usage',
      '--disable-browser-side-navigation',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  return browser;
}
```

## 3. Rate Limiting & Request Management

### Intelligent Rate Limiter

```typescript
import { RateLimiter } from 'limiter';

class SmartScraper {
  private limiter: RateLimiter;
  private requestQueue: Array<() => Promise<any>> = [];

  constructor() {
    // 10 requests per minute with burst capability
    this.limiter = new RateLimiter({
      tokensPerInterval: 10,
      interval: 'minute',
      fireImmediately: true
    });
  }

  async scrapeWithRateLimit(urls: string[]) {
    const results = [];
    
    for (const url of urls) {
      await this.limiter.removeTokens(1);
      
      // Random delay between requests (1-5 seconds)
      await this.delay(1000 + Math.random() * 4000);
      
      try {
        const result = await this.scrapeSinglePage(url);
        results.push(result);
      } catch (error) {
        if (error.message.includes('403')) {
          console.log('Rate limited, backing off...');
          await this.exponentialBackoff();
        }
      }
    }
    
    return results;
  }

  private async exponentialBackoff(attempt: number = 1) {
    const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
    await this.delay(delay);
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## 4. Proxy Rotation System

### Advanced Proxy Rotator

```typescript
interface Proxy {
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol: 'http' | 'socks5';
}

class ProxyRotator {
  private proxies: Proxy[] = [];
  private currentIndex: number = 0;
  private failedProxies: Set<string> = new Set();

  constructor(proxies: Proxy[]) {
    this.proxies = proxies;
  }

  getNextProxy(): Proxy | null {
    let attempts = 0;
    
    while (attempts < this.proxies.length) {
      const proxy = this.proxies[this.currentIndex];
      const proxyId = `${proxy.host}:${proxy.port}`;
      
      this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
      attempts++;
      
      if (!this.failedProxies.has(proxyId)) {
        return proxy;
      }
    }
    
    // All proxies failed, clear failed list and try again
    this.failedProxies.clear();
    return this.proxies[0];
  }

  markProxyFailed(proxy: Proxy) {
    this.failedProxies.add(`${proxy.host}:${proxy.port}`);
  }

  async createBrowserWithProxy(proxy: Proxy) {
    const proxyUrl = proxy.username 
      ? `${proxy.protocol}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
      : `${proxy.protocol}://${proxy.host}:${proxy.port}`;

    const browser = await chromium.launch({
      proxy: {
        server: proxyUrl
      }
    });

    return browser;
  }
}
```

## 5. User Agent Rotation

### Dynamic User Agent Manager

```typescript
class UserAgentManager {
  private userAgents = [
    // Chrome on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    // Chrome on Mac
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    // Firefox on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    // Safari on Mac
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    // Edge on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
  ];

  getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  async setupBrowserContext(browser: Browser) {
    const userAgent = this.getRandomUserAgent();
    const context = await browser.newContext({
      userAgent,
      viewport: this.getMatchingViewport(userAgent),
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['geolocation'],
      geolocation: { latitude: 40.7128, longitude: -74.0060 }
    });

    return context;
  }

  private getMatchingViewport(userAgent: string) {
    if (userAgent.includes('Mobile')) {
      return { width: 375, height: 812 };
    }
    return { 
      width: 1920 + Math.floor(Math.random() * 200 - 100),
      height: 1080 + Math.floor(Math.random() * 200 - 100)
    };
  }
}
```

## 6. Cookie & Session Management

### Advanced Cookie Handler

```typescript
import { Cookie } from 'playwright';

class CookieManager {
  private cookieStore: Map<string, Cookie[]> = new Map();

  async saveCookies(domain: string, context: any) {
    const cookies = await context.cookies();
    this.cookieStore.set(domain, cookies);
  }

  async loadCookies(domain: string, context: any) {
    const cookies = this.cookieStore.get(domain);
    if (cookies) {
      await context.addCookies(cookies);
    }
  }

  async maintainSession(page: any, url: string) {
    // Periodically refresh the page to maintain session
    setInterval(async () => {
      try {
        await page.reload({ waitUntil: 'networkidle' });
      } catch (error) {
        console.error('Session refresh failed:', error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }
}
```

## 7. Alternative Data Sources

### RSS Feed Parser

```typescript
import Parser from 'rss-parser';

class RSSFeedScraper {
  private parser: Parser;

  constructor() {
    this.parser = new Parser({
      customFields: {
        item: ['media:content', 'content:encoded']
      }
    });
  }

  async scrapeRSSFeed(feedUrl: string) {
    try {
      const feed = await this.parser.parseURL(feedUrl);
      
      return feed.items.map(item => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        content: item['content:encoded'] || item.content,
        media: item['media:content']
      }));
    } catch (error) {
      console.error('RSS parsing failed:', error);
      return [];
    }
  }

  async findRSSFeeds(domain: string) {
    const commonPaths = [
      '/rss',
      '/feed',
      '/rss.xml',
      '/feed.xml',
      '/atom.xml',
      '/feeds/posts/default',
      '/blog/feed',
      '/news/feed'
    ];

    const foundFeeds = [];
    
    for (const path of commonPaths) {
      try {
        const feedUrl = `https://${domain}${path}`;
        await this.parser.parseURL(feedUrl);
        foundFeeds.push(feedUrl);
      } catch (error) {
        // Feed not found at this path
      }
    }

    return foundFeeds;
  }
}
```

### API Discovery & Usage

```typescript
class APIDiscovery {
  async findAPIs(domain: string) {
    const commonAPIPatterns = [
      '/api',
      '/v1',
      '/v2',
      '/graphql',
      '/rest',
      '/.well-known',
      '/swagger.json',
      '/openapi.json'
    ];

    const discovered = [];

    for (const pattern of commonAPIPatterns) {
      try {
        const response = await fetch(`https://${domain}${pattern}`);
        if (response.ok) {
          discovered.push({
            endpoint: pattern,
            status: response.status,
            headers: Object.fromEntries(response.headers)
          });
        }
      } catch (error) {
        // API not found
      }
    }

    return discovered;
  }
}
```

## 8. Next.js/TypeScript Implementation

### Complete Scraper Service

```typescript
// scraper.service.ts
import { Browser, Page } from 'playwright';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

export interface ScraperOptions {
  useProxy?: boolean;
  useRandomUserAgent?: boolean;
  headless?: boolean;
  timeout?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  rateLimit?: number; // requests per minute
}

export class WebScraperService {
  private browser: Browser | null = null;
  private userAgentManager: UserAgentManager;
  private proxyRotator: ProxyRotator | null = null;
  private rateLimiter: RateLimiter;

  constructor(private options: ScraperOptions = {}) {
    this.userAgentManager = new UserAgentManager();
    this.rateLimiter = new RateLimiter({
      tokensPerInterval: options.rateLimit || 30,
      interval: 'minute'
    });
  }

  async initialize() {
    const playwrightExtra = chromium.use(StealthPlugin());
    
    this.browser = await playwrightExtra.launch({
      headless: this.options.headless ?? true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });
  }

  async scrape(url: string): Promise<any> {
    if (!this.browser) {
      await this.initialize();
    }

    await this.rateLimiter.removeTokens(1);

    const context = await this.createContext();
    const page = await context.newPage();

    try {
      // Handle navigation with retry logic
      await this.navigateWithRetry(page, url);
      
      // Wait for content to load
      await this.waitForContent(page);

      // Extract data
      const data = await this.extractData(page);

      return data;
    } catch (error) {
      console.error('Scraping failed:', error);
      throw error;
    } finally {
      await page.close();
      await context.close();
    }
  }

  private async createContext() {
    if (!this.browser) throw new Error('Browser not initialized');

    const contextOptions: any = {
      userAgent: this.options.useRandomUserAgent 
        ? this.userAgentManager.getRandomUserAgent()
        : undefined,
      viewport: { width: 1920, height: 1080 }
    };

    if (this.options.useProxy && this.proxyRotator) {
      const proxy = this.proxyRotator.getNextProxy();
      if (proxy) {
        contextOptions.proxy = {
          server: `${proxy.protocol}://${proxy.host}:${proxy.port}`,
          username: proxy.username,
          password: proxy.password
        };
      }
    }

    return await this.browser.newContext(contextOptions);
  }

  private async navigateWithRetry(page: Page, url: string, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await page.goto(url, {
          waitUntil: this.options.waitUntil || 'networkidle',
          timeout: this.options.timeout || 30000
        });

        // Check for Cloudflare challenge
        const isCloudflare = await page.evaluate(() => {
          return document.title.includes('Just a moment');
        });

        if (isCloudflare) {
          console.log('Cloudflare detected, waiting...');
          await page.waitForTimeout(10000);
          await page.waitForNavigation({ waitUntil: 'networkidle' });
        }

        return;
      } catch (error) {
        console.error(`Navigation attempt ${i + 1} failed:`, error);
        if (i === maxRetries - 1) throw error;
        
        // Exponential backoff
        await page.waitForTimeout(Math.pow(2, i) * 1000);
      }
    }
  }

  private async waitForContent(page: Page) {
    // Wait for common content indicators
    try {
      await Promise.race([
        page.waitForSelector('body', { timeout: 5000 }),
        page.waitForSelector('main', { timeout: 5000 }),
        page.waitForSelector('#content', { timeout: 5000 }),
        page.waitForSelector('[role="main"]', { timeout: 5000 })
      ]);
    } catch {
      // Content selectors not found, continue anyway
    }

    // Additional wait for dynamic content
    await page.waitForTimeout(2000);
  }

  private async extractData(page: Page) {
    return await page.evaluate(() => {
      const data: any = {
        title: document.title,
        url: window.location.href,
        meta: {}
      };

      // Extract meta tags
      const metaTags = document.querySelectorAll('meta');
      metaTags.forEach(tag => {
        const name = tag.getAttribute('name') || tag.getAttribute('property');
        const content = tag.getAttribute('content');
        if (name && content) {
          data.meta[name] = content;
        }
      });

      // Extract main content
      const contentSelectors = [
        'main',
        'article',
        '[role="main"]',
        '#content',
        '.content',
        'body'
      ];

      for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          data.content = element.textContent?.trim();
          data.html = element.innerHTML;
          break;
        }
      }

      // Extract links
      data.links = Array.from(document.querySelectorAll('a[href]'))
        .map(a => ({
          text: a.textContent?.trim(),
          href: a.getAttribute('href')
        }))
        .filter(link => link.href);

      // Extract images
      data.images = Array.from(document.querySelectorAll('img[src]'))
        .map(img => ({
          src: img.getAttribute('src'),
          alt: img.getAttribute('alt')
        }));

      return data;
    });
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
```

### Next.js API Route Example

```typescript
// pages/api/scrape.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { WebScraperService } from '@/services/scraper.service';

const scraper = new WebScraperService({
  headless: true,
  useRandomUserAgent: true,
  rateLimit: 20
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const data = await scraper.scrape(url);
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Scraping failed' 
    });
  }
}
```

## 9. Best Practices & Tips

### Error Handling & Resilience

```typescript
class ResilientScraper {
  async scrapeWithFallback(url: string) {
    const strategies = [
      () => this.scrapeWithPlaywright(url),
      () => this.scrapeWithPuppeteer(url),
      () => this.scrapeWithFetch(url),
      () => this.scrapeFromRSS(url),
      () => this.scrapeFromAPI(url)
    ];

    for (const strategy of strategies) {
      try {
        const result = await strategy();
        if (result) return result;
      } catch (error) {
        console.log(`Strategy failed: ${strategy.name}`, error);
        continue;
      }
    }

    throw new Error('All scraping strategies failed');
  }
}
```

### Performance Optimization

```typescript
class OptimizedScraper {
  async scrapeBatch(urls: string[], concurrency = 3) {
    const results = [];
    const chunks = this.chunkArray(urls, concurrency);

    for (const chunk of chunks) {
      const promises = chunk.map(url => this.scrapeWithTimeout(url));
      const chunkResults = await Promise.allSettled(promises);
      
      results.push(...chunkResults.map((result, index) => ({
        url: chunk[index],
        status: result.status,
        data: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason : null
      })));

      // Rate limiting between batches
      await this.delay(2000);
    }

    return results;
  }

  private async scrapeWithTimeout(url: string, timeout = 30000) {
    return Promise.race([
      this.scrape(url),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), timeout)
      )
    ]);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
```

## 10. Legal & Ethical Considerations

1. **Always check robots.txt**: Respect website scraping policies
2. **Implement rate limiting**: Don't overwhelm servers
3. **Use official APIs when available**: Prefer legitimate data sources
4. **Respect copyright**: Don't scrape copyrighted content without permission
5. **Add contact information**: Include User-Agent with contact details
6. **Cache responses**: Minimize repeated requests to the same content

## Conclusion

Modern web scraping requires a multi-layered approach combining:
- Browser automation with stealth techniques
- Intelligent rate limiting and request management
- Proxy and user agent rotation
- Fallback strategies (RSS, APIs)
- Proper error handling and resilience

The key is to start with the least invasive method (APIs, RSS) and progressively use more sophisticated techniques only when necessary.