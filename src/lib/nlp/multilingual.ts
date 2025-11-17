/**
 * Multilingual Detection and Translation Support
 *
 * Detects non-English content and provides translation support
 * to avoid missing AGI developments from non-English research
 */

import { franc } from 'franc-min';

export interface LanguageDetectionResult {
  language: string; // ISO 639-1 code (en, zh, de, etc.)
  languageName: string;
  confidence: number; // 0-1
  isEnglish: boolean;
  needsTranslation: boolean;
}

// ISO 639-3 to ISO 639-1 mapping for common languages
const LANG_CODE_MAP: Record<string, string> = {
  'eng': 'en', // English
  'cmn': 'zh', // Chinese (Mandarin)
  'deu': 'de', // German
  'fra': 'fr', // French
  'jpn': 'ja', // Japanese
  'kor': 'ko', // Korean
  'spa': 'es', // Spanish
  'rus': 'ru', // Russian
  'por': 'pt', // Portuguese
  'ita': 'it', // Italian
  'nld': 'nl', // Dutch
  'pol': 'pl', // Polish
  'swe': 'sv', // Swedish
  'vie': 'vi', // Vietnamese
  'ara': 'ar', // Arabic
  'hin': 'hi', // Hindi
  'ben': 'bn', // Bengali
  'und': 'en', // Undetermined -> default to English
};

const LANG_NAMES: Record<string, string> = {
  'en': 'English',
  'zh': 'Chinese',
  'de': 'German',
  'fr': 'French',
  'ja': 'Japanese',
  'ko': 'Korean',
  'es': 'Spanish',
  'ru': 'Russian',
  'pt': 'Portuguese',
  'it': 'Italian',
  'nl': 'Dutch',
  'pl': 'Polish',
  'sv': 'Swedish',
  'vi': 'Vietnamese',
  'ar': 'Arabic',
  'hi': 'Hindi',
  'bn': 'Bengali',
};

/**
 * Detect language of text content
 */
export function detectLanguage(text: string): LanguageDetectionResult {
  // franc returns ISO 639-3 codes
  const francCode = franc(text, { minLength: 50 });

  // Convert to ISO 639-1
  const langCode = LANG_CODE_MAP[francCode] || 'en'; // Default to English if unknown
  const languageName = LANG_NAMES[langCode] || 'Unknown';

  const isEnglish = langCode === 'en';
  const confidence = francCode === 'und' ? 0.5 : 0.9; // Lower confidence for undetermined

  return {
    language: langCode,
    languageName,
    confidence,
    isEnglish,
    needsTranslation: !isEnglish,
  };
}

/**
 * Quick check if content is likely non-English
 */
export function isLikelyNonEnglish(text: string): boolean {
  // Check for common non-English character sets
  const hasChineseJapanese = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(text);
  const hasKorean = /[\uac00-\ud7af]/.test(text);
  const hasArabic = /[\u0600-\u06ff]/.test(text);
  const hasCyrillic = /[\u0400-\u04ff]/.test(text);

  if (hasChineseJapanese || hasKorean || hasArabic || hasCyrillic) {
    return true;
  }

  // Use franc for text-based detection
  const detection = detectLanguage(text);
  return !detection.isEnglish && detection.confidence > 0.7;
}

/**
 * Translate text to English (placeholder - requires translation API)
 *
 * Note: Translation APIs are NOT free and we're skipping paid services.
 * This is a placeholder that would integrate with:
 * - Google Translate API (paid)
 * - DeepL API (paid)
 * - LibreTranslate (self-hosted, free)
 *
 * For now, we'll just detect and flag non-English content for manual review.
 */
export async function translateToEnglish(
  text: string,
  sourceLang: string
): Promise<string | null> {
  // TODO: Integrate with free/self-hosted translation service if needed
  // For now, return null to indicate no translation available

  console.warn(`[Multilingual] Translation needed from ${sourceLang} to English`);
  console.warn('[Multilingual] Translation not implemented (requires API/service)');

  return null;
}

/**
 * Get translation note for non-English content
 */
export function getTranslationNote(detection: LanguageDetectionResult): string {
  if (detection.isEnglish) {
    return '';
  }

  return `⚠️ Non-English content detected (${detection.languageName}). ` +
         `Automated translation not available - manual review recommended. ` +
         `Note: May miss important AGI research published in ${detection.languageName}.`;
}

