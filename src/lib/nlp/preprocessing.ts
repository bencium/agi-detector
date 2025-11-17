/**
 * Lightweight NLP Preprocessing
 *
 * Simple, dependency-free text preprocessing for AGI detection
 * Avoids heavy dependencies like spaCy while providing essential NLP features
 */

export interface PreprocessedText {
  original: string;
  cleaned: string;
  sentences: string[];
  tokens: string[];
  features: {
    wordCount: number;
    sentenceCount: number;
    avgSentenceLength: number;
    technicalDensity: number;
    hasCode: boolean;
    hasMath: boolean;
    hasUrls: boolean;
    hasCitations: boolean;
  };
}

/**
 * Clean and normalize text
 */
export function cleanText(text: string): string {
  // Remove excessive whitespace
  let cleaned = text.replace(/\s+/g, ' ').trim();

  // Normalize quotes (using Unicode escape sequences)
  cleaned = cleaned.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'");

  // Remove control characters but preserve newlines
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return cleaned;
}

/**
 * Simple sentence splitter (regex-based, no ML)
 */
export function splitIntoSentences(text: string): string[] {
  // Split on common sentence boundaries
  const sentences = text
    .split(/[.!?]+\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return sentences;
}

/**
 * Simple tokenizer (word-based, no stemming/lemmatization)
 */
export function tokenize(text: string): string[] {
  // Convert to lowercase and split on word boundaries
  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ') // Keep apostrophes and hyphens
    .split(/\s+/)
    .filter(token => token.length > 0);

  return tokens;
}

/**
 * Extract key phrases (simple n-gram extraction)
 */
export function extractKeyPhrases(text: string, maxPhrases: number = 10): string[] {
  const sentences = splitIntoSentences(text);
  const phrases: Map<string, number> = new Map();

  for (const sentence of sentences) {
    // Extract bigrams and trigrams
    const words = tokenize(sentence);

    // Bigrams
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      phrases.set(bigram, (phrases.get(bigram) || 0) + 1);
    }

    // Trigrams
    for (let i = 0; i < words.length - 2; i++) {
      const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      phrases.set(trigram, (phrases.get(trigram) || 0) + 1);
    }
  }

  // Sort by frequency and return top phrases
  return Array.from(phrases.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxPhrases)
    .map(([phrase]) => phrase);
}

/**
 * Calculate technical density of text
 */
export function calculateTechnicalDensity(text: string): number {
  const tokens = tokenize(text);
  if (tokens.length === 0) return 0;

  let technicalCount = 0;

  // Count technical indicators
  const technicalPatterns = [
    /\d+\.?\d*/,           // Numbers
    /\w+\(\)/,             // Function calls
    /[a-z]+\d+/i,          // Alphanumeric (e.g., gpt4, v2)
    /\b[A-Z]{2,}\b/,       // Acronyms
  ];

  for (const token of tokens) {
    if (technicalPatterns.some(pattern => pattern.test(token))) {
      technicalCount++;
    }
  }

  return technicalCount / tokens.length;
}

/**
 * Detect code blocks in text
 */
