const CJK_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;

export function normalizeSourceName(source: string): string {
  return source.replace(/\s+/g, ' ').trim();
}

export function detectLanguage(text: string): 'en' | 'zh' | 'mixed' {
  const sample = text.slice(0, 4000);
  const cjkMatches = sample.match(CJK_REGEX) || [];
  const cjkRatio = cjkMatches.length / Math.max(1, sample.length);
  if (cjkRatio > 0.15) return 'zh';
  if (cjkRatio > 0.03) return 'mixed';
  return 'en';
}

export function normalizeDate(input?: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const direct = Date.parse(trimmed);
  if (!Number.isNaN(direct)) return new Date(direct).toISOString();

  const chinese = trimmed.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?/);
  if (chinese) {
    const [_, y, m, d] = chinese;
    return new Date(Number(y), Number(m) - 1, Number(d)).toISOString();
  }

  const dotted = trimmed.match(/(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
  if (dotted) {
    const [_, y, m, d] = dotted;
    return new Date(Number(y), Number(m) - 1, Number(d)).toISOString();
  }

  const yearMonth = trimmed.match(/(\d{4})\s*年\s*(\d{1,2})\s*月/);
  if (yearMonth) {
    const [_, y, m] = yearMonth;
    return new Date(Number(y), Number(m) - 1, 1).toISOString();
  }

  return null;
}

export function getCjkRatio(text: string): number {
  const sample = text.slice(0, 4000);
  const cjkMatches = sample.match(CJK_REGEX) || [];
  return cjkMatches.length / Math.max(1, sample.length);
}