/**
 * Calculate importance multiplier for non-English content
 * (We want to flag non-English content as higher priority for review)
 */
export function getNonEnglishPriorityBoost(detection: LanguageDetectionResult): number {
  if (detection.isEnglish) {
    return 1.0;
  }

  // High-priority languages for AI research
  const HIGH_PRIORITY_LANGS = ['zh', 'de', 'fr', 'ja', 'ko'];

  if (HIGH_PRIORITY_LANGS.includes(detection.language)) {
    return 1.2; // 20% boost for important research languages
  }

  return 1.1; // 10% boost for other languages
}

/**
 * Detect if content contains technical/mathematical notation
 * (Often multilingual in nature)
 */
export function detectTechnicalContent(text: string): {
  hasLatex: boolean;
  hasMathSymbols: boolean;
  hasCode: boolean;
  techScore: number;
} {
  const hasLatex = /\$\$[\s\S]*?\$\$|\$[^\$]+\$|\\[a-z]+{/.test(text);
  const hasMathSymbols = /[∀∃∈∉⊂⊃∩∪∫∑∏∇∂≈≠≤≥±×÷√∞]/.test(text);
  const hasCode = /```[a-z]*\n[\s\S]*?```|`[^`]+`|\bdef\s+\w+\s*\(|\bclass\s+\w+/.test(text);

  const techScore = (hasLatex ? 0.4 : 0) +
                    (hasMathSymbols ? 0.3 : 0) +
                    (hasCode ? 0.3 : 0);

  return { hasLatex, hasMathSymbols, hasCode, techScore };
}

/**
 * Comprehensive language analysis for AGI detection
 */
export function analyzeContentLanguage(title: string, content: string): {
  detection: LanguageDetectionResult;
  technical: ReturnType<typeof detectTechnicalContent>;
  priorityBoost: number;
  translationNote: string;
} {
  const fullText = `${title} ${content}`;
  const detection = detectLanguage(fullText);
  const technical = detectTechnicalContent(fullText);
  const priorityBoost = getNonEnglishPriorityBoost(detection);
  const translationNote = getTranslationNote(detection);

  return {
    detection,
    technical,
    priorityBoost,
    translationNote,
  };
}

/**
 * Extract language-agnostic technical features
 * (Works regardless of text language)
 */
export function extractTechnicalFeatures(text: string): {
  hasNumbers: boolean;
  hasPercentages: boolean;
  hasEquations: boolean;
  hasCitations: boolean;
  hasUrls: boolean;
  technicalDensity: number;
} {
  const hasNumbers = /\d+[\d,.]*/g.test(text);
  const hasPercentages = /\d+%/.test(text);
  const hasEquations = /=.*[+\-*/]|[+\-*/].*=/.test(text);
  const hasCitations = /\[\d+\]|\(\d{4}\)|et al\./.test(text);
  const hasUrls = /https?:\/\//.test(text);

  const numberMatches = text.match(/\d+[\d,.]*/g) || [];
  const technicalDensity = numberMatches.length / Math.max(text.split(/\s+/).length, 1);

  return {
    hasNumbers,
    hasPercentages,
    hasEquations,
    hasCitations,
    hasUrls,
    technicalDensity: Math.min(technicalDensity, 1.0),
  };
}

/**
 * Recommendation on how to handle non-English content
 */
export function getHandlingRecommendation(detection: LanguageDetectionResult): {
  action: 'analyze' | 'translate' | 'flag' | 'skip';
  reason: string;
} {
  if (detection.isEnglish) {
    return { action: 'analyze', reason: 'English content - proceed with normal analysis' };
  }

  // High-priority research languages
  if (['zh', 'de', 'fr', 'ja'].includes(detection.language)) {
    return {
      action: 'flag',
      reason: `High-priority research language (${detection.languageName}) - flag for manual review`,
    };
  }

  // Medium confidence non-English
  if (detection.confidence > 0.7) {
    return {
      action: 'flag',
      reason: `Non-English content (${detection.languageName}) - flag for review`,
    };
  }

  // Low confidence or mixed content
  return {
    action: 'analyze',
    reason: 'Low confidence detection or mixed language - attempt analysis anyway',
  };
}
