import OpenAI from 'openai';

// Initialize OpenAI client
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// System prompt for AGI detection
export const AGI_DETECTION_PROMPT = `Analyze the following text for potential signs of AGI development. Look for:
1. Unexplained leaps in AI performance
2. AI systems showing self-improvement capabilities
3. Cross-domain knowledge transfer
4. Autonomous behavior
5. Social media manipulation patterns
6. Unattributed AI advancements

Rate each indicator on a scale of 0-1 and provide a confidence score.
Format the response as JSON:
{
  "score": number, // Overall AGI likelihood score (0-1)
  "confidence": number, // Confidence in the analysis (0-1)
  "indicators": string[], // List of detected indicators
  "explanation": string // Brief explanation of the findings
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