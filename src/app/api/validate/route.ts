import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { openai } from '@/lib/openai';
import { crawlSource, SOURCES } from '@/lib/crawler';
import { computeSeverity } from '@/lib/severity';

const VALIDATION_PROMPT = `You are a second-opinion AI safety expert validating a previous AGI detection analysis. Your role is to ensure NO AGI progress is missed or downplayed.

Previous analysis found:
Score: {score}
Indicators: {indicators}
Severity: {severity}

Review the content and provide an independent assessment. Be EXTRA vigilant for:
1. Any missed AGI indicators
2. Signs of capability jumps or emergent behaviors
3. Architectural breakthroughs that could lead to AGI
4. ANY progress toward human-level AI

IMPORTANT: If in doubt, err on the side of caution and flag it as AGI-relevant.

Provide your validation as JSON:
{
  "agrees": boolean,
  "validatedScore": number, // Should be >= original score if ANY AGI relevance found
  "reasoning": string,
  "additionalIndicators": string[], // List ALL possible AGI-related findings
  "recommendation": "confirm" | "investigate" | "dismiss" // Only dismiss if 100% certain it's not AGI-related
}`;

export async function POST(request: Request) {
  try {
    const { analysisId } = await request.json();

    if (!analysisId) {
      return NextResponse.json(
        { success: false, error: 'Analysis ID required' },
        { status: 400 }
      );
    }

    // Get the analysis to validate
    const analysis = await prisma.analysisResult.findUnique({
      where: { id: analysisId },
      include: {
        crawl: true
      }
    });

    if (!analysis) {
      return NextResponse.json(
        { success: false, error: 'Analysis not found' },
        { status: 404 }
      );
    }

    // Cross-validate with OpenAI (default gpt-5-mini with low reasoning)
    const validationPrompt = VALIDATION_PROMPT
      .replace('{score}', analysis.score.toString())
      .replace('{indicators}', analysis.indicators.join(', '))
      .replace('{severity}', analysis.severity || 'none');

    const model = process.env.OPENAI_MODEL || "gpt-5-mini";
    const vOptions: any = {
      model,
      messages: [
        { role: "system", content: validationPrompt },
        { role: "user", content: `Title: ${analysis.crawl.title}\n\nContent: ${analysis.crawl.content}` }
      ],
      response_format: { type: "json_object" }
    };
    const validation = await openai.chat.completions.create(vOptions);

    const validationResult = JSON.parse(validation.choices[0]?.message?.content || '{}');

    // If high severity and requires verification, check cross-references
    let crossReferenceResults = [];
    if (analysis.severity === 'high' || analysis.severity === 'critical') {
      crossReferenceResults = await checkCrossReferences(analysis.crossReferences);
    }

    // Update analysis with validation results
    // IMPORTANT: Never decrease the score if AGI indicators were found
    const newScore = validationResult.validatedScore || analysis.score;
    const finalScore = Math.max(analysis.score, newScore); // Always keep the higher score
    
    const prevConfidence = analysis.confidence;
    const addedIndicators = (validationResult.additionalIndicators || []).length;
    const newConfidence = Math.min(1, prevConfidence + (validationResult.agrees ? 0.2 : 0.1));
    const lastValidation = {
      prevScore: analysis.score,
      newScore: finalScore,
      prevConfidence,
      newConfidence,
      addedIndicators,
      recommendation: validationResult.recommendation || 'investigate',
      timestamp: new Date().toISOString(),
    };

    const newSeverity = computeSeverity(finalScore, (analysis.severity as any) || 'none');
    const updatedAnalysis = await prisma.analysisResult.update({
      where: { id: analysisId },
      data: {
        requiresVerification: false,
        confidence: newConfidence, // Always increase confidence
        score: finalScore,
        severity: newSeverity,
        // Add any additional indicators found
        indicators: [...new Set([...analysis.indicators, ...(validationResult.additionalIndicators || [])])],
        validatedAt: new Date(),
        lastValidation,
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        validation: validationResult,
        crossReferenceResults,
        updatedAnalysis
      }
    });
  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to validate analysis' },
      { status: 500 }
    );
  }
}

async function checkCrossReferences(references: string[]): Promise<any[]> {
  const results = [];
  
  for (const ref of references) {
    // Find matching source
    const allSources = [
      ...SOURCES.RESEARCH_BLOGS,
      ...SOURCES.NEWS_SITES,
      ...SOURCES.ACADEMIC
    ];
    
    const source = allSources.find(s => s.name.toLowerCase().includes(ref.toLowerCase()));
    
    if (source) {
      try {
        const articles = await crawlSource(source);
        // Look for related content
        const relatedArticles = articles.filter(article => 
          article.content.toLowerCase().includes('agi') ||
          article.content.toLowerCase().includes('artificial general intelligence') ||
          article.content.toLowerCase().includes('superintelligence')
        );
        
        results.push({
          source: ref,
          found: relatedArticles.length > 0,
          articleCount: relatedArticles.length,
          titles: relatedArticles.slice(0, 3).map(a => a.title)
        });
      } catch (error) {
        results.push({
          source: ref,
          found: false,
          error: 'Failed to crawl source'
        });
      }
    }
  }
  
  return results;
}
