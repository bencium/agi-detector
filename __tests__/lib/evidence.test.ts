import { extractEvidenceSnippets, extractEvidenceClaims } from '@/lib/evidence/extract';

describe('evidence extraction', () => {
  it('extracts numeric/benchmark claims', () => {
    const content = [
      'We achieve 12% on ARC-AGI and improve SOTA by 5%.',
      'This paper presents a new optimizer.',
      'Results on ImageNet show a 3.2% gain.'
    ].join(' ');

    const snippets = extractEvidenceSnippets(content, 3);
    expect(snippets.length).toBeGreaterThan(0);
    expect(snippets[0].text).toMatch(/ARC-AGI|ImageNet|SOTA/i);

    const claims = extractEvidenceClaims(snippets, 2);
    expect(claims.length).toBeGreaterThan(0);
    expect(claims[0].numbers.length).toBeGreaterThan(0);
    expect(claims[0].benchmark).toBeDefined();
    expect(typeof claims[0].delta === 'number' || typeof claims[0].value === 'number').toBe(true);
  });

  it('returns empty when no evidence signals found', () => {
    const content = 'This is a general discussion about ethics and society.';
    const snippets = extractEvidenceSnippets(content, 3);
    expect(snippets.length).toBe(0);
  });
});
