import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { openai, AGI_DETECTION_PROMPT } from '@/lib/openai';

// Debug logging
console.log('[Analyze All] Module loaded, OpenAI client:', !!openai);
console.log('[Analyze All] OpenAI API Key in module:', !!process.env.API_KEY);

async function analyzeArticle(crawlResult: any, logs: string[] = []) {
  try {
    const logMsg = `[Analyze] Starting analysis for: ${crawlResult.title}`;
    console.log(logMsg);
    logs.push(logMsg);
    
    // Check if already analyzed
    const existing = await prisma.analysisResult.findFirst({
      where: { crawlId: crawlResult.id }
    });
    
    if (existing) {
      const skipMsg = `[Analyze] Skipping already analyzed: ${crawlResult.title}`;
      console.log(skipMsg);
      logs.push(skipMsg);
      return existing;
    }

    const analyzeMsg = `[Analyze] Analyzing: ${crawlResult.title}`;
    console.log(analyzeMsg);
    logs.push(analyzeMsg);
    
    // Analyze content using OpenAI
    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: AGI_DETECTION_PROMPT },
          { role: "user", content: `Title: ${crawlResult.title}\n\nContent: ${crawlResult.content}` }
        ],
        response_format: { type: "json_object" }
      });
    } catch (openaiError: any) {
      console.error(`[Analyze] OpenAI API Error:`, openaiError);
      console.error(`[Analyze] Error type:`, openaiError?.constructor?.name);
      console.error(`[Analyze] Error message:`, openaiError?.message);
      console.error(`[Analyze] Error code:`, openaiError?.code);
      console.error(`[Analyze] Error status:`, openaiError?.status);
      throw openaiError;
    }

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No analysis result received from OpenAI');
    }

    const analysisResult = JSON.parse(content);

    // Store analysis results
    const analysis = await prisma.analysisResult.create({
      data: {
        crawlId: crawlResult.id,
        score: analysisResult.score || 0,
        confidence: analysisResult.confidence || 0,
        indicators: analysisResult.indicators || [],
        severity: analysisResult.severity || 'none',
        evidenceQuality: analysisResult.evidence_quality || 'speculative',
        requiresVerification: analysisResult.requires_verification || false,
        crossReferences: analysisResult.cross_references || [],
        explanation: analysisResult.explanation || 'No AGI indicators detected'
      }
    });

    return analysis;
  } catch (error) {
    console.error(`[Analyze] Error analyzing article ${crawlResult.id}:`, error);
    return null;
  }
}

export async function POST() {
  const logs: string[] = [];
  logs.push('[Analyze All] Starting analysis of all unanalyzed articles...');
  console.log('[Analyze All] Endpoint called');
  console.log('[Analyze All] API Key present:', !!process.env.API_KEY);
  
  try {
    console.log('[Analyze All] Starting analysis of all unanalyzed articles...');
    
    let unanalyzedResults;
    try {
      logs.push('[Analyze All] Querying database for unanalyzed articles...');
      console.log('[Analyze All] About to query database...');
      // Get all unanalyzed crawl results
      unanalyzedResults = await prisma.crawlResult.findMany({
        where: {
          analysis: {
            is: null
          }
        },
        orderBy: {
          timestamp: 'desc'
        },
        take: 50 // Limit to prevent timeout
      });
    } catch (dbError: any) {
      console.error('[Analyze All] Database error:', dbError);
      throw new Error(`Database query failed: ${dbError?.message || 'Unknown DB error'}`);
    }

    logs.push(`[Analyze All] Found ${unanalyzedResults.length} unanalyzed articles`);
    console.log(`[Analyze All] Found ${unanalyzedResults.length} unanalyzed articles`);

    if (unanalyzedResults.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unanalyzed articles found',
        logs,
        data: {
          analyses: [],
          summary: {
            totalAnalyzed: 0,
            averageScore: 0,
            highSeverityCount: 0,
            criticalCount: 0
          }
        }
      });
    }

    // Analyze articles in batches
    const batchSize = 5;
    const analyses = [];
    
    console.log('[Analyze All] Starting batch processing...');
    
    for (let i = 0; i < unanalyzedResults.length; i += batchSize) {
      const batchLog = `[Analyze All] Processing batch ${Math.floor(i/batchSize) + 1} (articles ${i+1}-${Math.min(i+batchSize, unanalyzedResults.length)})`;
      logs.push(batchLog);
      console.log(batchLog);
      
      const batch = unanalyzedResults.slice(i, i + batchSize);
      
      try {
        const batchPromises = batch.map(article => analyzeArticle(article, logs));
        const batchResults = await Promise.all(batchPromises);
        
        const validResults = batchResults.filter(a => a !== null);
        const successLog = `[Analyze All] Batch completed: ${validResults.length}/${batch.length} successful`;
        logs.push(successLog);
        console.log(successLog);
        
        analyses.push(...validResults);
      } catch (batchError: any) {
        const errorLog = `[Analyze All] Batch processing error: ${batchError?.message || 'Unknown error'}`;
        logs.push(errorLog);
        console.log(errorLog);
        // Continue with next batch even if one fails
      }
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < unanalyzedResults.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`[Analyze All] Successfully analyzed ${analyses.length} articles`);

    // Calculate summary statistics
    const validAnalyses = analyses.filter(a => a.score > 0);
    const avgScore = validAnalyses.length > 0 
      ? validAnalyses.reduce((sum, a) => sum + a.score, 0) / validAnalyses.length 
      : 0;
    
    const highSeverityCount = analyses.filter(a => 
      a.severity === 'high' || a.severity === 'critical'
    ).length;

    return NextResponse.json({ 
      success: true,
      logs,
      data: {
        analyses,
        summary: {
          totalAnalyzed: analyses.length,
          averageScore: avgScore,
          highSeverityCount,
          criticalCount: analyses.filter(a => a.severity === 'critical').length
        }
      }
    });
  } catch (error: any) {
    // Avoid Next.js error formatting issues
    const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
    const errorCode = error?.code || 'NO_CODE';
    const errorName = error?.name || 'UnknownError';
    
    console.log('[Analyze All] Caught error:', errorMessage);
    console.log('[Analyze All] Error code:', errorCode);
    console.log('[Analyze All] Error name:', errorName);
    
    // Check if it's an OpenAI API error
    if (errorMessage.includes('model') || errorMessage.includes('gpt-4.1')) {
      console.log('[Analyze All] Possible OpenAI Model Error');
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: `Failed to analyze articles: ${errorMessage}`,
        errorCode,
        errorName
      },
      { status: 500 }
    );
  }
}