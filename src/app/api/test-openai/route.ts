import { NextResponse } from 'next/server';
import { openai } from '@/lib/openai';

export async function GET() {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
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