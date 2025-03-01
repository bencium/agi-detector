import axios from 'axios';
import cheerio from 'cheerio';
import { RateLimiter } from './openai';

interface CrawledArticle {
  title: string;
  content: string;
  url: string;
  metadata: {
    source: string;
    timestamp: string;
    id: string;
  };
}

// Sources to monitor
export const SOURCES = {
  RESEARCH_BLOGS: [
    {
      name: 'OpenAI Blog',
      url: 'https://openai.com/blog',
      selector: '.ui-list__item',
      titleSelector: '.ui-title-text',
      contentSelector: '.prose',
      linkSelector: 'a',
    },
    {
      name: 'DeepMind Research',
      url: 'https://deepmind.google/research/',
      selector: '.research-card',
      titleSelector: 'h3',
      contentSelector: 'p',
      linkSelector: 'a',
    },
    {
      name: 'Anthropic Blog',
      url: 'https://www.anthropic.com/news',
      selector: '.news-item',
      titleSelector: 'h2, h3',
      contentSelector: 'p',
      linkSelector: 'a',
    },
    {
      name: 'Microsoft AI Blog',
      url: 'https://blogs.microsoft.com/ai/',
      selector: 'article',
      titleSelector: '.entry-title',
      contentSelector: '.entry-content',
      linkSelector: 'a.entry-title',
    },
  ],
  NEWS_SITES: [
    {
      name: 'TechCrunch AI',
      url: 'https://techcrunch.com/category/artificial-intelligence/',
      selector: 'article.post',
      titleSelector: 'h2.post-title',
      contentSelector: '.post-content',
      linkSelector: 'a.post-link',
    },
    {
      name: 'VentureBeat AI',
      url: 'https://venturebeat.com/category/ai/',
      selector: 'article',
      titleSelector: 'h2.article-title',
      contentSelector: '.article-content',
      linkSelector: 'a.article-link',
    },
  ],
  ACADEMIC: [
    {
      name: 'arXiv AI',
      url: 'https://arxiv.org/list/cs.AI/recent',
      selector: '.meta',
      titleSelector: '.list-title',
      contentSelector: '.list-authors, .list-comments, .list-subjects',
      linkSelector: '.list-identifier > a:first-child',
      transform: {
        title: (text: string) => text.replace(/^Title:\s+/, '').trim(),
        content: (text: string) => text.replace(/\n+/g, ' ').trim(),
        url: (url: string) => `https://arxiv.org${url}`,
      }
    },
  ],
};

const rateLimiter = new RateLimiter();

// Add proxy support and respect robots.txt
const proxyConfig = process.env.PROXY_URL ? {
  proxy: {
    host: new URL(process.env.PROXY_URL).hostname,
    port: parseInt(new URL(process.env.PROXY_URL).port),
  }
} : {};

// Update the source type to include new selectors
type Source = {
  name: string;
  url: string;
  selector: string;
  titleSelector: string;
  contentSelector: string;
  linkSelector: string;
  transform?: {
    title?: (text: string) => string;
    content?: (text: string) => string;
    url?: (url: string) => string;
  };
};

// Add random delay between requests
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Get random delay between 2-5 seconds
const getRandomDelay = () => Math.floor(Math.random() * 3000) + 2000;

// More realistic headers
const getHeaders = () => ({
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"macOS"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1'
});

export async function crawlSource(source: Source): Promise<CrawledArticle[]> {
  try {
    console.log(`[Crawler] Starting to crawl ${source.name} at ${source.url}`);
    
    // Add random delay before request
    await delay(getRandomDelay());
    
    const response = await rateLimiter.add(() => 
      axios.get(source.url, {
        ...proxyConfig,
        headers: getHeaders(),
        timeout: 10000,
        maxRedirects: 5,
        validateStatus: (status) => status < 400,
      })
    );

    console.log(`[Crawler] Got response from ${source.name}, status: ${response.status}`);
    const $ = cheerio.load(response.data);
    const articles: CrawledArticle[] = [];

    console.log(`[Crawler] Looking for elements matching selector: ${source.selector}`);
    const elements = $(source.selector);
    console.log(`[Crawler] Found ${elements.length} matching elements`);

    elements.each((_, element) => {
      const $element = $(element);
      let title = $element.find(source.titleSelector).text().trim();
      let content = $element.find(source.contentSelector).text().trim();
      let url = $element.find(source.linkSelector).attr('href') || '';
      const id = $element.find('.list-identifier').text().trim();

      // Apply transformations if they exist
      if (source.transform) {
        if (source.transform.title) title = source.transform.title(title);
        if (source.transform.content) content = source.transform.content(content);
        if (source.transform.url) url = source.transform.url(url);
      }

      console.log(`[Crawler] Processing element - Title: ${title ? title.substring(0, 50) + '...' : 'none'}`);
      console.log(`[Crawler] Content length: ${content?.length || 0} characters`);

      if (title && content) {
        articles.push({
          title,
          content,
          url,
          metadata: {
            source: source.name,
            timestamp: new Date().toISOString(),
            id: id
          },
        });
      } else {
        console.log(`[Crawler] Skipping element - missing title or content`);
      }
    });

    console.log(`[Crawler] Successfully found ${articles.length} articles from ${source.name}`);
    return articles;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`[Crawler] Error crawling ${source.name}:`, {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url
      });
    } else {
      console.error(`[Crawler] Unknown error crawling ${source.name}:`, error);
    }
    return [];
  }
}

export async function crawlAllSources(): Promise<CrawledArticle[]> {
  const allSources = [
    ...SOURCES.RESEARCH_BLOGS,
    ...SOURCES.NEWS_SITES,
    ...SOURCES.ACADEMIC
  ];

  const results = await Promise.allSettled(
    allSources.map(source => crawlSource(source))
  );

  return results
    .filter((result): result is PromiseFulfilledResult<CrawledArticle[]> => 
      result.status === 'fulfilled'
    )
    .flatMap(result => result.value)
    .filter(article => 
      article.title && 
      article.content && 
      article.content.length > 100
    );
} 