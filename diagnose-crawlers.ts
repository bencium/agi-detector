import { chromium } from 'playwright';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { parseStringPromise } from 'xml2js';
import FirecrawlApp from '@mendable/firecrawl-js';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';

const prisma = new PrismaClient();

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Test results interface
interface TestResult {
  source: string;
  method: string;
  success: boolean;
  articlesFound: number;
  error?: string;
  details?: any;
}

const testResults: TestResult[] = [];

// RSS feed URLs to test
const RSS_FEEDS = {
  'OpenAI Blog': [
    'https://openai.com/blog/rss/',
    'https://openai.com/blog/rss.xml',
    'https://openai.com/rss/',
    'https://openai.com/feed/',
    'https://openai.com/blog/feed/',
  ],
  'DeepMind Research': [
    'https://deepmind.google/discover/feed.xml',
    'https://deepmind.google/feed.xml',
    'https://deepmind.google/research/feed.xml',
    'https://deepmind.com/blog/feed.xml',
    'https://www.deepmind.com/blog/rss.xml',
    'https://deepmind.google/discover/blog/feed.xml',
  ],
  'Anthropic Blog': [
    'https://www.anthropic.com/rss.xml',
    'https://www.anthropic.com/feed.xml',
    'https://www.anthropic.com/news/feed.xml',
    'https://www.anthropic.com/index/feed.xml',
    'https://anthropic.com/rss.xml',
    'https://anthropic.com/feed/',
  ],
};

// Test RSS feed
async function testRSSFeed(url: string, sourceName: string): Promise<boolean> {
  try {
    log(`  Testing RSS: ${url}`, colors.cyan);
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AGI-Detector/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      timeout: 10000,
      validateStatus: () => true,
    });

    if (response.status !== 200) {
      log(`    ❌ HTTP ${response.status}`, colors.red);
      return false;
    }

    // Try to parse as XML
    const parsed = await parseStringPromise(response.data);
    const items = parsed.rss?.channel?.[0]?.item || parsed.feed?.entry || [];
    
    if (items.length > 0) {
      log(`    ✅ Found ${items.length} items`, colors.green);
      testResults.push({
        source: sourceName,
        method: `RSS (${url})`,
        success: true,
        articlesFound: items.length,
        details: { 
          workingUrl: url,
          sampleTitle: items[0].title?.[0] || items[0].title?.[0]?._ || 'No title'
        }
      });
      return true;
    } else {
      log(`    ❌ No items found`, colors.red);
    }
  } catch (error: any) {
    log(`    ❌ Error: ${error.message}`, colors.red);
  }
  return false;
}

// Test direct HTML scraping
async function testHTMLScraping(source: any): Promise<boolean> {
  try {
    log(`  Testing HTML scraping: ${source.url}`, colors.cyan);
    const response = await axios.get(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);
    const elements = $(source.selector);
    
    log(`    Found ${elements.length} elements matching selector: ${source.selector}`, colors.yellow);
    
    let articlesFound = 0;
    elements.each((_, element) => {
      const $element = $(element);
      const title = $element.find(source.titleSelector).text().trim();
      const content = $element.find(source.contentSelector).text().trim();
      if (title && content) {
        articlesFound++;
      }
    });

    if (articlesFound > 0) {
      log(`    ✅ Found ${articlesFound} articles`, colors.green);
      testResults.push({
        source: source.name,
        method: 'HTML Scraping',
        success: true,
        articlesFound,
      });
      return true;
    } else {
      log(`    ❌ No articles found with current selectors`, colors.red);
      
      // Try to find what selectors might work
      log(`    Debugging selectors...`, colors.yellow);
      const possibleArticleSelectors = ['article', '.post', '.entry', '.item', '[role="article"]', '.content-item'];
      for (const selector of possibleArticleSelectors) {
        const count = $(selector).length;
        if (count > 0) {
          log(`      Found ${count} elements with selector: ${selector}`, colors.cyan);
        }
      }
    }
  } catch (error: any) {
    log(`    ❌ Error: ${error.message}`, colors.red);
    testResults.push({
      source: source.name,
      method: 'HTML Scraping',
      success: false,
      articlesFound: 0,
      error: error.message,
    });
  }
  return false;
}

