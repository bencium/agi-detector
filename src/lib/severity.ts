export type Severity = 'none' | 'low' | 'medium' | 'high' | 'critical';

const rank: Record<Severity, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function severityForScore(score: number): Severity {
  if (score >= 0.8) return 'critical';
  if (score >= 0.6) return 'high';
  if (score >= 0.3) return 'medium';
  if (score > 0) return 'low';
  return 'none';
}

export function computeSeverity(score: number, prior?: Severity | null): Severity {
  const computed = severityForScore(score);
  if (!prior) return computed;
  // Never decrease severity
  return rank[computed] >= rank[prior] ? computed : prior;
}

