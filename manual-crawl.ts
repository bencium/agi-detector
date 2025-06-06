import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { crawlAllSources } from './src/lib/crawler';
import { cleanupBrowser } from './src/lib/advanced-crawler';

// Load environment variables
dotenv.config();

// Set Firecrawl API key as environment variable
process.env.FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || 'fc-4a3d7c98f2c44eb382b6f0e84e9c83f7';

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

async function performManualCrawl() {
  log('🚀 Starting Manual Crawl of All Sources', colors.bright + colors.magenta);
  log('======================================\n', colors.bright);

  try {
    // Crawl all sources
    log('Crawling all sources...', colors.cyan);
    const crawledResults = await crawlAllSources();
    
    log(`\n✅ Successfully crawled ${crawledResults.length} articles total`, colors.green);
    
    // Group by source
    const articlesBySource = new Map<string, number>();
    crawledResults.forEach(article => {
      const source = article.metadata.source;
      articlesBySource.set(source, (articlesBySource.get(source) || 0) + 1);
    });
    
    log('\nArticles found by source:', colors.yellow);
    articlesBySource.forEach((count, source) => {
      log(`  ${source}: ${count}`, colors.cyan);
    });

    // Save to database
    log('\n💾 Saving to database...', colors.blue);
    
    let savedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    
    for (const result of crawledResults) {
      try {
        // Check if article already exists
        const existing = await prisma.crawlResult.findFirst({
          where: {
            url: result.url,
            title: result.title
          }
        });
        
        if (!existing) {
          await prisma.crawlResult.create({
            data: {
              url: result.url,
              title: result.title,
              content: result.content,
              metadata: result.metadata
            }
          });
          savedCount++;
          
          if (savedCount % 10 === 0) {
            log(`  Progress: ${savedCount} saved...`, colors.reset);
          }
        } else {
          duplicateCount++;
        }
      } catch (err: any) {
        errorCount++;
        log(`  ❌ Error saving "${result.title}": ${err.message}`, colors.red);
      }
    }
    
    log('\n📊 Save Summary:', colors.bright + colors.yellow);
    log(`  Total crawled: ${crawledResults.length}`, colors.cyan);
    log(`  Newly saved: ${savedCount}`, colors.green);
    log(`  Duplicates skipped: ${duplicateCount}`, colors.yellow);
    log(`  Errors: ${errorCount}`, errorCount > 0 ? colors.red : colors.green);
    
    // Show final database stats
    log('\n📈 Database Statistics:', colors.bright + colors.blue);
    
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
    
    // Sort by count
    const sortedSources = Array.from(sourceCounts.entries())
      .sort((a, b) => b[1] - a[1]);
    
    sortedSources.forEach(([source, count]) => {
      log(`  ${source}: ${count} articles`, colors.cyan);
    });
    
    const total = await prisma.crawlResult.count();
    log(`\n  Total articles in database: ${total}`, colors.bright + colors.green);
    
  } catch (error: any) {
    log(`\n💥 Crawl error: ${error.message}`, colors.bright + colors.red);
    console.error(error);
  } finally {
    await cleanupBrowser();
    await prisma.$disconnect();
  }
}

// Run the manual crawl
performManualCrawl().catch((error) => {
  log(`\n💥 Fatal error: ${error.message}`, colors.bright + colors.red);
  console.error(error);
  process.exit(1);
});