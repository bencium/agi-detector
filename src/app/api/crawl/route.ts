import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { crawlAllSources } from '@/lib/crawler';

// Configure CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST() {
  try {
    console.log('[Crawler API] Starting full crawl...');
    
    // Use the real crawler implementation
    const crawledResults = await crawlAllSources();
    console.log(`[Crawler API] Successfully crawled ${crawledResults.length} articles`);

    // Store results in database with duplicate prevention
    const savedResults = [];
    
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
          const saved = await prisma.crawlResult.create({
            data: {
              url: result.url,
              title: result.title,
              content: result.content,
              metadata: result.metadata
            }
          });
          savedResults.push(saved);
        } else {
          console.log(`[Crawler API] Skipping duplicate: ${result.title}`);
        }
      } catch (err) {
        console.error(`[Crawler API] Failed to save article: ${result.title}`, err);
      }
    }
    
    console.log(`[Crawler API] Saved ${savedResults.length} new articles (${crawledResults.length - savedResults.length} duplicates skipped)`);

    return NextResponse.json({ 
      success: true, 
      data: savedResults,
      message: `Successfully crawled and saved ${savedResults.length} articles`
    }, { 
      headers: corsHeaders 
    });
  } catch (error) {
    console.error('Crawling error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to crawl sources',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { 
        status: 500,
        headers: corsHeaders 
      }
    );
  }
} 