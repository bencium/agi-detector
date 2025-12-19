import type { EvidenceClaim } from '@/lib/evidence/extract';

export type HeuristicSignal = {
  name: string;
  value: number;
  detail?: string;
};

export type ScoreBreakdown = {
  modelScore: number;
  heuristicScore: number;
  secrecyBoost: number;
  combinedScore: number;
  weights: {
    model: number;
    heuristic: number;
  };
  signals: HeuristicSignal[];
};

const HEURISTIC_MAX = parseFloat(process.env.HEURISTIC_MAX || '0.4');
const MODEL_WEIGHT = parseFloat(process.env.MODEL_SCORE_WEIGHT || '0.85');
const HEURISTIC_WEIGHT = parseFloat(process.env.HEURISTIC_SCORE_WEIGHT || '0.15');

const ARC_BENCHMARKS = new Set(['ARC', 'ARC-AGI', 'ARC-AGI-2']);

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function addSignal(signals: HeuristicSignal[], name: string, value: number, detail?: string) {
  if (value <= 0) return;
  signals.push({ name, value, detail });
}

export function computeHeuristicScore(input: {
  claims: EvidenceClaim[];
  snippetsCount?: number;
}): { score: number; signals: HeuristicSignal[] } {
  const signals: HeuristicSignal[] = [];
  let score = 0;

  const claims = input.claims || [];
  if (claims.length === 0) return { score: 0, signals };

  for (const claim of claims) {
    if (claim.benchmark) {
      score += 0.03;
      addSignal(signals, 'benchmark', 0.03, claim.benchmark);

      if (ARC_BENCHMARKS.has(claim.benchmark) && typeof claim.value === 'number') {
        if (claim.value >= 25) {
          score += 0.15;
          addSignal(signals, 'arc_high_score', 0.15, `${claim.value}${claim.unit || ''}`);
        } else if (claim.value >= 10) {
          score += 0.1;
          addSignal(signals, 'arc_score', 0.1, `${claim.value}${claim.unit || ''}`);
        }
      }
    }

    if (typeof claim.delta === 'number') {
      if (claim.delta >= 10) {
        score += 0.1;
        addSignal(signals, 'benchmark_delta', 0.1, `Δ ${claim.delta}${claim.unit || ''}`);
      } else if (claim.delta >= 5) {
        score += 0.05;
        addSignal(signals, 'benchmark_delta', 0.05, `Δ ${claim.delta}${claim.unit || ''}`);
      }
    }

    if (claim.tags?.includes('human-level')) {
      score += 0.06;
      addSignal(signals, 'human_level', 0.06);
    }

    if (claim.tags?.includes('generalization')) {
      score += 0.04;
      addSignal(signals, 'generalization', 0.04);
    }
  }

  if ((input.snippetsCount || 0) >= 3) {
    score += 0.03;
    addSignal(signals, 'multiple_evidence', 0.03);
  }

  return { score: clamp(score, 0, HEURISTIC_MAX), signals };
}

export function computeCombinedScore(input: {
  modelScore: number;
  heuristicScore: number;
  secrecyBoost?: number;
  signals?: HeuristicSignal[];
}): { combinedScore: number; breakdown: ScoreBreakdown } {
  const secrecyBoost = input.secrecyBoost || 0;
  const weighted = input.modelScore * MODEL_WEIGHT + input.heuristicScore * HEURISTIC_WEIGHT;
  const combined = clamp(Math.max(input.modelScore, weighted) + secrecyBoost, 0, 1);

  return {
    combinedScore: combined,
    breakdown: {
      modelScore: input.modelScore,
      heuristicScore: input.heuristicScore,
      secrecyBoost,
      combinedScore: combined,
      weights: { model: MODEL_WEIGHT, heuristic: HEURISTIC_WEIGHT },
      signals: input.signals || []
    }
  };
}
