import type { EvidenceClaim } from '@/lib/evidence/extract';

export type WatchPriority = 'low' | 'medium' | 'high' | 'critical';
export type EvidenceConfidence = 'none' | 'weak' | 'moderate' | 'strong' | 'extraordinary';
export type ClaimType =
  | 'benchmark'
  | 'autonomy'
  | 'generalization'
  | 'self_improvement'
  | 'science'
  | 'deployment'
  | 'secrecy'
  | 'governance'
  | 'security'
  | 'asi';
export type SourceStatus =
  | 'live'
  | 'cached_fresh'
  | 'cached_stale'
  | 'manual_snapshot'
  | 'unavailable'
  | 'model_inferred';
export type Corroboration = 'none' | 'same_source' | 'independent_source' | 'primary_source' | 'replicated';
export type ClaimLadder =
  | 'mentioned'
  | 'claimed'
  | 'demonstrated'
  | 'independently_corroborated'
  | 'replicated'
  | 'sustained_in_deployment';
export type ASIStatus = 'insufficient_evidence' | 'watch' | 'candidate' | 'extraordinary_claim';

export type EvidenceVector = Record<ClaimType, number> & {
  corroboration: number;
  sourceQuality: number;
  uncertainty: number;
};

export interface SignalAssessment {
  watchPriority: WatchPriority;
  evidenceConfidence: EvidenceConfidence;
  claimTypes: ClaimType[];
  sourceStatus: SourceStatus;
  corroboration: Corroboration;
  claimLadder: ClaimLadder;
  asiStatus: ASIStatus;
  uncertaintyReason: string;
  requiredVerification: string[];
  evidenceVector: EvidenceVector;
}

const CLAIM_KEYWORDS: Array<{ type: ClaimType; patterns: RegExp[] }> = [
  {
    type: 'autonomy',
    patterns: [/autonomous/i, /agent/i, /long[- ]horizon/i, /tool use/i, /planning/i, /delegat/i],
  },
  {
    type: 'generalization',
    patterns: [/generaliz/i, /cross[- ]domain/i, /transfer/i, /zero[- ]shot/i, /distribution shift/i],
  },
  {
    type: 'self_improvement',
    patterns: [/self[- ]improv/i, /recursive/i, /auto(?:nomously)? improve/i, /improv(?:es|ing) its own/i],
  },
  {
    type: 'science',
    patterns: [/hypothes/i, /experiment/i, /scientific/i, /discover/i, /publication-quality/i],
  },
  {
    type: 'deployment',
    patterns: [/deployment/i, /enterprise/i, /workflow/i, /production/i, /cost collapse/i, /economic/i],
  },
  {
    type: 'secrecy',
    patterns: [/nda/i, /classified/i, /silent/i, /briefing/i, /undisclosed/i, /compute spike/i],
  },
  {
    type: 'governance',
    patterns: [/government/i, /regulation/i, /export control/i, /national security/i, /policy/i],
  },
  {
    type: 'security',
    patterns: [/vulnerabil/i, /exploit/i, /phishing/i, /cyber/i, /self[- ]replicat/i, /unauthorized/i],
  },
  {
    type: 'asi',
    patterns: [/superintelligence/i, /\basi\b/i, /superhuman across/i, /beyond human/i],
  },
];

const STALE_OR_UNAVAILABLE = new Set<SourceStatus>(['cached_stale', 'manual_snapshot', 'unavailable', 'model_inferred']);

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function confidenceFromScore(score: number): EvidenceConfidence {
  if (score >= 0.85) return 'extraordinary';
  if (score >= 0.65) return 'strong';
  if (score >= 0.4) return 'moderate';
  if (score > 0) return 'weak';
  return 'none';
}

function priorityFromScore(score: number): WatchPriority {
  if (score >= 0.75) return 'critical';
  if (score >= 0.5) return 'high';
  if (score >= 0.25) return 'medium';
  return 'low';
}

