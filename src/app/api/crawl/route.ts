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
    console.log('Starting crawler...');
    
    // Use the real crawler implementation
    const crawledResults = await crawlAllSources();
    console.log(`Crawled ${crawledResults.length} articles`);

    // Store results in database
    const savedResults = await Promise.all(
      crawledResults.map(result => 
        prisma.crawlResult.create({
          data: {
            url: result.url,
            title: result.title,
            content: result.content,
            metadata: result.metadata
          }
        })
      )
    );

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