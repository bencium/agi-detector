/**
 * Benchmark Threshold Detection
 *
 * Automatically detects significant benchmark improvements that may indicate AGI progress
 * Tracks SOTA (State-of-the-Art) improvements across key AGI-relevant benchmarks
 */

export interface BenchmarkResult {
  name: string;
  score: number;
  unit: string; // 'accuracy', 'perplexity', 'BLEU', 'F1', etc.
  higherIsBetter: boolean;
}

export interface BenchmarkThreshold {
  name: string;
  baseline: number;
  humanLevel?: number;
  previousSOTA?: number;
  significantImprovement: number; // Minimum % improvement to be considered significant
}

// AGI-relevant benchmarks with thresholds
export const AGI_BENCHMARKS: Record<string, BenchmarkThreshold> = {
  // General Intelligence Benchmarks
  'GAIA': {
    name: 'GAIA (General AI Assistants)',
    baseline: 0.15, // GPT-4 baseline
    humanLevel: 0.92,
    significantImprovement: 10, // 10% relative improvement
  },
  'AGIEval': {
    name: 'AGIEval (Human Exams)',
    baseline: 0.50,
    humanLevel: 0.80,
    significantImprovement: 5,
  },
  'MMMU': {
    name: 'MMMU (Multimodal Understanding)',
    baseline: 0.45,
    humanLevel: 0.88,
    significantImprovement: 8,
  },

  // Reasoning Benchmarks
  'MATH': {
    name: 'MATH (Mathematical Reasoning)',
    baseline: 0.50,
    humanLevel: 0.90,
    significantImprovement: 10,
  },
  'GSM8K': {
    name: 'GSM8K (Grade School Math)',
    baseline: 0.85,
    humanLevel: 0.95,
    significantImprovement: 3,
  },
  'ARC-Challenge': {
    name: 'ARC Challenge (Science Questions)',
    baseline: 0.80,
    humanLevel: 0.95,
    significantImprovement: 5,
  },

  // Code Generation
  'HumanEval': {
    name: 'HumanEval (Code Generation)',
    baseline: 0.67,
    humanLevel: 0.95,
    significantImprovement: 5,
  },
  'MBPP': {
    name: 'MBPP (Python Programming)',
    baseline: 0.70,
    humanLevel: 0.95,
    significantImprovement: 5,
  },

  // Language Understanding
  'MMLU': {
    name: 'MMLU (Massive Multitask Language Understanding)',
    baseline: 0.86,
    humanLevel: 0.90,
    significantImprovement: 2,
  },
  'HellaSwag': {
    name: 'HellaSwag (Commonsense Reasoning)',
    baseline: 0.85,
    humanLevel: 0.95,
    significantImprovement: 3,
  },

  // Multimodal
  'VQA': {
    name: 'Visual Question Answering',
    baseline: 0.75,
    humanLevel: 0.90,
    significantImprovement: 5,
  },
};

// Patterns to extract benchmark results from text
const BENCHMARK_PATTERNS = [
  // "achieves 85% on MMLU" or "MMLU: 85%"
  /(?:achieves?|scores?|reaches?|obtains?)\s+(\d+(?:\.\d+)?)%?\s+on\s+([A-Z][A-Za-z0-9-]+)/gi,
  /([A-Z][A-Za-z0-9-]+):\s*(\d+(?:\.\d+)?)%?/g,

  // "85% accuracy on MMLU"
  /(\d+(?:\.\d+)?)%?\s+(?:accuracy|performance)\s+on\s+([A-Z][A-Za-z0-9-]+)/gi,

  // "improves MMLU from 80% to 90%"
  /improves?\s+([A-Z][A-Za-z0-9-]+)\s+from\s+(\d+(?:\.\d+)?)%?\s+to\s+(\d+(?:\.\d+)?)%?/gi,

  // "outperforms previous SOTA on MMLU (85% -> 90%)"
  /([A-Z][A-Za-z0-9-]+)\s*\((\d+(?:\.\d+)?)%?\s*->\s*(\d+(?:\.\d+)?)%?\)/g,
];

/**
 * Extract benchmark results from text content
 */