// Test browser automation
async function testBrowserAutomation(source: any): Promise<boolean> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    log(`  Testing browser automation: ${source.url}`, colors.cyan);
    await page.goto(source.url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Try to find articles
    const articles = await page.evaluate((sel) => {
      const results: any[] = [];
      const elements = document.querySelectorAll(sel.selector);
      
      elements.forEach((element) => {
        const title = element.querySelector(sel.titleSelector)?.textContent?.trim() || '';
        const content = element.querySelector(sel.contentSelector)?.textContent?.trim() || '';
        if (title && content) {
          results.push({ title, content });
        }
      });
      
      return results;
    }, source);

    if (articles.length > 0) {
      log(`    ✅ Found ${articles.length} articles`, colors.green);
      testResults.push({
        source: source.name,
        method: 'Browser Automation',
        success: true,
        articlesFound: articles.length,
        details: { sampleTitle: articles[0].title }
      });
      return true;
    } else {
      log(`    ❌ No articles found`, colors.red);
      
      // Debug: Take screenshot
      const screenshotPath = path.join(process.cwd(), `debug-${source.name.replace(/\s+/g, '-')}.png`);
      await page.screenshot({ path: screenshotPath });
      log(`    📸 Screenshot saved to ${screenshotPath}`, colors.yellow);
    }
  } catch (error: any) {
    log(`    ❌ Error: ${error.message}`, colors.red);
  } finally {
    await browser.close();
  }
  return false;
}

// Test Firecrawl
async function testFirecrawl(source: any): Promise<boolean> {
  const apiKey = process.env.FIRECRAWL_API_KEY || 'fc-4a3d7c98f2c44eb382b6f0e84e9c83f7';
  
  if (!apiKey) {
    log(`  ⚠️  No Firecrawl API key`, colors.yellow);
    return false;
  }

  try {
    log(`  Testing Firecrawl: ${source.url}`, colors.cyan);
    const app = new FirecrawlApp({ apiKey });
    
    if (source.name === 'Anthropic Blog') {
      // Use search for Anthropic
      const searchResults = await app.search('site:anthropic.com AI safety', { limit: 3 });
      if (searchResults.success && searchResults.data) {
        log(`    ✅ Found ${searchResults.data.length} articles via search`, colors.green);
        testResults.push({
          source: source.name,
          method: 'Firecrawl Search',
          success: true,
          articlesFound: searchResults.data.length,
          details: { sampleTitle: searchResults.data[0]?.title }
        });
        return true;
      }
    } else {
      // Use scrape for others
      const result = await app.scrapeUrl(source.url, { formats: ['markdown', 'html'] });
      if (result.success && result.data) {
        log(`    ✅ Successfully scraped page`, colors.green);
        testResults.push({
          source: source.name,
          method: 'Firecrawl Scrape',
          success: true,
          articlesFound: 1,
          details: { title: result.data.metadata?.title }
        });
        return true;
      }
    }
  } catch (error: any) {
    log(`    ❌ Error: ${error.message}`, colors.red);
  }
  return false;
}

// Test database connection and data
async function testDatabase() {
  log('\n📊 Testing Database', colors.bright + colors.blue);
  
  try {
    // Test connection
    await prisma.$connect();
    log('  ✅ Database connected', colors.green);
    
    // Count articles by source
    const sources = await prisma.crawlResult.groupBy({
      by: ['metadata'],
      _count: true,
    });
    
    log('\n  Article counts by source:', colors.yellow);
    const sourceCounts = new Map<string, number>();
    
    for (const item of sources) {
      const metadata = item.metadata as any;
      const source = metadata?.source || 'Unknown';
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + item._count);
    }
    
    sourceCounts.forEach((count, source) => {
      log(`    ${source}: ${count}`, colors.cyan);
    });
    
    // Check recent articles
    const recentArticles = await prisma.crawlResult.findMany({
      take: 5,
      orderBy: { crawledAt: 'desc' },
    });
    
    log('\n  Most recent articles:', colors.yellow);
    for (const article of recentArticles) {
      const metadata = article.metadata as any;
      log(`    [${metadata?.source}] ${article.title.substring(0, 60)}...`, colors.cyan);
      log(`      Crawled: ${article.crawledAt.toISOString()}`, colors.reset);
    }
    
  } catch (error: any) {
    log(`  ❌ Database error: ${error.message}`, colors.red);
  }
}

