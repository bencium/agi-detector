import { applyValidationOverride, enforceCriticalEvidenceGate, severityForScore } from '@/lib/severity';

describe('severity gating', () => {
  it('downgrades critical without benchmark delta', () => {
    const critical = severityForScore(0.9);
    const gated = enforceCriticalEvidenceGate(critical, false);
    expect(gated).toBe('high');
  });

  it('keeps critical with benchmark delta', () => {
    const critical = severityForScore(0.9);
    const gated = enforceCriticalEvidenceGate(critical, true);
    expect(gated).toBe('critical');
  });

  it('applies validation dismiss override', () => {
    const overridden = applyValidationOverride('high', 'dismiss');
    expect(overridden).toBe('medium');
  });

  it('does not downgrade medium on dismiss', () => {
    const overridden = applyValidationOverride('medium', 'dismiss');
    expect(overridden).toBe('medium');
  });
});