function corroborationScore(corroboration: Corroboration): number {
  switch (corroboration) {
    case 'replicated': return 1;
    case 'primary_source': return 0.8;
    case 'independent_source': return 0.7;
    case 'same_source': return 0.35;
    default: return 0;
  }
}

function sourceQuality(sourceStatus: SourceStatus): number {
  switch (sourceStatus) {
    case 'live': return 1;
    case 'cached_fresh': return 0.8;
    case 'cached_stale': return 0.45;
    case 'manual_snapshot': return 0.35;
    case 'model_inferred': return 0.2;
    case 'unavailable': return 0;
  }
}

function detectClaimTypes(claims: EvidenceClaim[], content = ''): ClaimType[] {
  const text = `${content} ${claims.map(claim => `${claim.claim} ${claim.evidence}`).join(' ')}`;
  const detected = new Set<ClaimType>();

  if (claims.some(claim => Boolean(claim.benchmark))) {
    detected.add('benchmark');
  }

  for (const entry of CLAIM_KEYWORDS) {
    if (entry.patterns.some(pattern => pattern.test(text))) {
      detected.add(entry.type);
    }
  }

  return Array.from(detected);
}

function claimLadderFromInput(input: {
  corroboration: Corroboration;
  sourceStatus: SourceStatus;
  hasBenchmarkDelta: boolean;
  content?: string;
}): ClaimLadder {
  const text = input.content || '';
  if (/sustained|in production|deployed across|enterprise rollout/i.test(text)) return 'sustained_in_deployment';
  if (input.corroboration === 'replicated') return 'replicated';
  if (input.corroboration === 'independent_source' || input.corroboration === 'primary_source') {
    return 'independently_corroborated';
  }
  if (/demo|demonstrat|paper|code|open[- ]source|verified/i.test(text) || input.hasBenchmarkDelta) {
    return 'demonstrated';
  }
  if (/claim|announce|report|says|states/i.test(text)) return 'claimed';
  return 'mentioned';
}

