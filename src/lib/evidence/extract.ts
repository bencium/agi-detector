export type EvidenceSnippet = {
  text: string;
  score: number;
  tags: string[];
};

export type EvidenceClaim = {
  claim: string;
  evidence: string;
  tags: string[];
  numbers: number[];
  benchmark?: string;
  metric?: string;
  value?: number;
  delta?: number;
  unit?: string;
};

const KEYWORDS = [
  'state of the art',
  'sota',
  'outperforms',
  'surpasses',
  'beats',
  'achieves',
  'improves',
  'improvement',
  'benchmark',
  'human-level',
  'generalization',
  'emergent',
  'novel',
  'breakthrough'
];

const BENCHMARKS = [
  'arc',
  'arc-agi',
  'mmlu',
  'gpqa',
  'swe-bench',
  'imagenet',
  'glue',
  'superglue',
  'hellaswag',
  'gsm8k',
  'math',
  'big-bench'
];

const BENCHMARK_LABELS: Record<string, string> = {
  'arc': 'ARC',
  'arc-agi': 'ARC-AGI',
  'mmlu': 'MMLU',
  'gpqa': 'GPQA',
  'swe-bench': 'SWE-bench',
  'imagenet': 'ImageNet',
  'glue': 'GLUE',
  'superglue': 'SuperGLUE',
  'hellaswag': 'HellaSwag',
  'gsm8k': 'GSM8K',
  'math': 'MATH',
  'big-bench': 'BIG-bench'
};

const METRICS = [
  'accuracy',
  'score',
  'pass@1',
  'pass@k',
  'f1',
  'f1-score',
  'bleu',
  'map',
  'mrr',
  'em'
];

function splitIntoSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const rough = normalized.split(/(?<=[.!?])\s+/);
  return rough.map(s => s.trim()).filter(Boolean);
}

function extractNumbers(text: string): number[] {
  const matches = text.match(/(?:\d+\.?\d*)/g) || [];
  return matches.map(m => Number(m)).filter(n => Number.isFinite(n));
}

function findBenchmark(sentence: string): string | undefined {
  const lower = sentence.toLowerCase();
  const found = BENCHMARKS.find(b => lower.includes(b));
  return found ? BENCHMARK_LABELS[found] || found.toUpperCase() : undefined;
}

function findMetric(sentence: string): string | undefined {
  const lower = sentence.toLowerCase();
  const metric = METRICS.find(m => lower.includes(m));
  return metric;
}

function findValue(sentence: string): { value?: number; unit?: string } {
  const percentMatch = sentence.match(/(\d+\.?\d*)\s*%/);
  if (percentMatch) {
    return { value: Number(percentMatch[1]), unit: '%' };
  }
  const numbers = extractNumbers(sentence);
  if (numbers.length > 0) {
    return { value: numbers[0] };
  }
  return {};
}

function findDelta(sentence: string): { delta?: number; unit?: string } {
  const lower = sentence.toLowerCase();
  const patterns = [
    /improv(?:e|es|ed)\s+by\s+(\d+\.?\d*)\s*%/i,
    /improvement\s+of\s+(\d+\.?\d*)\s*%/i,
    /increase\s+of\s+(\d+\.?\d*)\s*%/i,
    /gain\s+of\s+(\d+\.?\d*)\s*%/i,
    /up\s+(\d+\.?\d*)\s*%/i
  ];

  for (const pat of patterns) {
    const m = sentence.match(pat);
    if (m) return { delta: Number(m[1]), unit: '%' };
  }

  const absolutePatterns = [
    /improv(?:e|es|ed)\s+by\s+(\d+\.?\d*)/i,
    /improvement\s+of\s+(\d+\.?\d*)/i,
    /increase\s+of\s+(\d+\.?\d*)/i,
    /gain\s+of\s+(\d+\.?\d*)/i
  ];

  for (const pat of absolutePatterns) {
    const m = sentence.match(pat);
    if (m) return { delta: Number(m[1]) };
  }

  if (lower.includes('delta')) {
    const m = sentence.match(/delta\s+(\d+\.?\d*)/i);
    if (m) return { delta: Number(m[1]) };
  }

  return {};
}

function scoreSentence(sentence: string): EvidenceSnippet | null {
  const trimmed = sentence.trim();
  if (trimmed.length < 20 || trimmed.length > 300) return null;

  const lower = trimmed.toLowerCase();
  const tags: string[] = [];
  let score = 0;

  for (const kw of KEYWORDS) {
    if (lower.includes(kw)) {
      score += 2;
      tags.push(kw);
    }
  }

  for (const bm of BENCHMARKS) {
    if (lower.includes(bm)) {
      score += 2;
      tags.push(bm);
    }
  }

  const numbers = extractNumbers(lower);
  if (numbers.length > 0) {
    score += 2;
    tags.push('numbers');
  }

  if (/%/.test(lower)) {
    score += 1;
    tags.push('percent');
  }

  return { text: trimmed, score, tags: Array.from(new Set(tags)) };
}

export function extractEvidenceSnippets(content: string, maxSnippets = 6): EvidenceSnippet[] {
  const sentences = splitIntoSentences(content);
  const scored = sentences
    .map(scoreSentence)
    .filter((s): s is EvidenceSnippet => Boolean(s))
    .filter(s => s.score > 0);

  const seen = new Set<string>();
  const unique = scored.filter(s => {
    const key = s.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => b.score - a.score);
  return unique.slice(0, maxSnippets);
}

export function extractEvidenceClaims(
  snippets: EvidenceSnippet[],
  maxClaims = 4
): EvidenceClaim[] {
  return snippets.slice(0, maxClaims).map(snippet => {
    const benchmark = findBenchmark(snippet.text);
    const metric = findMetric(snippet.text);
    const { value, unit: valueUnit } = findValue(snippet.text);
    const { delta, unit: deltaUnit } = findDelta(snippet.text);
    const unit = deltaUnit || valueUnit;

    return {
      claim: snippet.text,
      evidence: snippet.text,
      tags: snippet.tags,
      numbers: extractNumbers(snippet.text),
      benchmark,
      metric,
      value,
      delta,
      unit
    };
  });
}
