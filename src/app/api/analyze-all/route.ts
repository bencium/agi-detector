import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { openai, AGI_DETECTION_PROMPT } from '@/lib/openai';
import { computeSeverity } from '@/lib/severity';
import { parseOpenAIResponse } from '@/lib/utils/safeJson';

// Small utility to bound async operations and annotate logs
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
  logs?: string[],
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const msg = `[Analyze All] Timeout after ${ms}ms at: ${label}`;
      console.warn(msg);
      logs?.push(msg);
      const err = new Error(msg) as Error & { statusCode?: number; name?: string };
      err.name = 'TimeoutError';
      err.statusCode = 504;
      reject(err);
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

// Tunables via env
const OPENAI_TIMEOUT_MS = parseInt(process.env.OPENAI_TIMEOUT_MS || '15000', 10);
const ANALYZE_BATCH_SIZE = Math.max(1, parseInt(process.env.ANALYZE_BATCH_SIZE || '2', 10));
const BATCH_TIMEOUT_MS = parseInt(process.env.BATCH_TIMEOUT_MS || '20000', 10);

// Debug logging
console.log('[Analyze All] Module loaded, OpenAI client:', !!openai);
console.log('[Analyze All] OpenAI API Key in module:', !!process.env.API_KEY);

async function analyzeArticle(crawlResult: any, logs: string[] = []) {
  try {
    const logMsg = `[Analyze] Starting analysis for: ${crawlResult.title}`;
    console.log(logMsg);
    logs.push(logMsg);
    
    // Check if already analyzed
    const existing = await withTimeout(
      prisma.analysisResult.findFirst({
        where: { crawlId: crawlResult.id },
      }),
      10000,
      'DB findFirst(analysisResult)',
      logs,
    );
    
    if (existing) {
      const skipMsg = `[Analyze] Skipping already analyzed: ${crawlResult.title}`;
      console.log(skipMsg);
      logs.push(skipMsg);
      return existing;
    }

    const analyzeMsg = `[Analyze] Analyzing: ${crawlResult.title}`;
    console.log(analyzeMsg);
    logs.push(analyzeMsg);
    
    // Analyze content using OpenAI (default gpt-5-mini with low reasoning)
    let completion;
    try {
      const model = process.env.OPENAI_MODEL || "gpt-5-mini";
      const options: any = {
        model,
        messages: [
          { role: "system", content: AGI_DETECTION_PROMPT },
          { role: "user", content: `Title: ${crawlResult.title}\n\nContent: ${crawlResult.content}` }
        ],
        response_format: { type: "json_object" },
        // Ensure OpenAI call does not hang indefinitely
        signal: (AbortSignal as any)?.timeout ? (AbortSignal as any).timeout(25000) : undefined,
      };
      const timeoutMs = OPENAI_TIMEOUT_MS;
      logs.push(`[Analyze] Calling OpenAI model=${model} timeout=${timeoutMs}ms`);
      completion = await openai.chat.completions.create(
        options,
        {
          timeout: timeoutMs,
          maxRetries: 0,
          signal: (AbortSignal as any)?.timeout ? (AbortSignal as any).timeout(timeoutMs) : undefined,
        },
      );
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

    // Safe JSON parsing with fallback
    const analysisResult = parseOpenAIResponse(content);

    // Store analysis results
    const severity = computeSeverity(analysisResult.score || 0, analysisResult.severity);
    const analysis = await withTimeout(
      prisma.analysisResult.create({
        data: {
          crawlId: crawlResult.id,
          score: analysisResult.score || 0,
          confidence: analysisResult.confidence || 0,
          indicators: analysisResult.indicators || [],
          severity,
          evidenceQuality: analysisResult.evidence_quality || 'speculative',
          requiresVerification: analysisResult.requires_verification || false,
          crossReferences: analysisResult.cross_references || [],
          explanation: analysisResult.explanation || 'No AGI indicators detected',
        },
      }),
      10000,
      'DB create(analysisResult)',
      logs,
    );

    // Historical metrics for trend visualizations
    try {
      await withTimeout(
        prisma.historicalData.createMany({
          data: [
            { analysisId: analysis.id, metric: 'score', value: analysis.score },
            { analysisId: analysis.id, metric: 'confidence', value: analysis.confidence },
            { analysisId: analysis.id, metric: 'indicator_count', value: (analysis.indicators || []).length },
          ],
        }),
        10000,
        'DB createMany(historicalData)',
        logs,
      );
    } catch (histErr) {
      console.warn('[Analyze All] Failed to write historical data for', analysis.id, histErr);
    }

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
      unanalyzedResults = await withTimeout(
        prisma.crawlResult.findMany({
          where: {
            analysis: {
              is: null,
            },
          },
          orderBy: {
            timestamp: 'desc',
          },
          take: 50, // Limit to prevent timeout
        }),
        15000,
        'DB findMany(crawlResult)',
        logs,
      );
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
    const batchSize = ANALYZE_BATCH_SIZE;
    const analyses = [];
    
    console.log('[Analyze All] Starting batch processing...');
    
    for (let i = 0; i < unanalyzedResults.length; i += batchSize) {
      const batchLog = `[Analyze All] Processing batch ${Math.floor(i/batchSize) + 1} (articles ${i+1}-${Math.min(i+batchSize, unanalyzedResults.length)})`;
      logs.push(batchLog);
      console.log(batchLog);
      
      const batch = unanalyzedResults.slice(i, i + batchSize);
      
      try {
        const batchPromises = batch.map((article) => analyzeArticle(article, logs));
        const settled = await withTimeout(
          Promise.allSettled(batchPromises),
          BATCH_TIMEOUT_MS,
          `Batch analysis (${Math.floor(i / batchSize) + 1})`,
          logs,
        );
        const validResults = settled
          .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value)
          .map((r) => r.value);
        const failedCount = settled.filter((r) => r.status === 'rejected').length;
        const successLog = `[Analyze All] Batch completed: ${validResults.length}/${batch.length} successful; ${failedCount} failed/timeouts`;
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

    // Create trend snapshots (daily, weekly) so the Trends tab shows fresh data
    try {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const dailyAnalyses = await prisma.analysisResult.findMany({ where: { timestamp: { gte: dayAgo } } });
      if (dailyAnalyses.length > 0) {
        const scores = dailyAnalyses.map(a => a.score);
        await prisma.trendAnalysis.create({
          data: {
            period: 'daily',
            avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
            maxScore: Math.max(...scores),
            minScore: Math.min(...scores),
            totalAnalyses: dailyAnalyses.length,
            criticalAlerts: dailyAnalyses.filter(a => a.severity === 'critical').length,
          }
        });
      }

      const weeklyAnalyses = await prisma.analysisResult.findMany({ where: { timestamp: { gte: weekAgo } } });
      if (weeklyAnalyses.length > 0) {
        const scores = weeklyAnalyses.map(a => a.score);
        await prisma.trendAnalysis.create({
          data: {
            period: 'weekly',
            avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
            maxScore: Math.max(...scores),
            minScore: Math.min(...scores),
            totalAnalyses: weeklyAnalyses.length,
            criticalAlerts: weeklyAnalyses.filter(a => a.severity === 'critical').length,
          }
        });
      }
    } catch (trendErr) {
      console.warn('[Analyze All] Trend snapshot creation failed:', trendErr);
    }

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
    const status = (error && typeof error.statusCode === 'number') ? error.statusCode : (errorName === 'TimeoutError' ? 504 : 500);
    
    console.log('[Analyze All] Caught error:', errorMessage);
    console.log('[Analyze All] Error code:', errorCode);
    console.log('[Analyze All] Error name:', errorName);
    
    // Check if it's an OpenAI API error
    if (errorMessage.includes('model') || errorMessage.includes('gpt-4.1') || errorMessage.includes('gpt-5')) {
      console.log('[Analyze All] Possible OpenAI Model Error');
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: `Failed to analyze articles: ${errorMessage}`,
        errorCode,
        errorName,
        logs,
      },
      { status }
    );
  }
}
