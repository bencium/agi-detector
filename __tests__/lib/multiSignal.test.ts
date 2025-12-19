import { computeCombinedScore, computeHeuristicScore } from '@/lib/scoring/multiSignal';

describe('multi-signal scoring', () => {
  it('computes heuristic score from claims', () => {
    const { score, signals } = computeHeuristicScore({
      claims: [
        { claim: 'ARC-AGI 12%', evidence: 'ARC-AGI 12%', tags: ['arc-agi'], numbers: [12], benchmark: 'ARC-AGI', value: 12, unit: '%' },
        { claim: 'improves by 6%', evidence: 'improves by 6%', tags: ['improves'], numbers: [6], delta: 6, unit: '%' }
      ],
      snippetsCount: 3
    });

    expect(score).toBeGreaterThan(0);
    expect(signals.length).toBeGreaterThan(0);
  });

  it('combines model and heuristic scores', () => {
    const combined = computeCombinedScore({
      modelScore: 0.2,
      heuristicScore: 0.3,
      secrecyBoost: 0.1,
      signals: []
    });

    expect(combined.combinedScore).toBeGreaterThan(0.2);
  });
});
