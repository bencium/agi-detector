import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/lib/openai';
import { enforceRateLimit } from '@/lib/security/rateLimit';

export async function GET(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { windowMs: 60_000, max: 5, keyPrefix: 'test-openai' });
    if (limited) return limited;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Say hello!" }
      ]
    });

    return NextResponse.json({ 
      success: true, 
      response: completion.choices[0]?.message?.content
    });
  } catch (error) {
    console.error('OpenAI API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to call OpenAI API', details: error },
      { status: 500 }
    );
  }
} 