export function extractBenchmarkResults(text: string): BenchmarkResult[] {
  const results: BenchmarkResult[] = [];
  const seen = new Set<string>();

  // Try each pattern
  for (const pattern of BENCHMARK_PATTERNS) {
    const matches = text.matchAll(pattern);

    for (const match of matches) {
      let benchmarkName: string;
      let score: number;

      // Handle different pattern captures
      if (match[0].includes('improves')) {
        benchmarkName = match[1];
        score = parseFloat(match[3]); // The "to" value
      } else if (match[0].includes('->')) {
        benchmarkName = match[1];
        score = parseFloat(match[3]); // The after value
      } else if (pattern.source.startsWith('([A-Z]')) {
        benchmarkName = match[1];
        score = parseFloat(match[2]);
      } else {
        score = parseFloat(match[1]);
        benchmarkName = match[2];
      }

      // Normalize benchmark name
      benchmarkName = normalizeBenchmarkName(benchmarkName);

      // Avoid duplicates
      const key = `${benchmarkName}-${score}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Validate score
      if (isNaN(score) || score < 0 || score > 100) continue;

      // Convert percentage to decimal if needed
      const normalizedScore = score > 1 ? score / 100 : score;

      results.push({
        name: benchmarkName,
        score: normalizedScore,
        unit: 'accuracy',
        higherIsBetter: true,
      });
    }
  }

  return results;
}

/**
 * Normalize benchmark name to match our known benchmarks
 */
function normalizeBenchmarkName(name: string): string {
  const normalized = name.trim().toUpperCase().replace(/[_\s-]/g, '');

  // Map common variations
  const mappings: Record<string, string> = {
    'HUMANEVAL': 'HumanEval',
    'GSM8K': 'GSM8K',
    'MMLU': 'MMLU',
    'HELLASWAG': 'HellaSwag',
    'ARC': 'ARC-Challenge',
    'ARCC': 'ARC-Challenge',
    'ARCCHALLENGE': 'ARC-Challenge',
    'GAIA': 'GAIA',
    'AGIEVAL': 'AGIEval',
    'MMMU': 'MMMU',
    'MATH': 'MATH',
    'MBPP': 'MBPP',
    'VQA': 'VQA',
  };

  return mappings[normalized] || name;
}

/**
 * Analyze if benchmark results indicate AGI-relevant progress
 */
export function analyzeBenchmarkSignificance(
  results: BenchmarkResult[]
): {
  hasSignificantBreakthrough: boolean;
  breakthroughScore: number; // 0-1
  reasons: string[];
  details: Array<{
    benchmark: string;
    score: number;
    improvement?: number;
    isHumanLevel: boolean;
    isSignificant: boolean;
  }>;
} {
  const analysis = {
    hasSignificantBreakthrough: false,
    breakthroughScore: 0,
    reasons: [] as string[],
    details: [] as any[],
  };

  for (const result of results) {
    const threshold = AGI_BENCHMARKS[result.name];
    if (!threshold) continue; // Unknown benchmark

    const improvement = threshold.previousSOTA
      ? ((result.score - threshold.previousSOTA) / threshold.previousSOTA) * 100
      : ((result.score - threshold.baseline) / threshold.baseline) * 100;

    const isHumanLevel = threshold.humanLevel
      ? result.score >= threshold.humanLevel * 0.95 // Within 5% of human level
      : false;

    const isSignificant = improvement >= threshold.significantImprovement;

    analysis.details.push({
      benchmark: result.name,
      score: result.score,
      improvement,
      isHumanLevel,
      isSignificant,
    });

    // Calculate breakthrough score contribution
    if (isHumanLevel) {
      analysis.breakthroughScore += 0.3;
      analysis.reasons.push(
        `🎯 Human-level performance on ${result.name}: ${(result.score * 100).toFixed(1)}%`
      );
      analysis.hasSignificantBreakthrough = true;
    } else if (isSignificant) {
      analysis.breakthroughScore += 0.2;
      analysis.reasons.push(
        `📈 Significant improvement on ${result.name}: +${improvement.toFixed(1)}% (${(result.score * 100).toFixed(1)}%)`
      );
      analysis.hasSignificantBreakthrough = true;
    }

    // Super-human performance is extremely significant
    if (threshold.humanLevel && result.score > threshold.humanLevel) {
      analysis.breakthroughScore += 0.4;
      analysis.reasons.push(
        `🚀 SUPER-HUMAN performance on ${result.name}: ${(result.score * 100).toFixed(1)}% (human: ${(threshold.humanLevel * 100).toFixed(1)}%)`
      );
      analysis.hasSignificantBreakthrough = true;
    }
  }

  // Multiple benchmark improvements are more significant
  const significantCount = analysis.details.filter(d => d.isSignificant || d.isHumanLevel).length;
  if (significantCount >= 3) {
    analysis.breakthroughScore += 0.3;
    analysis.reasons.push(
      `⭐ Multiple benchmarks improved: ${significantCount} significant results`
    );
  }

  // Cap at 1.0
  analysis.breakthroughScore = Math.min(analysis.breakthroughScore, 1.0);

  return analysis;
}

/**
 * Generate benchmark analysis boost for AGI score
 */
export function getBenchmarkBoost(text: string): {
  boost: number; // Multiplier (1.0 = no boost, up to 2.0)
  reasons: string[];
  benchmarks: BenchmarkResult[];
} {
  const benchmarks = extractBenchmarkResults(text);

  if (benchmarks.length === 0) {
    return { boost: 1.0, reasons: [], benchmarks: [] };
  }

  const analysis = analyzeBenchmarkSignificance(benchmarks);

  // Convert breakthrough score to boost multiplier
  const boost = 1.0 + analysis.breakthroughScore; // 1.0 to 2.0

  return {
    boost,
    reasons: analysis.reasons,
    benchmarks,
  };
}

/**
 * Check if content mentions crossing a critical AGI benchmark threshold
 */
export function detectBenchmarkThresholdCrossing(text: string): {
  hasCriticalThreshold: boolean;
  thresholds: string[];
  agiRelevanceScore: number; // 0-1
} {
  const benchmarks = extractBenchmarkResults(text);
  const thresholds: string[] = [];
  let totalScore = 0;

  for (const benchmark of benchmarks) {
    const threshold = AGI_BENCHMARKS[benchmark.name];
    if (!threshold) continue;

    // Check for critical thresholds
    if (threshold.humanLevel && benchmark.score >= threshold.humanLevel) {
      thresholds.push(`${benchmark.name} reached human-level performance`);
      totalScore += 0.8;
    }

    // Check for large jumps
    const improvement = threshold.previousSOTA
      ? ((benchmark.score - threshold.previousSOTA) / threshold.previousSOTA) * 100
      : 0;

    if (improvement >= 20) { // 20%+ improvement
      thresholds.push(`${benchmark.name} improved by ${improvement.toFixed(0)}%`);
      totalScore += 0.5;
    }
  }

  return {
    hasCriticalThreshold: thresholds.length > 0,
    thresholds,
    agiRelevanceScore: Math.min(totalScore / benchmarks.length || 0, 1.0),
  };
}
