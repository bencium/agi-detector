// scraper-utils.ts
// Utility functions and helpers for web scraping

import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

// Types
export interface CacheOptions {
  ttl: number; // Time to live in milliseconds
  directory?: string;
}

export interface RetryOptions {
  maxAttempts: number;
  delay: number;
  backoff: 'linear' | 'exponential';
}

// Cache implementation for scraping results
export class ScraperCache {
  private cacheDir: string;
  private ttl: number;

  constructor(options: CacheOptions) {
    this.ttl = options.ttl;
    this.cacheDir = options.directory || path.join(process.cwd(), '.cache/scraper');
    this.ensureCacheDir();
  }

  private async ensureCacheDir() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create cache directory:', error);
    }
  }

  private getCacheKey(url: string): string {
    return crypto.createHash('md5').update(url).digest('hex');
  }

  private getCachePath(url: string): string {
    return path.join(this.cacheDir, `${this.getCacheKey(url)}.json`);
  }

  async get(url: string): Promise<any | null> {
    try {
      const cachePath = this.getCachePath(url);
      const stats = await fs.stat(cachePath);
      
      // Check if cache is expired
      const age = Date.now() - stats.mtimeMs;
      if (age > this.ttl) {
        await fs.unlink(cachePath);
        return null;
      }

      const data = await fs.readFile(cachePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  async set(url: string, data: any): Promise<void> {
    try {
      const cachePath = this.getCachePath(url);
      await fs.writeFile(cachePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to write cache:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(this.cacheDir, file)))
      );
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }
}

// Retry mechanism with backoff
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === options.maxAttempts) {
        throw lastError;
      }

      const delay = options.backoff === 'exponential'
        ? options.delay * Math.pow(2, attempt - 1)
        : options.delay * attempt;

      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  throw lastError || new Error('Retry failed');
}

// Sleep utility
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Random delay between min and max
export function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return sleep(delay);
}

// Extract domain from URL
export function getDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
}

// Check if URL matches robots.txt rules
export class RobotsChecker {
  private robotsCache: Map<string, string> = new Map();

  async checkRobots(url: string, userAgent: string = '*'): Promise<boolean> {
    const domain = getDomain(url);
    if (!domain) return true;

    const robotsUrl = `https://${domain}/robots.txt`;
    let robotsTxt = this.robotsCache.get(domain);

    if (!robotsTxt) {
      try {
        const response = await fetch(robotsUrl);
        if (response.ok) {
          robotsTxt = await response.text();
          this.robotsCache.set(domain, robotsTxt);
        }
      } catch {
        // If robots.txt is not accessible, assume allowed
        return true;
      }
    }

    if (!robotsTxt) return true;

    // Simple robots.txt parser (you might want to use a library for complex cases)
    const lines = robotsTxt.split('\n');
    let isRelevantUserAgent = false;
    
    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();
      
      if (trimmed.startsWith('user-agent:')) {
        const agent = trimmed.replace('user-agent:', '').trim();
        isRelevantUserAgent = agent === '*' || agent === userAgent.toLowerCase();
      } else if (isRelevantUserAgent && trimmed.startsWith('disallow:')) {
        const path = trimmed.replace('disallow:', '').trim();
        if (path && url.includes(path)) {
          return false; // URL is disallowed
        }
      }
    }

    return true; // URL is allowed
  }
}

// Content extractor utilities
export class ContentExtractor {
  // Extract structured data from HTML
  static extractStructuredData(html: string): any {
    const structuredData: any[] = [];
    
    // Extract JSON-LD
    const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis);
    if (jsonLdMatches) {
      for (const match of jsonLdMatches) {
        try {
          const json = match.replace(/<script[^>]*>|<\/script>/gi, '').trim();
          structuredData.push(JSON.parse(json));
        } catch {
          // Invalid JSON, skip
        }
      }
    }

