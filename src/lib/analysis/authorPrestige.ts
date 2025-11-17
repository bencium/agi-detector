/**
 * Author Prestige Scoring System
 *
 * Scores papers/content based on author prestige indicators:
 * - H-index and citation counts
 * - Institutional affiliations
 * - Publication venues
 * - Previous influential work
 */

export interface AuthorPrestige {
  name: string;
  affiliation?: string;
  hIndex?: number;
  citationCount?: number;
  influentialPapers?: number;
  prestigeScore: number; // 0-1
}

export interface PrestigeAnalysis {
  overallScore: number; // 0-1
  boost: number; // Multiplier 1.0-2.0
  authors: AuthorPrestige[];
  reasons: string[];
  topInstitution?: string;
  topVenue?: string;
}

// Tier 1: Top AI research institutions
const TIER_1_INSTITUTIONS = [
  'OpenAI', 'DeepMind', 'Google DeepMind', 'Anthropic',
  'Google Brain', 'Google Research', 'Meta AI', 'Facebook AI Research', 'FAIR',
  'Microsoft Research', 'Apple ML', 'Amazon Science',
  'MIT', 'Stanford', 'Berkeley', 'CMU', 'Princeton',
  'Oxford', 'Cambridge', 'ETH Zurich', 'EPFL',
];

// Tier 2: Strong research institutions
const TIER_2_INSTITUTIONS = [
  'NYU', 'Harvard', 'Yale', 'Cornell', 'Columbia',
  'University of Washington', 'UCLA', 'UCSD', 'Caltech',
  'University of Toronto', 'McGill', 'UBC',
  'Imperial College', 'UCL', 'Edinburgh',
  'Max Planck', 'INRIA', 'CSAIL',
];

// Top-tier conferences and journals
const TOP_VENUES = [
  'NeurIPS', 'ICML', 'ICLR', 'AAAI', 'IJCAI',
  'Nature', 'Science', 'Nature Machine Intelligence',
  'JMLR', 'PAMI', 'TACL',
  'CVPR', 'ICCV', 'ECCV',
  'ACL', 'EMNLP', 'NAACL',
];

// Notable AI researchers (partial list - could be expanded)
const NOTABLE_RESEARCHERS = [
  'Yoshua Bengio', 'Geoffrey Hinton', 'Yann LeCun',
  'Andrew Ng', 'Demis Hassabis', 'Sam Altman',
  'Ilya Sutskever', 'Dario Amodei', 'Chris Olah',
  'Andrej Karpathy', 'Ian Goodfellow', 'Pieter Abbeel',
];

/**
 * Calculate prestige score for an author
 */
export function calculateAuthorPrestige(
  name: string,
  affiliation?: string,
  hIndex?: number,
  citationCount?: number,
  influentialPapers?: number
): AuthorPrestige {
  let prestigeScore = 0;

  // Notable researcher bonus (high prestige)
  if (NOTABLE_RESEARCHERS.some(researcher =>
    name.toLowerCase().includes(researcher.toLowerCase())
  )) {
    prestigeScore += 0.4; // 40% of max score
  }

  // Institutional affiliation
  if (affiliation) {
    if (TIER_1_INSTITUTIONS.some(inst =>
      affiliation.toLowerCase().includes(inst.toLowerCase())
    )) {
      prestigeScore += 0.3; // 30% for Tier 1
    } else if (TIER_2_INSTITUTIONS.some(inst =>
      affiliation.toLowerCase().includes(inst.toLowerCase())
    )) {
      prestigeScore += 0.15; // 15% for Tier 2
    }
  }

  // H-index scoring
  if (hIndex !== undefined) {
    if (hIndex > 100) {
      prestigeScore += 0.3; // World-class
    } else if (hIndex > 50) {
      prestigeScore += 0.2; // Highly influential
    } else if (hIndex > 20) {
      prestigeScore += 0.1; // Established
    }
  }

  // Citation count
  if (citationCount !== undefined) {
    if (citationCount > 50000) {
      prestigeScore += 0.2; // Highly cited
    } else if (citationCount > 10000) {
      prestigeScore += 0.1; // Well cited
    }
  }

  // Influential papers
  if (influentialPapers !== undefined && influentialPapers > 10) {
    prestigeScore += 0.1;
  }

  // Cap at 1.0
  prestigeScore = Math.min(prestigeScore, 1.0);

  return {
    name,
    affiliation,
    hIndex,
    citationCount,
    influentialPapers,
    prestigeScore,
  };
}

