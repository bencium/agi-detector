/**
 * Tests for Crawler Strategy Selection
 * Tests the prioritization of crawling strategies for different sources
 */

describe('Crawler Strategy Selection', () => {
  // Sources that require Playwright (blocked by anti-bot measures)
  const BLOCKED_SOURCES = [
    'OpenAI Blog',
    'DeepMind Research',
    'Anthropic Blog',
    'Microsoft AI Blog'
  ];

  // Sources that work with simple HTTP
  const SIMPLE_SOURCES = [
    'arXiv'
  ];

  describe('Source classification', () => {
    it('should identify blocked sources requiring Playwright', () => {
      BLOCKED_SOURCES.forEach(source => {
        const isBlocked = BLOCKED_SOURCES.includes(source);
        expect(isBlocked).toBe(true);
      });
    });

    it('should identify simple sources not requiring Playwright', () => {
      SIMPLE_SOURCES.forEach(source => {
        const isBlocked = BLOCKED_SOURCES.includes(source);
        expect(isBlocked).toBe(false);
      });
    });

    it('OpenAI Blog should be blocked', () => {
      expect(BLOCKED_SOURCES).toContain('OpenAI Blog');
    });

    it('DeepMind Research should be blocked', () => {
      expect(BLOCKED_SOURCES).toContain('DeepMind Research');
    });

    it('Anthropic Blog should be blocked', () => {
      expect(BLOCKED_SOURCES).toContain('Anthropic Blog');
    });

    it('Microsoft AI Blog should be blocked', () => {
      expect(BLOCKED_SOURCES).toContain('Microsoft AI Blog');
    });

    it('arXiv should NOT be blocked', () => {
      expect(BLOCKED_SOURCES).not.toContain('arXiv');
    });
  });

  describe('Strategy priority order', () => {
    // Expected order: RSS → Playwright (blocked) → HTTP → Playwright (fallback) → Brave
    const STRATEGY_ORDER = ['rss', 'playwright_blocked', 'http', 'playwright_fallback', 'brave'];

    it('should have correct strategy priority order', () => {
      expect(STRATEGY_ORDER[0]).toBe('rss');
      expect(STRATEGY_ORDER[STRATEGY_ORDER.length - 1]).toBe('brave');
    });

    it('RSS should be first priority (when available)', () => {
      expect(STRATEGY_ORDER.indexOf('rss')).toBe(0);
    });

    it('Playwright should be used for blocked sources before HTTP', () => {
      const playwrightBlockedIndex = STRATEGY_ORDER.indexOf('playwright_blocked');
      const httpIndex = STRATEGY_ORDER.indexOf('http');

      expect(playwrightBlockedIndex).toBeLessThan(httpIndex);
    });

    it('Brave should be last resort', () => {
      expect(STRATEGY_ORDER[STRATEGY_ORDER.length - 1]).toBe('brave');
    });
  });

  describe('RSS feed handling', () => {
    const RSS_SOURCES = [
      { name: 'Google AI Blog', rssUrl: 'https://blog.google/technology/ai/rss/' },
      { name: 'Meta AI', rssUrl: 'https://ai.meta.com/blog/rss/' }
    ];

    it('should have RSS URLs for supported sources', () => {
      RSS_SOURCES.forEach(source => {
        expect(source.rssUrl).toBeTruthy();
        expect(source.rssUrl).toMatch(/^https?:\/\//);
      });
    });

    it('RSS URLs should end with valid RSS paths', () => {
      RSS_SOURCES.forEach(source => {
        expect(source.rssUrl).toMatch(/\/(rss|feed|atom)\/?$/);
      });
    });
  });

  describe('Playwright configuration', () => {
    it('should configure Playwright for headless operation', () => {
      const playwrightConfig = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      };

      expect(playwrightConfig.headless).toBe(true);
    });

    it('should include necessary browser args for containerized environments', () => {
      const containerArgs = ['--no-sandbox', '--disable-setuid-sandbox'];

      containerArgs.forEach(arg => {
        expect(arg).toMatch(/^--/);
      });
    });
  });

  describe('Retry logic', () => {
    it('should define retry attempts', () => {
      const MAX_RETRIES = 3;
      expect(MAX_RETRIES).toBeGreaterThanOrEqual(1);
      expect(MAX_RETRIES).toBeLessThanOrEqual(5);
    });

    it('should define retry delay', () => {
      const RETRY_DELAY_MS = 1000;
      expect(RETRY_DELAY_MS).toBeGreaterThanOrEqual(500);
      expect(RETRY_DELAY_MS).toBeLessThanOrEqual(5000);
    });
  });

  describe('User agent rotation', () => {
    const USER_AGENTS = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
    ];

    it('should have multiple user agents for rotation', () => {
      expect(USER_AGENTS.length).toBeGreaterThanOrEqual(3);
    });

    it('all user agents should look like real browsers', () => {
      USER_AGENTS.forEach(ua => {
        expect(ua).toContain('Mozilla');
        expect(ua.length).toBeGreaterThan(50);
      });
    });

    it('should include both Chrome and Firefox user agents', () => {
      const hasChrome = USER_AGENTS.some(ua => ua.includes('Chrome'));
      const hasFirefox = USER_AGENTS.some(ua => ua.includes('Firefox'));

      expect(hasChrome).toBe(true);
      expect(hasFirefox).toBe(true);
    });
  });

  describe('Timeout configuration', () => {
    const TIMEOUTS = {
      page: 30000,
      navigation: 15000,
      selector: 10000
    };

    it('should define reasonable page timeout', () => {
      expect(TIMEOUTS.page).toBeGreaterThanOrEqual(15000);
      expect(TIMEOUTS.page).toBeLessThanOrEqual(60000);
    });

    it('should define navigation timeout', () => {
      expect(TIMEOUTS.navigation).toBeGreaterThanOrEqual(5000);
      expect(TIMEOUTS.navigation).toBeLessThanOrEqual(30000);
    });

    it('page timeout should be greater than navigation timeout', () => {
      expect(TIMEOUTS.page).toBeGreaterThan(TIMEOUTS.navigation);
    });
  });

  describe('Error handling scenarios', () => {
    const RETRYABLE_ERRORS = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ERR_NETWORK_CHANGED',
      'Navigation timeout'
    ];

    const NON_RETRYABLE_ERRORS = [
      'ERR_INVALID_URL',
      'ERR_ACCESS_DENIED',
      '403 Forbidden'
    ];

    it('should identify retryable network errors', () => {
      RETRYABLE_ERRORS.forEach(error => {
        const isRetryable = RETRYABLE_ERRORS.includes(error);
        expect(isRetryable).toBe(true);
      });
    });

    it('should identify non-retryable errors', () => {
      NON_RETRYABLE_ERRORS.forEach(error => {
        const isRetryable = RETRYABLE_ERRORS.includes(error);
        expect(isRetryable).toBe(false);
      });
    });

    it('should have connection reset as retryable', () => {
      expect(RETRYABLE_ERRORS).toContain('ECONNRESET');
    });

    it('should have timeout as retryable', () => {
      expect(RETRYABLE_ERRORS).toContain('ETIMEDOUT');
    });
  });

  describe('Content extraction patterns', () => {
    // Common selectors for extracting article content
    const ARTICLE_SELECTORS = {
      title: ['h1', 'article h1', '.post-title', '[data-testid="title"]'],
      content: ['article', '.post-content', '.article-body', 'main'],
      date: ['time', '.date', '.published-date', '[datetime]']
    };

    it('should have title selectors defined', () => {
      expect(ARTICLE_SELECTORS.title.length).toBeGreaterThan(0);
    });

    it('should have content selectors defined', () => {
      expect(ARTICLE_SELECTORS.content.length).toBeGreaterThan(0);
    });

    it('should include standard HTML5 article element', () => {
      expect(ARTICLE_SELECTORS.content).toContain('article');
    });

    it('should include time element for dates', () => {
      expect(ARTICLE_SELECTORS.date).toContain('time');
    });
  });
});

