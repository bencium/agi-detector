/**
 * Silence & Secrecy Pattern Detection
 * Based on AGI Control Paradox: "AGI might hide its capabilities"
 *
 * Monitors for ABSENCE of signals that might indicate hidden AGI development:
 * - Research labs going quiet after major announcements
 * - Sudden removal of public benchmarks/papers
 * - Unexplained delays in previously scheduled releases
 * - Key researchers leaving with NDAs
 * - Compute usage spikes without corresponding publications
 * - Governments requesting private briefings
 * - Emergency AI safety meetings not publicly disclosed
 */

export interface SecrecyIndicator {
  type: 'silence' | 'removal' | 'delay' | 'departure' | 'compute_spike' | 'government' | 'safety_meeting';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  source: string;
  detectedAt: string;
  evidence: string[];
  confidence: number;
}

export interface PublicationPattern {
  source: string;
  expectedFrequency: number; // days between publications
  lastPublication: string;
  currentGapDays: number;
  isAnomalous: boolean;
}

export interface SecrecyAnalysis {
  indicators: SecrecyIndicator[];
  publicationGaps: PublicationPattern[];
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  timestamp: string;
}

// Keywords that suggest secrecy or hidden development
const SECRECY_KEYWORDS = [
  'cannot discuss',
  'classified',
  'confidential',
  'under review',
  'embargo',
  'restricted',
  'private briefing',
  'closed door',
  'non-disclosure',
  'nda',
  'internal only',
  'not for public',
  'redacted',
  'removed at request',
  'taken down',
  'withdrawn',
];

// Keywords that suggest unusual caution
const CAUTION_KEYWORDS = [
  'proceed with caution',
  'safety concerns',
  'alignment concerns',
  'pausing development',
  'slowing down',
  'careful consideration',
  'responsible disclosure',
  'staged release',
  'limited access',
  'controlled rollout',
];

// Keywords that suggest government involvement
const GOVERNMENT_KEYWORDS = [
  'executive order',
  'congressional briefing',
  'senate hearing',
  'classified meeting',
  'national security',
  'defense department',
  'intelligence agency',
  'regulatory review',
  'government consultation',
  'policy briefing',
];

// Expected publication frequencies by source (in days)
const EXPECTED_PUBLICATION_FREQUENCY: Record<string, number> = {
  'OpenAI Blog': 14, // Every 2 weeks
  'DeepMind Research': 21, // Every 3 weeks
  'Anthropic Blog': 14,
  'Microsoft AI Blog': 7,
  'Google AI Blog': 7,
  'arXiv AI': 1, // Daily
};

/**
 * Analyze text content for secrecy indicators
 */
export function analyzeForSecrecyIndicators(
  content: string,
  source: string,
  timestamp: string
): SecrecyIndicator[] {
  const indicators: SecrecyIndicator[] = [];
  const lowerContent = content.toLowerCase();

  // Check for secrecy keywords
  for (const keyword of SECRECY_KEYWORDS) {
    if (lowerContent.includes(keyword)) {
      indicators.push({
        type: 'silence',
        severity: getSeverityForKeyword(keyword),
        description: `Secrecy-related language detected: "${keyword}"`,
        source,
        detectedAt: timestamp,
        evidence: [extractContext(content, keyword)],
        confidence: 0.7
      });
    }
  }

  // Check for unusual caution
  for (const keyword of CAUTION_KEYWORDS) {
    if (lowerContent.includes(keyword)) {
      indicators.push({
        type: 'safety_meeting',
        severity: 'medium',
        description: `Unusual caution detected: "${keyword}"`,
        source,
        detectedAt: timestamp,
        evidence: [extractContext(content, keyword)],
        confidence: 0.5
      });
    }
  }

  // Check for government involvement
  for (const keyword of GOVERNMENT_KEYWORDS) {
    if (lowerContent.includes(keyword)) {
      indicators.push({
        type: 'government',
        severity: 'high',
        description: `Government involvement detected: "${keyword}"`,
        source,
        detectedAt: timestamp,
        evidence: [extractContext(content, keyword)],
        confidence: 0.8
      });
    }
  }

  return indicators;
}

/**
 * Check for researcher departure patterns
 */