    return structuredData;
  }

  // Extract Open Graph data
  static extractOpenGraph(html: string): Record<string, string> {
    const ogData: Record<string, string> = {};
    const ogMatches = html.match(/<meta[^>]*property=["']og:([^"']+)["'][^>]*content=["']([^"']+)["']/gi);
    
    if (ogMatches) {
      for (const match of ogMatches) {
        const propertyMatch = match.match(/property=["']og:([^"']+)["']/i);
        const contentMatch = match.match(/content=["']([^"']+)["']/i);
        
        if (propertyMatch && contentMatch) {
          ogData[propertyMatch[1]] = contentMatch[1];
        }
      }
    }

    return ogData;
  }

  // Extract Twitter Card data
  static extractTwitterCard(html: string): Record<string, string> {
    const twitterData: Record<string, string> = {};
    const twitterMatches = html.match(/<meta[^>]*name=["']twitter:([^"']+)["'][^>]*content=["']([^"']+)["']/gi);
    
    if (twitterMatches) {
      for (const match of twitterMatches) {
        const nameMatch = match.match(/name=["']twitter:([^"']+)["']/i);
        const contentMatch = match.match(/content=["']([^"']+)["']/i);
        
        if (nameMatch && contentMatch) {
          twitterData[nameMatch[1]] = contentMatch[1];
        }
      }
    }

    return twitterData;
  }

  // Clean text content
  static cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newline
      .trim();
  }
}

// URL utilities
export class UrlUtils {
  // Normalize URL for consistency
  static normalize(url: string): string {
    try {
      const urlObj = new URL(url);
      
      // Remove trailing slash
      urlObj.pathname = urlObj.pathname.replace(/\/$/, '');
      
      // Sort query parameters
      const params = new URLSearchParams(urlObj.search);
      const sortedParams = new URLSearchParams();
      [...params.entries()].sort().forEach(([key, value]) => {
        sortedParams.append(key, value);
      });
      urlObj.search = sortedParams.toString();
      
      // Remove fragment
      urlObj.hash = '';
      
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  // Check if URL is valid
  static isValid(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Convert relative to absolute URL
  static toAbsolute(url: string, baseUrl: string): string {
    try {
      return new URL(url, baseUrl).toString();
    } catch {
      return url;
    }
  }
}

// Performance monitoring
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  start(label: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      
      if (!this.metrics.has(label)) {
        this.metrics.set(label, []);
      }
      
      this.metrics.get(label)!.push(duration);
    };
  }

  getMetrics(label: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    total: number;
  } | null {
    const times = this.metrics.get(label);
    if (!times || times.length === 0) return null;

    return {
      count: times.length,
      average: times.reduce((a, b) => a + b, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      total: times.reduce((a, b) => a + b, 0)
    };
  }

  reset(label?: string) {
    if (label) {
      this.metrics.delete(label);
    } else {
      this.metrics.clear();
    }
  }
}

// Error handling utilities
export class ScraperError extends Error {
  constructor(
    message: string,
    public code: string,
    public url?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ScraperError';
  }
}

export function isRetryableError(error: any): boolean {
  if (error.code) {
    const retryableCodes = [
      'ETIMEDOUT',
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'EHOSTUNREACH',
      'EPIPE',
      'EAI_AGAIN'
    ];
    return retryableCodes.includes(error.code);
  }

  if (error.message) {
    const retryableMessages = [
      'timeout',
      'network',
      'navigation',
      'aborted'
    ];
    return retryableMessages.some(msg => 
      error.message.toLowerCase().includes(msg)
    );
  }

  return false;
}

// Batch processor for parallel scraping
export class BatchProcessor<T, R> {
  constructor(
    private processor: (item: T) => Promise<R>,
    private options: {
      concurrency: number;
      onError?: (error: Error, item: T) => void;
      onSuccess?: (result: R, item: T) => void;
    }
  ) {}

  async process(items: T[]): Promise<{ results: R[]; errors: Array<{ item: T; error: Error }> }> {
    const results: R[] = [];
    const errors: Array<{ item: T; error: Error }> = [];
    
    const queue = [...items];
    const processing = new Set<Promise<void>>();

    while (queue.length > 0 || processing.size > 0) {
      while (processing.size < this.options.concurrency && queue.length > 0) {
        const item = queue.shift()!;
        
        const promise = this.processor(item)
          .then(result => {
            results.push(result);
            this.options.onSuccess?.(result, item);
          })
          .catch(error => {
            errors.push({ item, error });
            this.options.onError?.(error, item);
          })
          .finally(() => {
            processing.delete(promise);
          });

        processing.add(promise);
      }

      if (processing.size > 0) {
        await Promise.race(processing);
      }
    }

    return { results, errors };
  }
}

// Export all utilities
export const scraperUtils = {
  ScraperCache,
  withRetry,
  sleep,
  randomDelay,
  getDomain,
  RobotsChecker,
  ContentExtractor,
  UrlUtils,
  PerformanceMonitor,
  ScraperError,
  isRetryableError,
  BatchProcessor
};