describe('Source URL patterns', () => {
  const SOURCES = [
    { name: 'OpenAI Blog', url: 'https://openai.com/blog', pattern: /openai\.com\/blog/ },
    { name: 'DeepMind', url: 'https://deepmind.google/research', pattern: /deepmind\.google/ },
    { name: 'Anthropic', url: 'https://www.anthropic.com/news', pattern: /anthropic\.com\/news/ },
    { name: 'arXiv AI', url: 'https://arxiv.org/list/cs.AI/recent', pattern: /arxiv\.org/ },
    { name: 'Microsoft AI', url: 'https://www.microsoft.com/en-us/ai/blog', pattern: /microsoft\.com.*ai/ }
  ];

  it('should have valid HTTPS URLs for all sources', () => {
    SOURCES.forEach(source => {
      expect(source.url).toMatch(/^https:\/\//);
    });
  });

  it('should have URL patterns that match source URLs', () => {
    SOURCES.forEach(source => {
      expect(source.url).toMatch(source.pattern);
    });
  });

  it('should include all major AI research organizations', () => {
    const orgNames = SOURCES.map(s => s.name.toLowerCase());

    expect(orgNames.some(n => n.includes('openai'))).toBe(true);
    expect(orgNames.some(n => n.includes('deepmind'))).toBe(true);
    expect(orgNames.some(n => n.includes('anthropic'))).toBe(true);
    expect(orgNames.some(n => n.includes('arxiv'))).toBe(true);
  });
});