export function analyzeResearcherDepartures(content: string, source: string): SecrecyIndicator[] {
  const indicators: SecrecyIndicator[] = [];
  const lowerContent = content.toLowerCase();

  const departureKeywords = [
    'leaving',
    'departing',
    'stepping down',
    'resigned',
    'left the company',
    'no longer with',
    'joined another',
    'new venture',
  ];

  const seniorRoles = [
    'chief scientist',
    'head of ai',
    'research director',
    'vp of research',
    'lead researcher',
    'principal scientist',
    'cto',
    'chief technology',
  ];

  // Check if content mentions senior AI researchers leaving
  const hasDeparture = departureKeywords.some(k => lowerContent.includes(k));
  const hasSeniorRole = seniorRoles.some(k => lowerContent.includes(k));

  if (hasDeparture && hasSeniorRole) {
    indicators.push({
      type: 'departure',
      severity: 'high',
      description: 'Senior AI researcher departure detected',
      source,
      detectedAt: new Date().toISOString(),
      evidence: [content.slice(0, 200)],
      confidence: 0.6
    });
  }

  return indicators;
}

/**
 * Analyze publication gaps for a source
 */
export function analyzePublicationGap(
  sourceName: string,
  lastPublicationDate: string
): PublicationPattern {
  const expectedFrequency = EXPECTED_PUBLICATION_FREQUENCY[sourceName] || 14;
  const lastPub = new Date(lastPublicationDate);
  const now = new Date();
  const daysSinceLastPub = Math.floor((now.getTime() - lastPub.getTime()) / (1000 * 60 * 60 * 24));

  // Consider it anomalous if gap is 2x expected or more
  const isAnomalous = daysSinceLastPub > expectedFrequency * 2;

  return {
    source: sourceName,
    expectedFrequency,
    lastPublication: lastPublicationDate,
    currentGapDays: daysSinceLastPub,
    isAnomalous
  };
}

/**
 * Detect content removal patterns
 */
export function detectContentRemoval(
  previousContent: string[],
  currentContent: string[],
  source: string
): SecrecyIndicator[] {
  const indicators: SecrecyIndicator[] = [];

  // Find content that was present before but is now missing
  const removed = previousContent.filter(title => !currentContent.includes(title));

  if (removed.length > 0) {
    // Check if significant amount of content was removed
    const removalRate = removed.length / previousContent.length;

    if (removalRate > 0.1) { // More than 10% removed
      indicators.push({
        type: 'removal',
        severity: removalRate > 0.3 ? 'critical' : removalRate > 0.2 ? 'high' : 'medium',
        description: `${removed.length} items removed from ${source} (${(removalRate * 100).toFixed(1)}% of content)`,
        source,
        detectedAt: new Date().toISOString(),
        evidence: removed.slice(0, 5), // First 5 removed items
        confidence: 0.9
      });
    }
  }

  return indicators;
}

/**
 * Comprehensive secrecy analysis
 */