export function detectCodeBlocks(text: string): boolean {
  const codePatterns = [
    /```[\s\S]*?```/,                    // Markdown code blocks
    /`[^`]+`/,                           // Inline code
    /\bdef\s+\w+\s*\(/,                  // Python function
    /\bfunction\s+\w+\s*\(/,             // JavaScript function
    /\bclass\s+\w+/,                     // Class definition
    /\bimport\s+[\w.]+/,                 // Import statement
    /\breturn\s+/,                       // Return statement
  ];

  return codePatterns.some(pattern => pattern.test(text));
}

/**
 * Detect mathematical content
 */
export function detectMathContent(text: string): boolean {
  const mathPatterns = [
    /\$\$[\s\S]*?\$\$/,                  // LaTeX display math
    /\$[^\$]+\$/,                        // LaTeX inline math
    /\\[a-z]+{/,                         // LaTeX commands
    /[∀∃∈∉⊂⊃∩∪∫∑∏∇∂≈≠≤≥±×÷√∞]/,        // Math symbols
    /\b(theorem|lemma|proof|corollary)\b/i,
  ];

  return mathPatterns.some(pattern => pattern.test(text));
}

/**
 * Detect URLs in text
 */
export function detectUrls(text: string): boolean {
  return /https?:\/\//.test(text);
}

/**
 * Detect citations in text
 */
export function detectCitations(text: string): boolean {
  const citationPatterns = [
    /\[\d+\]/,                           // [1], [2], etc.
    /\(\d{4}\)/,                         // (2024)
    /\bet al\./,                         // et al.
    /arXiv:\d+\.\d+/,                    // arXiv ID
    /doi:10\.\d+/,                       // DOI
  ];

  return citationPatterns.some(pattern => pattern.test(text));
}

/**
 * Comprehensive text preprocessing
 */
export function preprocessText(text: string): PreprocessedText {
  const cleaned = cleanText(text);
  const sentences = splitIntoSentences(cleaned);
  const tokens = tokenize(cleaned);

  const wordCount = tokens.length;
  const sentenceCount = sentences.length;
  const avgSentenceLength = sentenceCount > 0 ? wordCount / sentenceCount : 0;
  const technicalDensity = calculateTechnicalDensity(cleaned);

  const features = {
    wordCount,
    sentenceCount,
    avgSentenceLength,
    technicalDensity,
    hasCode: detectCodeBlocks(text),
    hasMath: detectMathContent(text),
    hasUrls: detectUrls(text),
    hasCitations: detectCitations(text),
  };

  return {
    original: text,
    cleaned,
    sentences,
    tokens,
    features,
  };
}

/**
 * Extract entities (simple pattern-based, no NER model)
 */
export function extractSimpleEntities(text: string): {
  organizations: string[];
  benchmarks: string[];
  models: string[];
} {
  const organizations: Set<string> = new Set();
  const benchmarks: Set<string> = new Set();
  const models: Set<string> = new Set();

  // Known organizations
  const orgPatterns = [
    'OpenAI', 'DeepMind', 'Anthropic', 'Google', 'Meta', 'Microsoft',
    'MIT', 'Stanford', 'Berkeley', 'CMU',
  ];

  // Known benchmarks
  const benchmarkPatterns = [
    'MMLU', 'HumanEval', 'GSM8K', 'MATH', 'HellaSwag', 'ARC',
    'GAIA', 'AGIEval', 'MMMU',
  ];

  // Model patterns (e.g., GPT-4, Claude-3, LLaMA-2)
  const modelPattern = /\b([A-Z][a-z]+|[A-Z]{2,})[-\s]?\d+(\.\d+)?[a-z]?\b/g;

  for (const org of orgPatterns) {
    if (new RegExp(`\\b${org}\\b`, 'i').test(text)) {
      organizations.add(org);
    }
  }

  for (const benchmark of benchmarkPatterns) {
    if (new RegExp(`\\b${benchmark}\\b`, 'i').test(text)) {
      benchmarks.add(benchmark);
    }
  }

  const modelMatches = text.match(modelPattern);
  if (modelMatches) {
    modelMatches.forEach(match => models.add(match));
  }

  return {
    organizations: Array.from(organizations),
    benchmarks: Array.from(benchmarks),
    models: Array.from(models),
  };
}

/**
 * Calculate text readability (simple Flesch-Kincaid approximation)
 */
export function calculateReadability(text: string): {
  score: number; // 0-100, higher = easier
  level: 'very_easy' | 'easy' | 'medium' | 'difficult' | 'very_difficult';
} {
  const preprocessed = preprocessText(text);
  const { wordCount, sentenceCount, avgSentenceLength } = preprocessed.features;

  if (sentenceCount === 0 || wordCount === 0) {
    return { score: 0, level: 'very_difficult' };
  }

  // Count syllables (rough approximation)
  const syllableCount = preprocessed.tokens.reduce((count, word) => {
    // Very rough syllable count: vowel groups
    const vowelGroups = word.match(/[aeiouy]+/g);
    return count + (vowelGroups?.length || 1);
  }, 0);

  const avgSyllablesPerWord = syllableCount / wordCount;

  // Flesch Reading Ease formula (simplified)
  const score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);

  // Clamp to 0-100
  const clampedScore = Math.max(0, Math.min(100, score));

  let level: 'very_easy' | 'easy' | 'medium' | 'difficult' | 'very_difficult';
  if (clampedScore >= 80) level = 'very_easy';
  else if (clampedScore >= 60) level = 'easy';
  else if (clampedScore >= 40) level = 'medium';
  else if (clampedScore >= 20) level = 'difficult';
  else level = 'very_difficult';

  return { score: clampedScore, level };
}

/**
 * Remove stop words (common English stop words)
 */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'will', 'with', 'this', 'but', 'they', 'have', 'had',
  'what', 'when', 'where', 'who', 'which', 'why', 'how',
]);

export function removeStopWords(tokens: string[]): string[] {
  return tokens.filter(token => !STOP_WORDS.has(token.toLowerCase()));
}

/**
 * Calculate term frequency (TF)
 */
export function calculateTermFrequency(tokens: string[]): Map<string, number> {
  const frequency = new Map<string, number>();

  for (const token of tokens) {
    frequency.set(token, (frequency.get(token) || 0) + 1);
  }

  // Normalize by total count
  const total = tokens.length;
  for (const [term, count] of frequency.entries()) {
    frequency.set(term, count / total);
  }

  return frequency;
}
