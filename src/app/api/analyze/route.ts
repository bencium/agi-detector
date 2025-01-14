import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { openai, AGI_DETECTION_PROMPT } from '@/lib/openai';

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
      model: "gpt-4o-mini",
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

    // Store analysis results
    const analysis = await prisma.analysisResult.create({
      data: {
        crawlId: latestCrawl.id,
        score: analysisResult.score,
        confidence: analysisResult.confidence,
        indicators: analysisResult.indicators
      }
    });

    return NextResponse.json({ 
      success: true, 
      data: analysis,
      explanation: analysisResult.explanation
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to analyze content' },
      { status: 500 }
    );
  }
} 