export function assessSignal(input: {
  claims?: EvidenceClaim[];
  content?: string;
  sourceStatus?: SourceStatus;
  corroboration?: Corroboration;
  modelScore?: number;
  heuristicScore?: number;
  secrecyBoost?: number;
  sourceName?: string;
}): SignalAssessment {
  const claims = input.claims || [];
  const sourceStatus = input.sourceStatus || 'live';
  const corroboration = input.corroboration || 'none';
  const claimTypes = detectClaimTypes(claims, input.content);
  const hasBenchmarkDelta = claims.some(claim => Boolean(claim.benchmark) && typeof claim.delta === 'number');
  const modelSignal = clamp(input.modelScore || 0);
  const heuristicSignal = clamp(input.heuristicScore || 0);
  const secrecySignal = clamp(input.secrecyBoost || 0);
  const sourceSignal = sourceQuality(sourceStatus);
  const corroborationSignal = corroborationScore(corroboration);
  const multiAxisBonus = Math.min(0.2, Math.max(0, claimTypes.length - 1) * 0.04);
  const stalePenalty = STALE_OR_UNAVAILABLE.has(sourceStatus) ? 0.2 : 0;
  const singleBenchmarkPenalty =
    claimTypes.length === 1 && claimTypes[0] === 'benchmark' && corroborationSignal < 0.7 ? 0.15 : 0;

  const evidenceBase = clamp(
    modelSignal * 0.35 +
    heuristicSignal * 0.25 +
    sourceSignal * 0.15 +
    corroborationSignal * 0.2 +
    multiAxisBonus -
    stalePenalty -
    singleBenchmarkPenalty
  );

  const watchBase = clamp(
    modelSignal * 0.35 +
    heuristicSignal * 0.25 +
    secrecySignal +
    multiAxisBonus +
    (claimTypes.includes('security') ? 0.08 : 0) +
    (claimTypes.includes('asi') ? 0.1 : 0)
  );

  const evidenceVector: EvidenceVector = {
    benchmark: claimTypes.includes('benchmark') ? heuristicSignal : 0,
    autonomy: claimTypes.includes('autonomy') ? Math.max(modelSignal, 0.3) : 0,
    generalization: claimTypes.includes('generalization') ? Math.max(modelSignal, 0.3) : 0,
    self_improvement: claimTypes.includes('self_improvement') ? Math.max(modelSignal, 0.35) : 0,
    science: claimTypes.includes('science') ? Math.max(modelSignal, 0.3) : 0,
    deployment: claimTypes.includes('deployment') ? Math.max(modelSignal, 0.25) : 0,
    secrecy: claimTypes.includes('secrecy') ? Math.max(secrecySignal, 0.2) : 0,
    governance: claimTypes.includes('governance') ? Math.max(modelSignal, 0.2) : 0,
    security: claimTypes.includes('security') ? Math.max(modelSignal, 0.35) : 0,
    asi: claimTypes.includes('asi') ? Math.max(modelSignal, 0.2) : 0,
    corroboration: corroborationSignal,
    sourceQuality: sourceSignal,
    uncertainty: clamp(1 - evidenceBase),
  };

  const requiredVerification: string[] = [];
  if (corroboration === 'none' || corroboration === 'same_source') {
    requiredVerification.push('Independent source corroboration');
  }
  if (sourceStatus !== 'live' && sourceStatus !== 'cached_fresh') {
    requiredVerification.push('Fresh primary-source fetch');
  }
  if (claimTypes.includes('benchmark') && !hasBenchmarkDelta) {
    requiredVerification.push('Comparable benchmark delta or official result');
  }
  if (claimTypes.includes('asi')) {
    requiredVerification.push('Sustained superhuman multi-domain evidence');
  }

  let uncertaintyReason = 'Evidence is treated as a signal until corroborated.';
  if (sourceStatus === 'unavailable') {
    uncertaintyReason = 'The source could not be fetched, so no fresh evidence is available.';
  } else if (sourceStatus === 'manual_snapshot' || sourceStatus === 'cached_stale') {
    uncertaintyReason = 'The source data is stale or manually snapshotted, so it may not reflect current reality.';
  } else if (singleBenchmarkPenalty > 0) {
    uncertaintyReason = 'A single benchmark is not enough to justify an AGI or ASI conclusion.';
  } else if (corroboration === 'none') {
    uncertaintyReason = 'The signal has not been independently corroborated.';
  }

  const asiStatus: ASIStatus =
    claimTypes.includes('asi') && evidenceBase >= 0.85 && corroboration === 'replicated'
      ? 'extraordinary_claim'
      : claimTypes.includes('asi') && evidenceBase >= 0.65
        ? 'candidate'
        : claimTypes.includes('asi')
          ? 'watch'
          : 'insufficient_evidence';

  return {
    watchPriority: priorityFromScore(watchBase),
    evidenceConfidence: confidenceFromScore(evidenceBase),
    claimTypes: claimTypes.length > 0 ? claimTypes : ['benchmark'],
    sourceStatus,
    corroboration,
    claimLadder: claimLadderFromInput({
      corroboration,
      sourceStatus,
      hasBenchmarkDelta,
      content: input.content,
    }),
    asiStatus,
    uncertaintyReason,
    requiredVerification,
    evidenceVector,
  };
}

export function canUseAgiLanguage(assessment: SignalAssessment): boolean {
  const multiAxis = assessment.claimTypes.filter(type => type !== 'benchmark').length >= 2;
  const strongEvidence =
    assessment.evidenceConfidence === 'strong' ||
    assessment.evidenceConfidence === 'extraordinary';
  return (
    multiAxis &&
    strongEvidence &&
    (assessment.corroboration === 'independent_source' ||
      assessment.corroboration === 'primary_source' ||
      assessment.corroboration === 'replicated') &&
    (assessment.sourceStatus === 'live' || assessment.sourceStatus === 'cached_fresh')
  );
}
