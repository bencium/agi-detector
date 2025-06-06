import { SOURCES } from './src/lib/crawler';
import { crawlWithAdvancedMethods, cleanupBrowser } from './src/lib/advanced-crawler';

async function testCrawler(source: any) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${source.name}`);
  console.log(`URL: ${source.url}`);
  console.log(`${'='.repeat(60)}\n`);
  
  try {
    const startTime = Date.now();
    const articles = await crawlWithAdvancedMethods(source);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    if (articles.length > 0) {
      console.log(`✅ SUCCESS: Found ${articles.length} articles in ${duration}s`);
      console.log(`\nSample articles:`);
      articles.slice(0, 3).forEach((article, i) => {
        console.log(`\n${i + 1}. ${article.title}`);
        console.log(`   URL: ${article.url}`);
        console.log(`   Content preview: ${article.content.substring(0, 100)}...`);
      });
    } else {
      console.log(`❌ FAILED: No articles found after ${duration}s`);
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}`);
  }
}

async function main() {
  // Test all sources
  const allSources = [
    ...SOURCES.RESEARCH_BLOGS,
    ...SOURCES.NEWS_SITES,
    ...SOURCES.ACADEMIC
  ];
  
  for (const source of allSources) {
    await testCrawler(source);
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  // Cleanup
  await cleanupBrowser();
  console.log('\n✅ All tests completed');
  process.exit(0);
}

// Run tests
main().catch(console.error);