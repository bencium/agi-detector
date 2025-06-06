import { PrismaClient } from '@prisma/client';
import { crawlWithAdvancedMethods } from './src/lib/advanced-crawler';
import { crawlSource, SOURCES } from './src/lib/crawler';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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

// Test crawling and saving for specific sources
async function testCrawlAndSave() {
  log('🧪 Testing Crawler Database Save Functionality', colors.bright + colors.magenta);
  log('============================================\n', colors.bright);

  // Test sources that should now work
  const testSources = [
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

  for (const source of testSources) {
    log(`\n📌 Testing ${source.name}`, colors.bright + colors.yellow);
    log('─'.repeat(40), colors.yellow);

    try {
      // Crawl the source
      let articles = await crawlWithAdvancedMethods(source);
      
      if (articles.length === 0 && source.name === 'arXiv AI') {
        articles = await crawlSource(source);
      }

      log(`  Found ${articles.length} articles`, articles.length > 0 ? colors.green : colors.red);

      if (articles.length > 0) {
        // Try to save to database
        log(`  Attempting to save to database...`, colors.cyan);
        
        let savedCount = 0;
        let duplicateCount = 0;
        let errorCount = 0;

        for (const article of articles.slice(0, 5)) { // Save only first 5 to avoid using too much Firecrawl quota
          try {
            // Check if article already exists
            const existing = await prisma.crawlResult.findFirst({
              where: {
                url: article.url,
                title: article.title
              }
            });

            if (!existing) {
              const saved = await prisma.crawlResult.create({
                data: {
                  url: article.url,
                  title: article.title,
                  content: article.content.substring(0, 1000), // Limit content length
                  metadata: article.metadata
                }
              });
              savedCount++;
              log(`    ✅ Saved: ${article.title.substring(0, 60)}...`, colors.green);
            } else {
              duplicateCount++;
              log(`    ⏭️  Duplicate: ${article.title.substring(0, 60)}...`, colors.yellow);
            }
          } catch (error: any) {
            errorCount++;
            log(`    ❌ Error saving: ${error.message}`, colors.red);
          }
        }

        log(`\n  Summary for ${source.name}:`, colors.cyan);
        log(`    Articles found: ${articles.length}`, colors.reset);
        log(`    Saved: ${savedCount}`, colors.green);
        log(`    Duplicates: ${duplicateCount}`, colors.yellow);
        log(`    Errors: ${errorCount}`, colors.red);
      }
    } catch (error: any) {
      log(`  ❌ Crawl error: ${error.message}`, colors.red);
    }
  }

  // Show final database stats
  log('\n\n📊 Final Database Statistics', colors.bright + colors.blue);
  log('============================\n', colors.bright);

  try {
    const sources = await prisma.crawlResult.groupBy({
      by: ['metadata'],
      _count: true,
    });

    const sourceCounts = new Map<string, number>();
    
    for (const item of sources) {
      const metadata = item.metadata as any;
      const source = metadata?.source || 'Unknown';
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + item._count);
    }

    sourceCounts.forEach((count, source) => {
      log(`  ${source}: ${count} articles`, colors.cyan);
    });

    const total = await prisma.crawlResult.count();
    log(`\n  Total articles in database: ${total}`, colors.bright + colors.green);

  } catch (error: any) {
    log(`  ❌ Database stats error: ${error.message}`, colors.red);
  }

  await prisma.$disconnect();
}

// Check environment variables
async function checkEnvironment() {
  log('🔧 Checking Environment', colors.bright + colors.blue);
  log('======================\n', colors.bright);

  const requiredEnvVars = ['DATABASE_URL', 'FIRECRAWL_API_KEY'];
  let allPresent = true;

  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      log(`  ✅ ${envVar}: Present`, colors.green);
      if (envVar === 'DATABASE_URL') {
        // Sanitize database URL for display
        const url = process.env[envVar];
        const sanitized = url.replace(/:([^@]+)@/, ':****@');
        log(`     ${sanitized}`, colors.reset);
      }
    } else {
      log(`  ❌ ${envVar}: Missing`, colors.red);
      allPresent = false;
    }
  }

  if (!allPresent) {
    log('\n⚠️  Missing required environment variables!', colors.bright + colors.red);
    log('Please ensure .env file exists and contains all required variables.', colors.yellow);
    process.exit(1);
  }

  return true;
}

// Main function
async function main() {
  await checkEnvironment();
  await testCrawlAndSave();
}

main().catch((error) => {
  log(`\n💥 Fatal error: ${error.message}`, colors.bright + colors.red);
  console.error(error);
  process.exit(1);
});