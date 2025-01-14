import { NextResponse } from 'next/server';
import { SOURCES, crawlSource } from '@/lib/crawler';

export async function GET() {
  try {
    // Test with arXiv
    const source = SOURCES.ACADEMIC[0];
    console.log('Testing crawler with source:', source);
    
    const articles = await crawlSource(source);
    
    return NextResponse.json({ 
      success: true, 
      source: source.name,
      articleCount: articles.length,
      articles: articles.slice(0, 2) // Only return first 2 articles to keep response size reasonable
    });
  } catch (error) {
    console.error('Test crawl error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to test crawl',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
} 