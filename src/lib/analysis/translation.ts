import { openai } from '@/lib/openai';
import { getCjkRatio } from '@/lib/metadata/normalize';

const DEFAULT_TRANSLATION_MODEL = 'gpt-5-mini';

export function shouldTranslateCjk(text: string): boolean {
  const ratio = getCjkRatio(text);
  return ratio >= 0.08;
}

export async function translateToEnglish(input: {
  title?: string;
  snippets: string[];
}): Promise<{ translatedTitle?: string; translatedSnippets: string[] }> {
  if (!input.snippets || input.snippets.length === 0) {
    return { translatedTitle: input.title, translatedSnippets: [] };
  }

  const model = process.env.TRANSLATION_MODEL || DEFAULT_TRANSLATION_MODEL;
  const prompt = `Translate the following title and evidence snippets to concise English. Preserve numbers, symbols, and benchmark names. Output JSON with keys: translatedTitle (string) and translatedSnippets (array of strings).`;

  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: prompt },
      {
        role: 'user',
        content: JSON.stringify({
          title: input.title || '',
          snippets: input.snippets
        })
      }
    ],
    response_format: { type: 'json_object' }
  });

  const content = response.choices[0]?.message?.content || '{}';
  let parsed: { translatedTitle?: string; translatedSnippets?: string[] } = {};
  try {
    parsed = JSON.parse(content) as { translatedTitle?: string; translatedSnippets?: string[] };
  } catch {
    parsed = {};
  }

  return {
    translatedTitle: parsed.translatedTitle || input.title,
    translatedSnippets: parsed.translatedSnippets || []
  };
}
