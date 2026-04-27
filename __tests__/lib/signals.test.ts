import { assessSignal, canUseAgiLanguage } from '@/lib/methodology/signals';

describe('signal methodology', () => {
  it('treats a single ARC benchmark claim as a signal, not an AGI conclusion', () => {
    const assessment = assessSignal({
      claims: [
        {
          claim: 'Model X achieved 85% on ARC-AGI-2',
          evidence: 'Model X achieved 85% on ARC-AGI-2',
          tags: ['arc-agi', 'benchmark', 'numbers'],
          numbers: [85],
          benchmark: 'ARC-AGI',
          value: 85,
          unit: '%'
        }
      ],
      content: 'Model X achieved 85% on ARC-AGI-2.',
      modelScore: 0.8,
      heuristicScore: 0.4,
      sourceStatus: 'live',
      corroboration: 'none'
    });

    expect(assessment.claimTypes).toContain('benchmark');
    expect(assessment.uncertaintyReason).toContain('single benchmark');
    expect(canUseAgiLanguage(assessment)).toBe(false);
  });

  it('penalizes stale manual snapshots', () => {
    const assessment = assessSignal({
      claims: [],
      content: 'Historical ARC result snapshot.',
      modelScore: 0.4,
      heuristicScore: 0.2,
      sourceStatus: 'manual_snapshot',
      corroboration: 'none'
    });

    expect(assessment.sourceStatus).toBe('manual_snapshot');
    expect(assessment.evidenceConfidence).toBe('weak');
    expect(assessment.requiredVerification).toContain('Fresh primary-source fetch');
  });

  it('allows stronger AGI language only for fresh corroborated multi-axis evidence', () => {
    const assessment = assessSignal({
      claims: [
        {
          claim: 'The system improves by 12% on private science and coding benchmarks.',
          evidence: 'The system improves by 12% on private science and coding benchmarks.',
          tags: ['benchmark', 'generalization', 'numbers'],
          numbers: [12],
          benchmark: 'GPQA',
          delta: 12,
          unit: '%'
        }
      ],
      content:
        'The autonomous system designs experiments, writes code, transfers across domains, and was independently replicated in production.',
      modelScore: 0.9,
      heuristicScore: 0.6,
      sourceStatus: 'live',
      corroboration: 'replicated'
    });

    expect(assessment.claimTypes).toEqual(
      expect.arrayContaining(['benchmark', 'autonomy', 'generalization', 'science', 'deployment'])
    );
    expect(assessment.evidenceConfidence).toMatch(/strong|extraordinary/);
    expect(canUseAgiLanguage(assessment)).toBe(true);
  });

  it('keeps unsupported ASI language in watch mode with verification required', () => {
    const assessment = assessSignal({
      content: 'A blog post speculates about ASI and superintelligence.',
      modelScore: 0.2,
      heuristicScore: 0,
      sourceStatus: 'live',
      corroboration: 'none'
    });

    expect(assessment.claimTypes).toContain('asi');
    expect(assessment.asiStatus).toBe('watch');
    expect(assessment.requiredVerification).toContain('Sustained superhuman multi-domain evidence');
  });
});
