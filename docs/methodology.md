# AGI Detector Methodology

## Core Rule

Detect everything plausible. Label nothing as true until evidence supports it.

The system is an AGI signal detector, not an oracle. It should collect weak,
strange, early, indirect, and high-noise signals, then explain what is known,
what is inferred, and what could be wrong.

## Signal, Evidence, Conclusion

- **Signal:** something worth noticing.
- **Evidence:** source-backed material with provenance, timestamp, and context.
- **Conclusion:** the system's cautious interpretation of the evidence.

LLM output is never evidence by itself. It is an interpretation layer over raw
sources, benchmark data, and extracted claims.

## Two Scores

The product separates urgency from certainty.

- **Watch Priority:** how urgently a human should review the signal.
- **Evidence Confidence:** how strongly the available evidence supports the
  claim.

A claim can be high watch priority and weak evidence confidence at the same
time. For example, a credible rumor about self-improvement should be reviewed,
but it should not be presented as verified AGI progress.

## Claim Types

The detector tracks these signal categories:

- `benchmark`
- `autonomy`
- `generalization`
- `self_improvement`
- `science`
- `deployment`
- `secrecy`
- `governance`
- `security`
- `asi`

ARC-AGI is treated as `benchmark` evidence only. It cannot, by itself, produce
an "AGI achieved", "near AGI", or "ASI" conclusion.

## Source Status

Every important source-derived signal should expose freshness:

- `live`: fetched successfully from the primary source.
- `cached_fresh`: recent cached data.
- `cached_stale`: old cached data.
- `manual_snapshot`: manually encoded or historical fallback data.
- `unavailable`: source fetch failed.
- `model_inferred`: inferred by an LLM without direct source support.

Manual snapshots and stale cache entries may be useful analyst context, but
they are not live evidence.

## Corroboration

Signals are stronger when independently supported:

- `none`
- `same_source`
- `independent_source`
- `primary_source`
- `replicated`

AGI or ASI-like language requires fresh source data, multi-axis evidence, and
independent corroboration or stronger.

## Claim Ladder

The system distinguishes the maturity of a claim:

- `mentioned`
- `claimed`
- `demonstrated`
- `independently_corroborated`
- `replicated`
- `sustained_in_deployment`

Higher ladder positions raise evidence confidence. They do not remove the need
to inspect provenance.

## ASI Rubric

ASI is not a default interpretation. The system should keep ASI status at
`insufficient_evidence` or `watch` unless evidence shows sustained superhuman
performance across multiple domains, autonomy, external-world impact, and
independent corroboration.

Unsupported ASI language must remain a watch signal with required verification,
not a conclusion.

## Extraordinary Claim Gate

The product must not show AGI or ASI as an established conclusion unless all of
these are true:

- Fresh primary or high-quality source data exists.
- Evidence spans multiple non-benchmark axes.
- The signal is independently corroborated, primary-source verified, or
  replicated.
- The uncertainty explanation and required verification are visible.
- Tests show comparable hype, stale, and single-domain claims are rejected.

## Current Implementation Notes

The first implementation stores the signal assessment inside existing
`scoreBreakdown.signalAssessment` metadata so the behavior can be tested before
adding a heavier database schema. Raw source content and extracted evidence
remain the durable basis for review.
