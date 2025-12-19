import { NextRequest, NextResponse } from 'next/server';
import { crawlWithAdvancedMethods, cleanupBrowser } from '@/lib/advanced-crawler';
import { crawlSource } from '@/lib/crawler';
import { enforceRateLimit } from '@/lib/security/rateLimit';

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { windowMs: 60_000, max: 5, keyPrefix: 'test-crawler' });
    if (limited) return limited;

    const { source } = await request.json();
    
    if (!source) {
      return NextResponse.json({ 
        success: false, 
        error: 'Source configuration required' 
      }, { status: 400 });
    }
    
    console.log(`[Test] Testing crawler for ${source.name}`);
    
    // Try advanced methods first
    let articles = await crawlWithAdvancedMethods(source);
    
    if (articles.length === 0 && source.name === 'arXiv AI') {
      // Fall back to original crawler for arXiv
      articles = await crawlSource(source);
    }
    
    // Cleanup browser if used
    await cleanupBrowser();
    
    return NextResponse.json({
      success: true,
      source: source.name,
      articlesFound: articles.length,
      articles: articles.slice(0, 5), // Return first 5 articles
      message: articles.length > 0 
        ? `Successfully found ${articles.length} articles` 
        : 'No articles found'
    });
  } catch (error) {
    console.error('[Test] Crawler test error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