// Test specific sources
const SOURCES_TO_TEST = [
  {
    name: 'OpenAI Blog',
    url: 'https://openai.com/blog',
    selector: '.ui-list__item',
    titleSelector: '.ui-title-text',
    contentSelector: '.prose',
    linkSelector: 'a',
  },
  {
    name: 'DeepMind Research',
    url: 'https://deepmind.google/research/',
    selector: '.research-card',
    titleSelector: 'h3',
    contentSelector: 'p',
    linkSelector: 'a',
  },
  {
    name: 'Anthropic Blog',
    url: 'https://www.anthropic.com/news',
    selector: '.news-item',
    titleSelector: 'h2, h3',
    contentSelector: 'p',
    linkSelector: 'a',
  },
];

// Main diagnostic function
async function diagnose() {
  log('🔍 AGI Detector Crawler Diagnostics', colors.bright + colors.magenta);
  log('===================================\n', colors.bright);

  // Test each source
  for (const source of SOURCES_TO_TEST) {
    log(`\n📌 Testing ${source.name}`, colors.bright + colors.yellow);
    log('─'.repeat(40), colors.yellow);
    
    // Test RSS feeds
    const rssUrls = RSS_FEEDS[source.name] || [];
    let rssWorking = false;
    for (const url of rssUrls) {
      if (await testRSSFeed(url, source.name)) {
        rssWorking = true;
        break;
      }
    }
    
    if (!rssWorking) {
      log('  ❌ No working RSS feeds found', colors.red);
      
      // Test other methods
      await testHTMLScraping(source);
      await testBrowserAutomation(source);
      
      // Test Firecrawl only for problematic sources
      if (['DeepMind Research', 'Anthropic Blog'].includes(source.name)) {
        await testFirecrawl(source);
      }
    }
  }

  // Test database
  await testDatabase();

  // Summary
  log('\n\n📋 Summary Report', colors.bright + colors.magenta);
  log('=================\n', colors.bright);
  
  const successfulSources = new Set(testResults.filter(r => r.success).map(r => r.source));
  const failedSources = SOURCES_TO_TEST.filter(s => !successfulSources.has(s.name));
  
  log('✅ Working sources:', colors.green);
  for (const result of testResults.filter(r => r.success)) {
    log(`  ${result.source}: ${result.method} (${result.articlesFound} articles)`, colors.cyan);
    if (result.details?.workingUrl) {
      log(`    Working URL: ${result.details.workingUrl}`, colors.reset);
    }
  }
  
  if (failedSources.length > 0) {
    log('\n❌ Failed sources:', colors.red);
    for (const source of failedSources) {
      log(`  ${source.name}`, colors.red);
    }
  }

  // Save results to file
  const reportPath = path.join(process.cwd(), 'crawler-diagnostic-report.json');
  await fs.writeFile(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    testResults,
    recommendations: generateRecommendations(testResults, failedSources),
  }, null, 2));
  
  log(`\n📄 Full report saved to: ${reportPath}`, colors.bright + colors.blue);
  
  await prisma.$disconnect();
}

// Generate recommendations based on test results
function generateRecommendations(results: TestResult[], failedSources: any[]) {
  const recommendations = [];
  
  // Check for working RSS feeds
  const workingRSS = results.filter(r => r.success && r.method.includes('RSS'));
  if (workingRSS.length > 0) {
    recommendations.push({
      type: 'UPDATE_RSS_URLS',
      description: 'Update RSS feed URLs in the crawler configuration',
      details: workingRSS.map(r => ({
        source: r.source,
        url: r.details?.workingUrl
      }))
    });
  }
  
  // Check for sources that need Firecrawl
  const needsFirecrawl = failedSources.filter(s => 
    ['DeepMind Research', 'Anthropic Blog'].includes(s.name)
  );
  if (needsFirecrawl.length > 0) {
    recommendations.push({
      type: 'USE_FIRECRAWL',
      description: 'These sources require Firecrawl due to anti-scraping measures',
      sources: needsFirecrawl.map(s => s.name)
    });
  }
  
  // Check for selector updates needed
  const selectorIssues = results.filter(r => !r.success && r.method === 'HTML Scraping');
  if (selectorIssues.length > 0) {
    recommendations.push({
      type: 'UPDATE_SELECTORS',
      description: 'These sources need updated HTML selectors',
      sources: selectorIssues.map(r => r.source)
    });
  }
  
  return recommendations;
}

// Run diagnostics
diagnose().catch(console.error);