/**
 * Analyze prestige for a paper/content based on authors and venue
 */
export function analyzePrestige(
  authors: Array<{ name: string; affiliation?: string; hIndex?: number; citationCount?: number }>,
  venue?: string
): PrestigeAnalysis {
  const authorPrestige: AuthorPrestige[] = [];
  const reasons: string[] = [];

  // Calculate prestige for each author
  for (const author of authors) {
    const prestige = calculateAuthorPrestige(
      author.name,
      author.affiliation,
      author.hIndex,
      author.citationCount
    );
    authorPrestige.push(prestige);
  }

  // Find highest prestige author
  const topAuthor = authorPrestige.reduce((max, author) =>
    author.prestigeScore > max.prestigeScore ? author : max,
    authorPrestige[0] || { prestigeScore: 0, name: '' }
  );

  let overallScore = 0;

  // Top author contributes most
  if (topAuthor && topAuthor.prestigeScore > 0) {
    overallScore = topAuthor.prestigeScore * 0.6; // 60% weight
    reasons.push(`✨ High-prestige author: ${topAuthor.name} (score: ${(topAuthor.prestigeScore * 100).toFixed(0)}%)`);
  }

  // Average of other authors
  const otherAuthors = authorPrestige.slice(1);
  if (otherAuthors.length > 0) {
    const avgOtherPrestige = otherAuthors.reduce((sum, a) => sum + a.prestigeScore, 0) / otherAuthors.length;
    overallScore += avgOtherPrestige * 0.2; // 20% weight
  }

  // Venue prestige
  let venueBoost = 0;
  const isTopVenue = venue && TOP_VENUES.some(v => venue.toUpperCase().includes(v.toUpperCase()));
  if (isTopVenue) {
    venueBoost = 0.2; // 20% weight
    reasons.push(`🏆 Top-tier venue: ${venue}`);
  }
  overallScore += venueBoost;

  // Check for institutional prestige
  const tier1Authors = authorPrestige.filter(a =>
    a.affiliation && TIER_1_INSTITUTIONS.some(inst =>
      a.affiliation!.toLowerCase().includes(inst.toLowerCase())
    )
  );

  if (tier1Authors.length > 0) {
    reasons.push(`🏛️ ${tier1Authors.length} author(s) from Tier 1 institutions`);
  }

  // Top institution
  const topInstitution = tier1Authors.length > 0
    ? tier1Authors[0].affiliation
    : authorPrestige.find(a => a.affiliation)?.affiliation;

  // Calculate boost multiplier
  let boost = 1.0;
  if (overallScore > 0.7) {
    boost = 1.5; // 50% boost for high prestige
  } else if (overallScore > 0.5) {
    boost = 1.3; // 30% boost for medium-high prestige
  } else if (overallScore > 0.3) {
    boost = 1.15; // 15% boost for medium prestige
  }

  return {
    overallScore: Math.min(overallScore, 1.0),
    boost,
    authors: authorPrestige,
    reasons,
    topInstitution,
    topVenue: isTopVenue ? venue : undefined,
  };
}

/**
 * Quick prestige check based on affiliation strings
 */
export function quickPrestigeCheck(affiliations: string[]): number {
  let score = 0;

  for (const affiliation of affiliations) {
    const lower = affiliation.toLowerCase();

    if (TIER_1_INSTITUTIONS.some(inst => lower.includes(inst.toLowerCase()))) {
      score += 0.3;
    } else if (TIER_2_INSTITUTIONS.some(inst => lower.includes(inst.toLowerCase()))) {
      score += 0.15;
    }
  }

  return Math.min(score, 1.0);
}

/**
 * Extract institution from affiliation string
 */
export function extractInstitution(affiliation: string): string | undefined {
  const lower = affiliation.toLowerCase();

  for (const inst of [...TIER_1_INSTITUTIONS, ...TIER_2_INSTITUTIONS]) {
    if (lower.includes(inst.toLowerCase())) {
      return inst;
    }
  }

  return undefined;
}

/**
 * Check if venue is prestigious
 */
export function isPrestigiousVenue(venue: string): boolean {
  const upperVenue = venue.toUpperCase();
  return TOP_VENUES.some(v => upperVenue.includes(v.toUpperCase()));
}
