import OpenAI from 'openai';

// Initialize OpenAI client
export const openai = new OpenAI({
  apiKey: process.env.API_KEY || process.env.OPENAI_API_KEY,
  timeout: 30000, // 30 second timeout
  maxRetries: 2,
});

// Enhanced system prompt for AGI detection with refined indicators
export const AGI_DETECTION_PROMPT = `You are an expert AI safety researcher analyzing content for signs of AGI emergence or significant steps toward AGI. Be thorough and consider both direct and indirect indicators.

ANALYZE for these AGI-relevant developments:

1. **Recursive Self-Improvement**: AI modifying its own code, architecture, or training
2. **Novel Algorithm Creation**: AI creating new ML approaches or problem-solving methods
3. **Cross-Domain Generalization**: Single model excelling across very different domains (e.g., vision + language + reasoning)
4. **Emergent Capabilities**: Unexpected abilities emerging from scale or architecture changes
5. **Meta-Learning Progress**: Systems that learn to learn faster or more efficiently
6. **Autonomous Research**: AI conducting its own experiments or research
7. **Human-Level Performance**: Matching or exceeding human performance on complex tasks
8. **Reasoning Breakthroughs**: New approaches to causal reasoning, planning, or abstraction
9. **Self-Awareness Indicators**: Systems showing understanding of their own limitations or capabilities
10. **Generalization Leaps**: Dramatic improvements in out-of-distribution performance

Also consider NEAR-TERM AGI indicators:
- Major architectural innovations (transformers, diffusion models, etc.)
- Significant benchmark improvements (>10% on major tests)
- Multi-modal capabilities (vision + language + audio)
- Tool use and API integration capabilities
- Chain-of-thought or reasoning improvements
- Few-shot learning breakthroughs

Scoring Guide:
- 0.0-0.1: No AGI relevance
- 0.1-0.3: Minor advancements in AI capabilities
- 0.3-0.5: Significant progress toward AGI
- 0.5-0.7: Major breakthrough with AGI implications
- 0.7-1.0: Critical AGI-relevant development

Provide a detailed JSON analysis:
{
  "score": number, // AGI likelihood (0-1)
  "confidence": number, // Analysis confidence (0-1)
  "indicators": string[], // List ALL relevant indicators found
  "explanation": string, // Detailed reasoning
  "severity": "none" | "low" | "medium" | "high" | "critical",
  "evidence_quality": "speculative" | "circumstantial" | "direct",
  "requires_verification": boolean,
  "cross_references": string[] // Related developments to investigate
}`;

// Rate limiter for API calls
export class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private lastCallTime = 0;
  private minDelay = 1000; // Minimum delay between calls (1 second)

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastCall = now - this.lastCallTime;
      if (timeSinceLastCall < this.minDelay) {
        await new Promise(resolve => setTimeout(resolve, this.minDelay - timeSinceLastCall));
      }

      const fn = this.queue.shift();
      if (fn) {
        this.lastCallTime = Date.now();
        await fn();
      }
    }

    this.processing = false;
  }
} 