export function performSecrecyAnalysis(
  articles: { content: string; source: string; timestamp: string }[],
  publicationHistory: Record<string, string> // source -> lastPublicationDate
): SecrecyAnalysis {
  const allIndicators: SecrecyIndicator[] = [];
  const publicationGaps: PublicationPattern[] = [];

  // Analyze each article for secrecy indicators
  for (const article of articles) {
    const indicators = analyzeForSecrecyIndicators(
      article.content,
      article.source,
      article.timestamp
    );
    allIndicators.push(...indicators);

    // Also check for researcher departures
    const departureIndicators = analyzeResearcherDepartures(article.content, article.source);
    allIndicators.push(...departureIndicators);
  }

  // Analyze publication gaps for each source
  for (const [source, lastDate] of Object.entries(publicationHistory)) {
    const pattern = analyzePublicationGap(source, lastDate);
    publicationGaps.push(pattern);

    // Add indicator if gap is anomalous
    if (pattern.isAnomalous) {
      allIndicators.push({
        type: 'silence',
        severity: pattern.currentGapDays > pattern.expectedFrequency * 4 ? 'high' : 'medium',
        description: `${source} has been unusually quiet (${pattern.currentGapDays} days since last publication, expected every ${pattern.expectedFrequency} days)`,
        source,
        detectedAt: new Date().toISOString(),
        evidence: [`Last publication: ${pattern.lastPublication}`],
        confidence: 0.6
      });
    }
  }

  // Calculate overall risk
  const criticalCount = allIndicators.filter(i => i.severity === 'critical').length;
  const highCount = allIndicators.filter(i => i.severity === 'high').length;
  const anomalousGaps = publicationGaps.filter(p => p.isAnomalous).length;

  let overallRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (criticalCount > 0 || (highCount >= 3 && anomalousGaps >= 2)) {
    overallRisk = 'critical';
  } else if (highCount >= 2 || (highCount >= 1 && anomalousGaps >= 2)) {
    overallRisk = 'high';
  } else if (highCount >= 1 || anomalousGaps >= 2 || allIndicators.length >= 5) {
    overallRisk = 'medium';
  }

  // Generate summary
  let summary = '';
  if (allIndicators.length === 0 && anomalousGaps === 0) {
    summary = 'No secrecy patterns detected. All sources publishing at expected frequency.';
  } else {
    const parts = [];
    if (criticalCount > 0) parts.push(`${criticalCount} critical indicator(s)`);
    if (highCount > 0) parts.push(`${highCount} high-severity indicator(s)`);
    if (anomalousGaps > 0) parts.push(`${anomalousGaps} source(s) unusually quiet`);
    summary = `Secrecy analysis: ${parts.join(', ')}. Overall risk: ${overallRisk.toUpperCase()}`;
  }

  return {
    indicators: allIndicators,
    publicationGaps,
    overallRisk,
    summary,
    timestamp: new Date().toISOString()
  };
}

/**
 * Convert secrecy analysis to crawl results for storage
 */
export function secrecyAnalysisToCrawlResults(analysis: SecrecyAnalysis): any[] {
  const results: any[] = [];

  // Add summary result
  if (analysis.indicators.length > 0 || analysis.publicationGaps.some(p => p.isAnomalous)) {
    results.push({
      title: `Secrecy Pattern Analysis: ${analysis.overallRisk.toUpperCase()} Risk`,
      content: analysis.summary + ' ' + analysis.indicators
        .slice(0, 5)
        .map(i => `${i.type}: ${i.description}`)
        .join('. '),
      url: 'internal://secrecy-analysis',
      metadata: {
        source: 'Secrecy Pattern Detection',
        timestamp: analysis.timestamp,
        id: `secrecy-analysis-${Date.now()}`,
        type: 'secrecy_analysis',
        risk: analysis.overallRisk,
        indicatorCount: analysis.indicators.length
      }
    });
  }

  // Add critical indicators as separate results
  for (const indicator of analysis.indicators.filter(i => i.severity === 'critical' || i.severity === 'high')) {
    results.push({
      title: `Secrecy Alert: ${indicator.description}`,
      content: `${indicator.type.toUpperCase()} indicator detected at ${indicator.source}. Evidence: ${indicator.evidence.join('; ')}. Confidence: ${(indicator.confidence * 100).toFixed(0)}%`,
      url: 'internal://secrecy-indicator',
      metadata: {
        source: 'Secrecy Pattern Detection',
        timestamp: indicator.detectedAt,
        id: `secrecy-indicator-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'secrecy_indicator',
        severity: indicator.severity,
        indicatorType: indicator.type
      }
    });
  }

  return results;
}

// Helper functions

function getSeverityForKeyword(keyword: string): 'low' | 'medium' | 'high' | 'critical' {
  const criticalKeywords = ['classified', 'redacted', 'removed at request'];
  const highKeywords = ['confidential', 'non-disclosure', 'nda', 'private briefing'];

  if (criticalKeywords.some(k => keyword.includes(k))) return 'critical';
  if (highKeywords.some(k => keyword.includes(k))) return 'high';
  return 'medium';
}

function extractContext(content: string, keyword: string): string {
  const lowerContent = content.toLowerCase();
  const index = lowerContent.indexOf(keyword.toLowerCase());
  if (index === -1) return '';

  const start = Math.max(0, index - 50);
  const end = Math.min(content.length, index + keyword.length + 50);
  return '...' + content.slice(start, end) + '...';
}

export {
  SECRECY_KEYWORDS,
  CAUTION_KEYWORDS,
  GOVERNMENT_KEYWORDS,
  EXPECTED_PUBLICATION_FREQUENCY
};
