import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { openai, AGI_DETECTION_PROMPT } from '@/lib/openai';

async function updateTrendAnalysis() {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Calculate daily trends
  const dailyAnalyses = await prisma.analysisResult.findMany({
    where: { timestamp: { gte: dayAgo } }
  });

  if (dailyAnalyses.length > 0) {
    const scores = dailyAnalyses.map(a => a.score);
    await prisma.trendAnalysis.create({
      data: {
        period: 'daily',
        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
        maxScore: Math.max(...scores),
        minScore: Math.min(...scores),
        totalAnalyses: dailyAnalyses.length,
        criticalAlerts: dailyAnalyses.filter(a => a.severity === 'critical').length
      }
    });
  }

  // Calculate weekly trends
  const weeklyAnalyses = await prisma.analysisResult.findMany({
    where: { timestamp: { gte: weekAgo } }
  });

  if (weeklyAnalyses.length > 0) {
    const scores = weeklyAnalyses.map(a => a.score);
    await prisma.trendAnalysis.create({
      data: {
        period: 'weekly',
        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
        maxScore: Math.max(...scores),
        minScore: Math.min(...scores),
        totalAnalyses: weeklyAnalyses.length,
        criticalAlerts: weeklyAnalyses.filter(a => a.severity === 'critical').length
      }
    });
  }
}

export async function POST() {
  try {
    // Get the latest crawl result without analysis
    const latestCrawl = await prisma.crawlResult.findFirst({
      where: {
        analysis: null
      },
      orderBy: {
        timestamp: 'desc'
      }
    });

    if (!latestCrawl || !latestCrawl.title || !latestCrawl.content) {
      return NextResponse.json(
        { success: false, error: 'No valid content to analyze' },
        { status: 404 }
      );
    }

    // Analyze content using OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: AGI_DETECTION_PROMPT },
        { role: "user", content: `Title: ${latestCrawl.title}\n\nContent: ${latestCrawl.content}` }
      ],
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No analysis result received from OpenAI');
    }

    const analysisResult = JSON.parse(content);

    // Store enhanced analysis results
    const analysis = await prisma.analysisResult.create({
      data: {
        crawlId: latestCrawl.id,
        score: analysisResult.score,
        confidence: analysisResult.confidence,
        indicators: analysisResult.indicators,
        severity: analysisResult.severity || 'none',
        evidenceQuality: analysisResult.evidence_quality || 'speculative',
        requiresVerification: analysisResult.requires_verification || false,
        crossReferences: analysisResult.cross_references || [],
        explanation: analysisResult.explanation
      }
    });

    // Store historical data points
    await prisma.historicalData.createMany({
      data: [
        {
          analysisId: analysis.id,
          metric: 'score',
          value: analysisResult.score
        },
        {
          analysisId: analysis.id,
          metric: 'confidence',
          value: analysisResult.confidence
        },
        {
          analysisId: analysis.id,
          metric: 'indicator_count',
          value: analysisResult.indicators.length
        }
      ]
    });

    // Update trend analysis
    await updateTrendAnalysis();

    return NextResponse.json({ 
      success: true, 
      data: {
        ...analysis,
        explanation: analysisResult.explanation
      }
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to analyze content' },
      { status: 500 }
    );
  }
} 