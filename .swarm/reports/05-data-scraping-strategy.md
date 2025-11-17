# Data Scraping Strategy for AGI Detection
## Comprehensive Research and Implementation Plan

**Report Date:** 2025-11-17
**Author:** AGI Detector Development Team
**Version:** 1.0

---

## Executive Summary

This document outlines a comprehensive data scraping strategy to enhance the AGI Detector's ability to identify early signs of Artificial General Intelligence emergence. The strategy expands beyond the current 7 sources to include social media, academic repositories, GitHub activity, research forums, and specialized AI datasets.

**Current Coverage:** 7 sources (~1,000 articles)
**Proposed Coverage:** 40+ sources (~50,000+ articles/month)
**Estimated Implementation Time:** 4-6 weeks
**Estimated Monthly Cost:** $150-300 (API fees + infrastructure)

---

## 1. Research Websites & Official Platforms

### 1.1 Currently Implemented Sources ✅
- **OpenAI Blog** (https://openai.com/blog)
  - Method: RSS feed
  - Volume: ~500 articles
  - Refresh: Daily
  - Status: Working

- **DeepMind Research** (https://deepmind.google/research/)
  - Method: Advanced crawling
  - Volume: ~100 articles
  - Refresh: Daily
  - Status: Working

- **Anthropic Blog** (https://www.anthropic.com/news)
  - Method: Firecrawl API
  - Volume: 3+ articles
  - Refresh: Daily
  - Status: Working

- **Microsoft AI Blog** (https://blogs.microsoft.com/ai/)
  - Method: RSS feed
  - Volume: ~30 articles
  - Refresh: Daily
  - Status: Working

- **TechCrunch AI** (https://techcrunch.com/category/artificial-intelligence/)
  - Method: RSS feed
  - Volume: ~60 articles
  - Refresh: Daily
  - Status: Working

- **VentureBeat AI** (https://venturebeat.com/category/ai/)
  - Method: RSS feed
  - Volume: ~90 articles
  - Refresh: Daily
  - Status: Working

- **arXiv AI** (https://arxiv.org/list/cs.AI/recent)
  - Method: HTML parsing
  - Volume: ~200 articles
  - Refresh: Daily
  - Status: Working

### 1.2 Proposed New AI Research Labs & Companies

#### High Priority (Strong AGI Indicators)

1. **Meta AI Research** (https://ai.meta.com/research/)
   - RSS: https://ai.meta.com/blog/rss/
   - Method: RSS feed (primary), HTML parsing (fallback)
   - Volume: ~50-100 articles
   - Refresh: Daily
   - Priority: HIGH
   - Rationale: Leading foundation model research (LLaMA, SAM, etc.)
   - Implementation: Direct RSS integration

2. **Google AI Blog** (https://blog.google/technology/ai/)
   - RSS: https://blog.google/technology/ai/rss/
   - Method: RSS feed
   - Volume: ~40 articles
   - Refresh: Daily
   - Priority: HIGH
   - Rationale: Gemini, PaLM, and foundational AI research

3. **Stability AI Blog** (https://stability.ai/news)
   - Method: HTML parsing, Firecrawl fallback
   - Volume: ~20 articles
   - Refresh: Weekly
   - Priority: MEDIUM
   - Rationale: Open-source AI models, multimodal research

4. **Cohere AI Blog** (https://cohere.com/blog)
   - Method: HTML parsing
   - Volume: ~30 articles
   - Refresh: Weekly
   - Priority: MEDIUM
   - Rationale: Enterprise AI, RAG systems

5. **Mistral AI Blog** (https://mistral.ai/news/)
   - Method: HTML parsing, API if available
   - Volume: ~15 articles
   - Refresh: Weekly
   - Priority: MEDIUM
   - Rationale: European AI research, open models

6. **Hugging Face Blog** (https://huggingface.co/blog)
   - RSS: https://huggingface.co/blog/feed.xml
   - Method: RSS feed
   - Volume: ~100+ articles
   - Refresh: Daily
   - Priority: HIGH
   - Rationale: Community hub, model releases, research

7. **Allen Institute for AI (AI2)** (https://allenai.org/news)
   - Method: HTML parsing
   - Volume: ~20 articles
   - Refresh: Weekly
   - Priority: MEDIUM
   - Rationale: Academic AI research, benchmarks

#### Medium Priority (Industry & Analysis)

8. **MIT Technology Review AI** (https://www.technologyreview.com/topic/artificial-intelligence/)
   - Method: RSS feed, paid API consideration
   - Volume: ~50 articles
   - Refresh: Daily
   - Priority: MEDIUM
   - Note: May require subscription for full content

9. **AI Alignment Forum** (https://www.alignmentforum.org/)
   - RSS: https://www.alignmentforum.org/feed.xml
   - Method: RSS feed
   - Volume: ~100+ posts
   - Refresh: Daily
   - Priority: HIGH
   - Rationale: AGI safety discussions, research proposals

10. **LessWrong AI Tag** (https://www.lesswrong.com/tag/artificial-intelligence)
    - RSS: https://www.lesswrong.com/feed.xml?view=community-rss&karmaThreshold=30
    - Method: RSS feed with filtering
    - Volume: ~200+ posts (filter by AI tags)
    - Refresh: Daily
    - Priority: MEDIUM
    - Rationale: Early AGI discussions, speculative analysis

11. **The Gradient** (https://thegradient.pub/)
    - RSS: https://thegradient.pub/rss/
    - Method: RSS feed
    - Volume: ~20 articles
    - Refresh: Weekly
    - Priority: MEDIUM
    - Rationale: Technical AI journalism

12. **Import AI Newsletter** (https://jack-clark.net/)
    - Method: Email subscription + manual archive
    - Volume: Weekly newsletter
    - Refresh: Weekly
    - Priority: LOW
    - Note: Consider newsletter-to-RSS service

---

## 2. Social Media Sources

### 2.1 Twitter/X

#### Implementation Strategy
- **Method:** Twitter API v2 (Academic Research access recommended)
- **Alternative:** Unofficial scraping via nitter instances or playwright
- **Cost:** Twitter API Basic: $100/month, Pro: $5,000/month
- **Fallback:** Public nitter instances (https://nitter.net, https://nitter.poast.org)

#### Key Accounts to Monitor

**AI Lab Accounts (30 accounts):**
- @OpenAI
- @AnthropicAI
- @GoogleDeepMind
- @MetaAI
- @MistralAI
- @StabilityAI
- @huggingface
- @CohereAI
- @AIatMeta

**Researchers (50+ accounts):**
- @ylecun (Yann LeCun - Meta)
- @karpathy (Andrej Karpathy)
- @ilyasut (Ilya Sutskever - Safe Superintelligence Inc.)
- @sama (Sam Altman - OpenAI)
- @demishassabis (Demis Hassabis - DeepMind)
- @DarioAmodei (Dario Amodei - Anthropic)
- @AndrewYNg (Andrew Ng)
- @goodfellow_ian (Ian Goodfellow)
- @jeffdean (Jeff Dean - Google)
- @shakir_za (Shakir Mohamed - DeepMind)
- @OriolVinyalsML (Oriol Vinyals - DeepMind)
- @poolio (Jan Leike - Anthropic)
- @EladRichardson
- @arankomatsuzaki

**AGI Safety Researchers:**
- @ESYudkowsky (Eliezer Yudkowsky)
- @robertskmiles (Rob Miles)
- @Paul_Christiano
- @bcrypt
- @RichardMCNgo
- @tszzl (Nate Soares)

**Search Strategy:**
```javascript
// Keywords for Twitter monitoring
const AGI_KEYWORDS = [
  'AGI breakthrough',
  'artificial general intelligence',
  'recursive self-improvement',
  'emergent capabilities',
  'o3 OR o4 OR gpt-5 OR gpt-6',
  'novel architecture',
  'benchmark breakthrough',
  'superintelligence',
  'self-aware AI',
  'world model',
  'chain of thought'
];
```

**Implementation:**
- Refresh: Real-time streaming or hourly polling
- Volume: ~1,000-5,000 tweets/day
- Filtering: Engagement threshold (>100 likes or from verified researchers)
- Priority: HIGH

### 2.2 Reddit

#### Subreddits to Monitor

**High Priority:**
1. **r/artificial** (1M+ members)
   - URL: https://www.reddit.com/r/artificial/.json
   - Method: Reddit API or JSON endpoint
   - Refresh: Hourly
   - Focus: General AI discussions, news

2. **r/MachineLearning** (2.7M+ members)
   - URL: https://www.reddit.com/r/MachineLearning/.json
   - Method: Reddit API
   - Refresh: Hourly
   - Focus: Research discussions, paper releases

3. **r/singularity** (240K+ members)
   - URL: https://www.reddit.com/r/singularity/.json
   - Method: Reddit API
   - Refresh: Hourly
   - Focus: AGI speculation, breakthroughs

4. **r/LocalLLaMA** (180K+ members)
   - URL: https://www.reddit.com/r/LocalLLaMA/.json
   - Refresh: Daily
   - Focus: Open-source AI, model capabilities

5. **r/ControlProblem** (11K+ members)
   - URL: https://www.reddit.com/r/ControlProblem/.json
   - Refresh: Daily
   - Focus: AI safety, alignment research

**Implementation Details:**
```javascript
// Reddit API approach
const REDDIT_CONFIG = {
  api: 'https://oauth.reddit.com',
  endpoints: [
    '/r/artificial/hot.json',
    '/r/MachineLearning/new.json',
    '/r/singularity/top.json?t=day'
  ],
  auth: 'OAuth 2.0 (Reddit App)',
  rateLimit: '60 requests/minute',
  cost: 'Free tier available',
  fallback: 'Public JSON endpoints (no auth needed)'
};
```

**Filtering Criteria:**
- Minimum upvotes: 50+
- Flair filters: 'Research', 'News', 'Discussion'
- Exclude memes and low-quality posts
- Priority to posts with research paper links

**Volume:** ~500-1,000 relevant posts/day
**Priority:** HIGH

### 2.3 Hacker News

- **URL:** https://news.ycombinator.com/
- **API:** https://github.com/HackerNews/API
- **Method:** Firebase API (real-time)
- **Endpoints:**
  - Top stories: https://hacker-news.firebaseio.com/v0/topstories.json
  - New stories: https://hacker-news.firebaseio.com/v0/newstories.json
  - Item details: https://hacker-news.firebaseio.com/v0/item/{id}.json

**Search Strategy:**
```javascript
// HN keyword monitoring
const HN_KEYWORDS = [
  'AGI', 'GPT-5', 'o3', 'Claude', 'Gemini',
  'breakthrough', 'emergent', 'self-improvement'
];

// Filter by score and comments
const HN_FILTERS = {
  minScore: 100,
  minComments: 20,
  tags: ['ai', 'ml', 'research']
};
```

**Volume:** ~20-50 relevant posts/day
**Refresh:** Hourly
**Priority:** MEDIUM

### 2.4 Discord Servers (Read-Only Monitoring)

**Key Servers:**
1. **EleutherAI Discord**
   - Focus: Open-source AI research
   - Method: Discord bot (read-only)
   - Channels: #research, #announcements

2. **Hugging Face Discord**
   - Focus: Model releases, research
   - Channels: #research-papers, #cool-models

3. **Stability AI Discord**
   - Focus: Open model development

**Note:** Requires Discord bot with read permissions. Legal: Check Discord ToS for scraping policies.

**Priority:** LOW (high implementation complexity, moderate value)

---

## 3. Academic Paper Repositories

### 3.1 Currently Implemented
- arXiv cs.AI (https://arxiv.org/list/cs.AI/recent) ✅

### 3.2 Additional arXiv Categories

1. **arXiv cs.LG** (Machine Learning)
   - URL: https://arxiv.org/list/cs.LG/recent
   - RSS: https://rss.arxiv.org/rss/cs.LG
   - Volume: ~100-150 papers/day
   - Priority: HIGH

2. **arXiv cs.CL** (Computation and Language)
   - URL: https://arxiv.org/list/cs.CL/recent
   - RSS: https://rss.arxiv.org/rss/cs.CL
   - Volume: ~50 papers/day
   - Priority: MEDIUM

3. **arXiv cs.CV** (Computer Vision)
   - URL: https://arxiv.org/list/cs.CV/recent
   - RSS: https://rss.arxiv.org/rss/cs.CV
   - Volume: ~100 papers/day
   - Priority: MEDIUM

4. **arXiv cs.RO** (Robotics)
   - URL: https://arxiv.org/list/cs.RO/recent
   - RSS: https://rss.arxiv.org/rss/cs.RO
   - Volume: ~30 papers/day
   - Priority: LOW

**arXiv API:**
```bash
# Query example
http://export.arxiv.org/api/query?search_query=all:AGI+OR+all:artificial+general+intelligence&start=0&max_results=100
```

### 3.3 Other Preprint Servers

1. **bioRxiv (Neuroscience/Computation)** (https://www.biorxiv.org/)
   - RSS: https://connect.biorxiv.org/biorxiv_xml.php?subject=neuroscience
   - Method: RSS feed
   - Volume: ~20 papers/day (filtered)
   - Priority: LOW
   - Focus: Brain-computer interfaces, neural networks

2. **SSRN (Social Science Research Network)** (https://www.ssrn.com/)
   - API: Institutional access required
   - Focus: Economics of AI, policy
   - Priority: LOW

### 3.4 Academic Databases with APIs

1. **Semantic Scholar** (https://www.semanticscholar.org/)
   - API: https://api.semanticscholar.org/
   - Free tier: 100 requests/5 minutes
   - Paid tier: $1,000/month for 10,000 requests/month
   - Method: RESTful API
   - Priority: HIGH
   - Features:
     - Citation graphs
     - Influential papers
     - Research trends
     - Author networks

**Example Query:**
```javascript
// Semantic Scholar API
const SEMANTIC_SCHOLAR_CONFIG = {
  endpoint: 'https://api.semanticscholar.org/graph/v1/paper/search',
  query: {
    query: 'AGI OR "artificial general intelligence"',
    fields: 'title,abstract,authors,citationCount,influentialCitationCount,year',
    limit: 100,
    year: '2024-'
  }
};
```

2. **OpenAlex** (https://openalex.org/)
   - API: https://docs.openalex.org/
   - Free and open
   - Volume: 250M+ papers
   - Method: RESTful API
   - Priority: HIGH
   - Rate limit: 10 requests/second (polite pool)

**Example:**
```bash
https://api.openalex.org/works?filter=title.search:AGI&per_page=100&sort=cited_by_count:desc
```

3. **CORE (COnnecting REpositories)** (https://core.ac.uk/)
   - API: https://core.ac.uk/services/api
   - Free tier: 1,000 requests/day
   - Volume: 240M+ open access papers
   - Priority: MEDIUM

4. **PubMed (AI in Healthcare/Neuroscience)** (https://pubmed.ncbi.nlm.nih.gov/)
   - API: E-utilities API (free)
   - Method: XML API
   - Priority: LOW
   - Focus: AI in medicine, brain research

### 3.5 Conference Proceedings

1. **NeurIPS (Neural Information Processing Systems)**
   - URL: https://proceedings.neurips.cc/
   - Papers: https://papers.nips.cc/
   - Method: HTML parsing
   - Frequency: Annual (December)
   - Volume: ~2,500 papers/year
   - Priority: HIGH

2. **ICML (International Conference on Machine Learning)**
   - URL: https://icml.cc/
   - Proceedings: https://proceedings.mlr.press/
   - Method: HTML parsing
   - Frequency: Annual (July)
   - Volume: ~1,500 papers/year
   - Priority: HIGH

3. **ICLR (International Conference on Learning Representations)**
   - URL: https://iclr.cc/
   - OpenReview: https://openreview.net/group?id=ICLR.cc
   - Method: OpenReview API
   - Frequency: Annual (May)
   - Volume: ~800 papers/year
   - Priority: HIGH

4. **AAAI (Association for the Advancement of AI)**
   - URL: https://aaai.org/conference/aaai/
   - Library: https://aaai.org/library/
   - Method: HTML parsing
   - Frequency: Annual (February)
   - Priority: MEDIUM

5. **ACL (Association for Computational Linguistics)**
   - URL: https://aclanthology.org/
   - Method: XML/HTML parsing
   - Priority: MEDIUM

**OpenReview API Example:**
```javascript
// OpenReview.net API
const OPENREVIEW_CONFIG = {
  api: 'https://api.openreview.net',
  endpoints: {
    submissions: '/notes?invitation=ICLR.cc/2025/Conference/-/Submission',
    accepted: '/notes?invitation=ICLR.cc/2025/Conference/-/Decision'
  }
};
```

---

## 4. GitHub Repositories & Code Patterns

### 4.1 GitHub API Strategy

**GitHub REST API v3 / GraphQL API v4:**
- Rate limits: 5,000 requests/hour (authenticated)
- Cost: Free for public repos
- Documentation: https://docs.github.com/en/rest

### 4.2 Key Repositories to Monitor

#### AGI Research Frameworks

1. **OpenAI Repositories**
   - openai/gym (RL environments)
   - openai/baselines
   - openai/triton (GPU programming)
   - Monitor: Commits, releases, issues
   - API: https://api.github.com/repos/openai/{repo}

2. **Meta AI Repositories**
   - facebookresearch/llama
   - facebookresearch/segment-anything
   - facebookresearch/fairseq
   - facebookresearch/detectron2

3. **Google/DeepMind Repositories**
   - google-deepmind/alphafold
   - google-deepmind/alphastar
   - google-research/bert
   - tensorflow/tensorflow
   - google/jax

4. **Hugging Face**
   - huggingface/transformers
   - huggingface/diffusers
   - huggingface/accelerate

5. **EleutherAI**
   - EleutherAI/gpt-neo
   - EleutherAI/gpt-j
   - EleutherAI/pythia

#### Search Queries for Novel AGI Projects

```javascript
// GitHub Search API
const GITHUB_SEARCH_QUERIES = [
  'AGI in:readme stars:>50 pushed:>2024-01-01',
  '"artificial general intelligence" language:python stars:>100',
  '"self-improving" OR "recursive improvement" language:python',
  '"emergent capabilities" language:python',
  'world-model OR "world model" language:python stars:>50',
  'autonomous-agent OR "autonomous agent" stars:>100',
  '"chain of thought" language:python pushed:>2024-01-01',
  'reasoning language:python stars:>200 pushed:>2024-06-01'
];

// GitHub GraphQL query for trending repos
const GITHUB_TRENDING = {
  query: `
    query {
      search(query: "AGI OR artificial general intelligence", type: REPOSITORY, first: 100) {
        edges {
          node {
            ... on Repository {
              name
              description
              stargazerCount
              updatedAt
              primaryLanguage { name }
              releases(first: 5) {
                nodes {
                  name
                  publishedAt
                  description
                }
              }
            }
          }
        }
      }
    }
  `
};
```

### 4.3 Monitoring Strategy

**What to Track:**
1. **New Releases:** Major version bumps indicating breakthroughs
2. **Starred Repositories:** Sudden star growth (>500 stars/week)
3. **Issue Discussions:** Keywords like "AGI", "breakthrough", "emergent"
4. **Commit Activity:** Unusual spike in commits from key researchers
5. **Forks:** High fork rate indicates important development

**Implementation:**
```javascript
// GitHub webhook approach
const GITHUB_EVENTS = [
  'release', // New version releases
  'push',    // Code commits
  'issues',  // Issue discussions
  'star'     // Repository stars
];

// Polling approach (fallback)
const POLL_INTERVAL = {
  releases: '6 hours',
  commits: '12 hours',
  stars: '24 hours'
};
```

**Volume:** ~100-500 events/day (filtered)
**Priority:** MEDIUM
**Refresh:** Every 6-12 hours

### 4.4 Code Pattern Analysis (Advanced)

**Tools:**
- GitHub Code Search API
- grep.app (https://grep.app/) - code search engine
- Sourcegraph API (https://sourcegraph.com/)

**Patterns to Detect:**
```python
# Example code patterns indicating AGI research
patterns = [
    "class AGI",
    "def recursive_self_improve",
    "emergent_capability",
    "meta_learning",
    "world_model",
    "autonomous_agent",
    "self_aware",
    "general_intelligence"
]
```

**Priority:** LOW (computationally expensive, requires careful filtering)

---

## 5. Public Datasets Related to AI Behavior Detection

### 5.1 Model Benchmark Datasets

1. **Papers With Code Benchmarks** (https://paperswithcode.com/)
   - API: https://paperswithcode.com/api/v1/docs/
   - Method: RESTful API
   - Focus: SOTA (State of the Art) tracking
   - Volume: 5,000+ benchmarks
   - Priority: HIGH
   - Free tier: 100 requests/hour

**Usage:**
```bash
# API example
curl https://paperswithcode.com/api/v1/papers/?q=AGI
curl https://paperswithcode.com/api/v1/benchmarks/
```

**Key Benchmarks to Monitor:**
- MMLU (Massive Multitask Language Understanding)
- BIG-bench (Beyond the Imitation Game benchmark)
- HELM (Holistic Evaluation of Language Models)
- ARC (AI2 Reasoning Challenge)
- HumanEval (code generation)
- GSM8K (math reasoning)

2. **Hugging Face Datasets Hub** (https://huggingface.co/datasets)
   - API: https://huggingface.co/docs/hub/api
   - Method: RESTful API + Git LFS
   - Volume: 100,000+ datasets
   - Priority: MEDIUM

3. **OpenML** (https://www.openml.org/)
   - API: https://www.openml.org/apis
   - Focus: ML datasets and benchmarks
   - Priority: LOW

### 5.2 AI Safety Datasets

1. **AI Safety Gridworlds** (DeepMind)
   - GitHub: https://github.com/deepmind/ai-safety-gridworlds
   - Focus: Safe RL environments
   - Priority: MEDIUM

2. **Alignment Research Dataset** (LAION)
   - Focus: AI alignment papers and discussions
   - Priority: MEDIUM

3. **AI Incident Database** (https://incidentdatabase.ai/)
   - API: https://incidentdatabase.ai/api
   - Focus: AI failures and risks
   - Volume: 2,000+ incidents
   - Priority: HIGH
   - Method: GraphQL API

**Example Query:**
```graphql
query {
  incidents(limit: 100) {
    title
    description
    date
    AllegedDeployer
    AllegedHarmedParties
  }
}
```

### 5.3 Model Evaluation Platforms

1. **Chatbot Arena (LMSYS)** (https://chat.lmsys.org/)
   - Leaderboard: https://huggingface.co/spaces/lmsys/chatbot-arena-leaderboard
   - Method: Web scraping or API if available
   - Focus: LLM capability rankings
   - Refresh: Weekly
   - Priority: HIGH

2. **Open LLM Leaderboard** (Hugging Face)
   - URL: https://huggingface.co/spaces/HuggingFaceH4/open_llm_leaderboard
   - Method: API/HTML parsing
   - Refresh: Daily
   - Priority: HIGH

3. **AlphaCode/CodeContests Dataset**
   - GitHub: https://github.com/google-deepmind/code_contests
   - Focus: Coding capabilities
   - Priority: MEDIUM

### 5.4 LLM Performance Tracking

**LLM Tracker Sites:**
- https://llm.extractum.io/ (performance tracking)
- https://artificialanalysis.ai/ (benchmarks)
- https://www.vellum.ai/llm-leaderboard

**Scraping Strategy:**
- Method: Playwright/Puppeteer (JavaScript-heavy)
- Refresh: Weekly
- Priority: MEDIUM

---

## 6. Web Scraping Tools & Libraries

### 6.1 Currently Implemented ✅

1. **Cheerio** (v1.0.0)
   - Type: HTML parsing
   - Use case: Static HTML pages
   - Pros: Fast, lightweight, jQuery-like syntax
   - Cons: No JavaScript execution

2. **Axios** (v1.7.9)
   - Type: HTTP client
   - Use case: API requests, HTML fetching
   - Pros: Promise-based, interceptors, timeout handling
   - Cons: No browser emulation

3. **Playwright** (v1.52.0)
   - Type: Browser automation
   - Use case: JavaScript-heavy sites, anti-bot bypass
   - Pros: Full browser, stealth mode, screenshot capability
   - Cons: Resource-intensive, slower

4. **xml2js** (v0.6.2)
   - Type: XML parsing
   - Use case: RSS feeds, XML APIs
   - Pros: Simple, reliable
   - Cons: Limited to XML

5. **Firecrawl API** (@mendable/firecrawl-js v1.21.1)
   - Type: Professional scraping service
   - Use case: Heavily protected sites (DeepMind, Anthropic)
   - Pros: Bypasses most anti-bot, handles JavaScript
   - Cons: Paid service, rate limits
   - Cost: $20-150/month

### 6.2 Recommended Additional Tools

#### For Enhanced Scraping

1. **Puppeteer Extra + Stealth Plugin**
   ```bash
   npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth
   ```
   - Purpose: Better anti-detection than vanilla Playwright
   - Use case: Sites with Cloudflare, Akamai
   - Features:
     - Fingerprint randomization
     - WebGL vendor spoofing
     - Chrome DevTools Protocol hiding

2. **crawlee** (by Apify)
   ```bash
   npm install crawlee
   ```
   - Purpose: Production-ready web crawling framework
   - Features:
     - Built-in request queue
     - Automatic retries
     - Rate limiting
     - Proxy rotation
     - Session management
   - Pros: Battle-tested, scales well
   - Priority: MEDIUM

3. **got** (Alternative to Axios)
   ```bash
   npm install got
   ```
   - Purpose: Advanced HTTP client
   - Features:
     - HTTP/2 support
     - Retry logic
     - Better timeout handling
     - Stream support
   - Priority: LOW (Axios is sufficient)

#### For API Integration

4. **feedparser** or **rss-parser**
   ```bash
   npm install rss-parser
   ```
   - Purpose: RSS/Atom feed parsing
   - Features: Better than xml2js for feeds
   - Use case: RSS-heavy strategy
   - Priority: HIGH

5. **turndown**
   ```bash
   npm install turndown
   ```
   - Purpose: HTML to Markdown conversion
   - Use case: Better content extraction, LLM-friendly format
   - Priority: MEDIUM

#### For Data Processing

6. **node-nlp** or **compromise**
   ```bash
   npm install compromise
   ```
   - Purpose: NLP pre-processing
   - Use case: Extract key entities, topics before GPT analysis
   - Priority: LOW (GPT handles this)

7. **p-queue**
   ```bash
   npm install p-queue
   ```
   - Purpose: Promise queue with concurrency control
   - Use case: Better rate limiting than current implementation
   - Priority: MEDIUM

#### For Anti-Bot Bypass

8. **cloudscraper**
   ```bash
   npm install cloudscraper
   ```
   - Purpose: Cloudflare bypass
   - Use case: Sites with Cloudflare protection
   - Priority: MEDIUM

9. **proxy-chain**
   ```bash
   npm install proxy-chain
   ```
   - Purpose: Proxy rotation and management
   - Use case: Avoid IP bans
   - Priority: LOW (unless scaling)

#### For Social Media

10. **twitter-api-v2**
    ```bash
    npm install twitter-api-v2
    ```
    - Purpose: Official Twitter API client
    - Cost: $100+/month for API access
    - Priority: HIGH (if implementing Twitter)

11. **snoowrap** (Reddit API)
    ```bash
    npm install snoowrap
    ```
    - Purpose: Reddit API wrapper
    - Cost: Free
    - Priority: HIGH

12. **@octokit/rest** (GitHub API)
    ```bash
    npm install @octokit/rest
    ```
    - Purpose: GitHub API client
    - Already compatible with current stack
    - Priority: HIGH

### 6.3 Infrastructure Tools

1. **BullMQ** (Job Queue)
   ```bash
   npm install bullmq
   ```
   - Purpose: Redis-based job queue
   - Use case: Scheduled crawls, background processing
   - Priority: MEDIUM

2. **winston** (Logging)
   ```bash
   npm install winston
   ```
   - Purpose: Advanced logging
   - Use case: Better monitoring, debugging
   - Priority: MEDIUM

3. **node-cache** or **ioredis**
   ```bash
   npm install node-cache
   ```
   - Purpose: In-memory caching
   - Use case: Reduce redundant crawls
   - Priority: MEDIUM (already have Brave cache logic)

---

## 7. Ethical and Legal Implications

### 7.1 Legal Considerations

#### Robots.txt Compliance
**Current Status:** Partially implemented via proxy configuration
**Recommendation:** Explicit robots.txt parser

```javascript
// Implement robots.txt checker
import robotsParser from 'robots-parser';

async function checkRobotsPermission(url) {
  const robotsUrl = new URL('/robots.txt', url).href;
  const robotsTxt = await fetch(robotsUrl).then(r => r.text());
  const robots = robotsParser(robotsUrl, robotsTxt);
  return robots.isAllowed(url, 'AGI-Detector-Bot');
}
```

**Sources Requiring Caution:**
- Twitter/X: ToS prohibits scraping (use official API only)
- Reddit: Prefers API usage, JSON endpoints tolerated
- LinkedIn: Strictly prohibits scraping
- Facebook: Prohibits scraping

#### Terms of Service (ToS) Review

**Green Light (Explicitly Allowed):**
- arXiv: Allows automated access, provides API
- Hugging Face: Open platform, encourages programmatic access
- GitHub: API provided for automation
- OpenAlex: Open database
- Papers With Code: API provided

**Yellow Light (Use Official APIs):**
- Twitter/X: Use API only ($100+/month)
- Reddit: Use API (free tier available)
- Hacker News: Firebase API provided (free)
- OpenReview: API available

**Red Light (Prohibited or Risky):**
- LinkedIn: No scraping allowed
- Instagram: No scraping allowed
- Private Discord servers without permission
- Paywalled content (IEEE, ACM without subscription)

#### Copyright Considerations

**Fair Use Analysis:**
- Purpose: Research and monitoring (✓ transformative)
- Amount: Titles, abstracts, metadata only (✓ minimal)
- Effect on market: No commercial competition (✓ acceptable)
- Nature: Factual information (✓ acceptable)

**Best Practices:**
1. Store only metadata (title, URL, summary)
2. Do not republish full article content
3. Attribute sources properly
4. Provide links back to originals
5. Respect paywalls (don't bypass)

#### GDPR & Privacy

**Considerations:**
- Public posts: Generally acceptable to process
- Personal data: Avoid collecting emails, names unnecessarily
- Right to be forgotten: Implement deletion mechanism
- Data minimization: Only collect what's needed

**Recommendation:**
- Focus on organizational accounts, not individuals
- Allow opt-out mechanism
- Store data in EU (if targeting EU users)

### 7.2 Ethical Considerations

#### Rate Limiting & Server Respect

**Current Implementation:** ✅ 2-5 second delays
**Recommendation:** Adaptive rate limiting

```javascript
// Adaptive rate limiter
const RATE_LIMITS = {
  'openai.com': { requestsPerMinute: 10, delay: 6000 },
  'arxiv.org': { requestsPerMinute: 30, delay: 2000 },
  'twitter.com': { requestsPerMinute: 60, delay: 1000 }, // API
  'reddit.com': { requestsPerMinute: 60, delay: 1000 },  // API
  'github.com': { requestsPerMinute: 60, delay: 1000 },  // API
  default: { requestsPerMinute: 20, delay: 3000 }
};
```

**Best Practices:**
1. Crawl during off-peak hours (midnight-6am PST)
2. Implement exponential backoff on errors
3. Honor 429 (Too Many Requests) responses
4. Use caching aggressively (24h for most sources)
5. Identify bot with user agent: `AGI-Detector-Bot/1.0 (+https://github.com/bencium/agi-detector)`

#### Attribution & Transparency

**Requirements:**
1. User-Agent header identifying the bot
2. Contact information in bot signature
3. robots.txt compliance
4. Public documentation of what we crawl

**Example User-Agent:**
```
User-Agent: AGI-Detector-Bot/1.0 (+https://github.com/bencium/agi-detector; research@bencium.io)
```

#### Misinformation & Bias

**Risks:**
- False positives: Hype labeled as AGI breakthrough
- Echo chambers: Reddit/Twitter amplify certain narratives
- Research preprints: Not peer-reviewed

**Mitigation:**
1. Multiple source verification
2. Weighted scoring (academic sources > social media)
3. Peer review status tracking
4. Sentiment analysis to detect hype vs. fact
5. Expert verification for critical findings

#### Impact on Researchers

**Considerations:**
- Don't overwhelm small research labs' servers
- Don't scrape unpublished work from private repos
- Respect embargo periods on papers
- Don't amplify premature or speculative research

**Example: Embargo Handling**
```javascript
// Check publication date
if (paper.publishDate > Date.now()) {
  console.log('Paper under embargo, skipping');
  return;
}
```

### 7.3 Compliance Checklist

**Before Adding New Source:**
- [ ] Read robots.txt
- [ ] Review Terms of Service
- [ ] Check if API is available (prefer API over scraping)
- [ ] Implement appropriate rate limiting
- [ ] Set respectful User-Agent
- [ ] Test on small scale first
- [ ] Monitor for 429/403 responses
- [ ] Implement caching
- [ ] Document source in code
- [ ] Add to attribution page

---

## 8. Data Volume & Refresh Frequency

### 8.1 Current Volumes (7 sources)

| Source | Articles | Refresh | Status |
|--------|----------|---------|--------|
| OpenAI Blog | ~500 | Daily | ✅ |
| DeepMind Research | ~100 | Daily | ✅ |
| Anthropic Blog | 3+ | Daily | ✅ |
| Microsoft AI Blog | ~30 | Daily | ✅ |
| TechCrunch AI | ~60 | Daily | ✅ |
| VentureBeat AI | ~90 | Daily | ✅ |
| arXiv AI | ~200 | Daily | ✅ |
| **Total** | **~983** | **Daily** | **Working** |

### 8.2 Projected Volumes (Phase 1: +15 sources)

| Category | Sources | Est. Articles/Day | Refresh | Priority |
|----------|---------|-------------------|---------|----------|
| **AI Lab Blogs** | 7 new labs | 200-300 | Daily | HIGH |
| **Social Media** | Twitter, Reddit, HN | 1,000-3,000 | Hourly | HIGH |
| **Academic** | arXiv (3 cats), Semantic Scholar | 300-500 | Daily | HIGH |
| **Leaderboards** | LMSYS, Hugging Face | 10-20 | Weekly | MEDIUM |
| **GitHub** | Trending repos, releases | 50-100 | 6-hourly | MEDIUM |
| **Conference** | OpenReview, NeurIPS | 50-100 | Weekly | MEDIUM |
| **Safety** | AI Incident DB, Alignment Forum | 30-50 | Daily | HIGH |
| **Phase 1 Total** | **~25 sources** | **1,640-4,070/day** | **Mixed** | - |

### 8.3 Refresh Strategy by Source Type

#### Real-time Sources (Hourly Refresh)
- Twitter/X API (keyword monitoring)
- Reddit hot/new (API polling)
- Hacker News Firebase API
- GitHub webhook events (if implemented)

**Volume:** ~1,000-3,000 items/day
**Implementation:** Cron job every hour, filter aggressively

#### Daily Sources (Midnight UTC)
- AI lab blogs (RSS feeds)
- arXiv preprints (RSS/API)
- News sites (RSS feeds)
- Semantic Scholar (API)
- AI Incident Database

**Volume:** ~500-800 items/day
**Implementation:** Cron job at 00:00 UTC

#### Weekly Sources (Sunday Midnight)
- Conference proceedings
- Leaderboard updates
- GitHub trending (weekly summary)
- Newsletter archives

**Volume:** ~100-200 items/week
**Implementation:** Cron job on Sundays

#### On-Demand Sources
- Specific paper lookups
- Manual verification
- User-submitted URLs

### 8.4 Database Scaling Considerations

**Current Schema (Prisma):**
```prisma
model CrawlResult {
  id        String   @id @default(cuid())
  title     String
  content   String   @db.Text
  url       String
  source    String
  timestamp DateTime @default(now())

  // Add indexes for scaling
  @@index([source, timestamp])
  @@index([timestamp])
}
```

**Projected Storage:**
- Current: ~1,000 articles = ~10MB/day
- Phase 1: ~2,000 articles/day = ~20MB/day
- Monthly: ~600MB
- Yearly: ~7GB

**PostgreSQL Optimization:**
```sql
-- Create indexes
CREATE INDEX idx_crawl_timestamp ON "CrawlResult" (timestamp DESC);
CREATE INDEX idx_crawl_source ON "CrawlResult" (source);
CREATE INDEX idx_analysis_severity ON "AnalysisResult" (severity);

-- Partition by month (optional, for scaling)
CREATE TABLE crawl_result_2025_11 PARTITION OF "CrawlResult"
FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
```

**Neon Database Limits:**
- Free tier: 3GB storage ❌ (will exceed)
- Recommendation: Upgrade to Pro ($20/month, 10GB)

### 8.5 API Cost Projections

#### OpenAI API (GPT-5-mini)
**Current Usage:**
- ~1,000 articles/day
- ~500 tokens per analysis (title + content summary)
- Cost: ~$0.001 per analysis
- Daily: $1
- Monthly: ~$30

**Projected (Phase 1):**
- ~2,000 articles/day
- Monthly: ~$60

**Projected (Phase 2 with Social Media):**
- ~5,000 items/day (with filtering)
- Monthly: ~$150

**Optimization:**
- Use GPT-4o-mini for low-priority sources ($0.15/1M input tokens)
- Use GPT-5-mini for high-priority only
- Pre-filter with keywords before GPT analysis

#### Twitter API
- Basic tier: $100/month (10K tweets/month) ❌ Insufficient
- Pro tier: $5,000/month (1M tweets/month) ❌ Too expensive
- **Recommendation:** Start without Twitter, evaluate later

#### Reddit API
- Free tier: 100 requests/minute ✅
- Cost: $0

#### GitHub API
- Free tier: 5,000 requests/hour ✅
- Cost: $0

#### Firecrawl API
- Current: 500 credits/month (free) = $0
- Hobby: $20/month (10K credits)
- Growth: $150/month (100K credits)
- **Current usage:** ~5 requests/day = 150/month ✅ Free tier OK

#### Semantic Scholar API
- Free tier: 100 requests/5min = 28,800/day ✅
- Cost: $0

**Total Monthly API Costs (Phase 1):**
- OpenAI: $60-150
- Firecrawl: $0 (currently) or $20 (if scaling)
- Twitter: $0 (skip for now)
- Others: $0 (free tiers)
- **Total: $60-170/month**

### 8.6 Infrastructure Costs

**Database:**
- Neon Pro: $20/month (10GB)

**Optional:**
- Redis (caching): $0 (Railway free tier) or $10/month
- Queue system: $0 (in-process) or $15/month (CloudAMQP)

**Total Infrastructure: $20-45/month**

**Grand Total (Phase 1): $80-215/month**

---

## 9. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)

**Goals:**
- Add 7 new AI lab blogs
- Implement Reddit scraping
- Add Hacker News monitoring
- Expand arXiv coverage

**Tasks:**
1. **Week 1: AI Lab Blogs**
   - Add RSS feeds for Meta AI, Google AI, Hugging Face
   - Test Stability AI, Cohere, Mistral scraping
   - Implement AI Alignment Forum
   - Add 3 arXiv categories (cs.LG, cs.CL, cs.CV)

2. **Week 2: Social & News**
   - Reddit API integration (5 subreddits)
   - Hacker News Firebase API
   - LessWrong RSS feed
   - The Gradient RSS feed

**Deliverables:**
- +15 sources operational
- ~2,000 articles/day
- Unified crawling architecture
- Updated database schema

**Success Metrics:**
- 90%+ uptime for all sources
- <5% duplicate articles
- All sources refreshing on schedule

### Phase 2: Academic & Research (Weeks 3-4)

**Goals:**
- Integrate academic databases
- Add conference proceedings
- Implement GitHub monitoring

**Tasks:**
1. **Week 3: Academic APIs**
   - Semantic Scholar API integration
   - OpenAlex API integration
   - OpenReview scraping (ICLR, NeurIPS)
   - Papers With Code API

2. **Week 4: GitHub & Code**
   - GitHub API (@octokit/rest)
   - Repository monitoring (20 key repos)
   - Release notifications
   - Trending search queries

**Deliverables:**
- Academic paper search capability
- Conference paper monitoring
- GitHub activity tracking
- Citation graph analysis (Semantic Scholar)

### Phase 3: Advanced Features (Weeks 5-6)

**Goals:**
- Leaderboard tracking
- Advanced filtering
- Deduplication system
- Notification system

**Tasks:**
1. **Week 5: Data Quality**
   - Implement deduplication (title similarity)
   - Content-based filtering
   - Source reliability scoring
   - Automated quality checks

2. **Week 6: Monitoring & Alerts**
   - Leaderboard scraping (LMSYS, Open LLM)
   - Real-time alert system
   - Email/webhook notifications
   - Dashboard improvements

**Deliverables:**
- Deduplication system (90%+ accuracy)
- Source quality scores
- Real-time notifications
- Comprehensive dashboard

### Phase 4: Optional - Social Media Deep Dive (Future)

**Goals:**
- Twitter/X integration (if budget allows)
- Discord monitoring
- Advanced NLP pre-filtering

**Requirements:**
- Budget approval ($100+/month for Twitter API)
- Discord bot permissions
- Advanced filtering to reduce GPT costs

**Decision Point:** Evaluate after Phase 3 based on:
- ROI of current sources
- Budget availability
- User feedback

---

## 10. Technical Implementation Details

### 10.1 Proposed Architecture Updates

#### Current Architecture
```
Next.js API Routes
    ↓
crawler.ts (basic) → advanced-crawler.ts (RSS/Firecrawl/Playwright)
    ↓
PostgreSQL (Prisma)
    ↓
OpenAI GPT-5-mini Analysis
```

#### Proposed Enhanced Architecture
```
Scheduler (node-cron)
    ↓
Source Router (by type: RSS, API, HTML, Social)
    ↓
    ├─ RSS Parser (rss-parser)
    ├─ API Clients (Twitter, Reddit, GitHub, Semantic Scholar)
    ├─ HTML Scraper (Cheerio + Playwright fallback)
    └─ Firecrawl (protected sites)
    ↓
Content Normalizer (unified format)
    ↓
Deduplication Layer (title + URL hashing)
    ↓
Pre-filter (keyword matching, source scoring)
    ↓
Queue System (BullMQ - optional)
    ↓
OpenAI Analysis (batched, with priority levels)
    ↓
PostgreSQL (indexed, partitioned)
    ↓
Notification Engine (webhooks, email)
```

### 10.2 Code Structure Proposal

```
src/lib/
├── crawlers/
│   ├── base-crawler.ts          // Abstract base class
│   ├── rss-crawler.ts            // RSS feeds (most sources)
│   ├── api-crawler.ts            // API-based (Twitter, Reddit, GitHub)
│   ├── html-crawler.ts           // Cheerio-based
│   ├── browser-crawler.ts        // Playwright
│   └── firecrawl-crawler.ts      // Firecrawl service
├── sources/
│   ├── ai-labs.ts                // Research lab configs
│   ├── news-sites.ts             // News sources
│   ├── academic.ts               // arXiv, Semantic Scholar
│   ├── social-media.ts           // Reddit, HN, Twitter
│   ├── github.ts                 // GitHub repos
│   └── leaderboards.ts           // LMSYS, Papers With Code
├── processors/
│   ├── normalizer.ts             // Unified content format
│   ├── deduplicator.ts           // Remove duplicates
│   ├── filter.ts                 // Pre-GPT filtering
│   └── scorer.ts                 // Source quality scores
├── scheduler/
│   └── cron-jobs.ts              // Scheduled tasks
└── notifications/
    ├── webhook.ts                // Webhook alerts
    └── email.ts                  // Email alerts
```

### 10.3 Database Schema Updates

```prisma
// Enhanced schema
model CrawlResult {
  id          String   @id @default(cuid())
  title       String
  content     String   @db.Text
  url         String   @unique  // Prevent duplicate URLs
  source      String
  sourceType  String   // 'blog', 'paper', 'social', 'code'
  timestamp   DateTime @default(now())
  publishDate DateTime?
  author      String?
  tags        String[]
  score       Float?   // Source quality score

  analysis    AnalysisResult?

  @@index([source, timestamp])
  @@index([timestamp(sort: Desc)])
  @@index([sourceType])
  @@index([publishDate])
}

model SourceReliability {
  id           String   @id @default(cuid())
  sourceName   String   @unique
  reliability  Float    // 0.0-1.0
  falsePositives Int    @default(0)
  truePositives  Int    @default(0)
  lastUpdated  DateTime @default(now())
}

model GitHubActivity {
  id          String   @id @default(cuid())
  repoName    String
  eventType   String   // 'release', 'commit', 'star'
  description String
  url         String
  stars       Int?
  timestamp   DateTime @default(now())

  @@index([repoName, timestamp])
}

model LeaderboardSnapshot {
  id         String   @id @default(cuid())
  source     String   // 'lmsys', 'openllm'
  modelName  String
  score      Float
  rank       Int
  timestamp  DateTime @default(now())

  @@index([source, timestamp])
  @@index([modelName])
}
```

### 10.4 Example Implementation: Reddit Scraper

```typescript
// src/lib/crawlers/reddit-crawler.ts
import Snoowrap from 'snoowrap';

interface RedditConfig {
  clientId: string;
  clientSecret: string;
  userAgent: string;
  username: string;
  password: string;
}

export class RedditCrawler {
  private reddit: Snoowrap;

  constructor(config: RedditConfig) {
    this.reddit = new Snoowrap({
      userAgent: config.userAgent,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      username: config.username,
      password: config.password
    });
  }

  async crawlSubreddit(
    subreddit: string,
    options: {
      limit?: number;
      minScore?: number;
      timeFilter?: 'hour' | 'day' | 'week' | 'month' | 'year';
    } = {}
  ) {
    const { limit = 100, minScore = 50, timeFilter = 'day' } = options;

    const posts = await this.reddit
      .getSubreddit(subreddit)
      .getTop({ time: timeFilter, limit });

    return posts
      .filter(post => post.score >= minScore)
      .map(post => ({
        title: post.title,
        content: post.selftext || post.url,
        url: `https://reddit.com${post.permalink}`,
        author: post.author.name,
        score: post.score,
        comments: post.num_comments,
        timestamp: new Date(post.created_utc * 1000),
        metadata: {
          source: `r/${subreddit}`,
          sourceType: 'social',
          flair: post.link_flair_text,
          awards: post.total_awards_received
        }
      }));
  }

  async crawlMultipleSubreddits(subreddits: string[]) {
    const results = await Promise.allSettled(
      subreddits.map(sub => this.crawlSubreddit(sub))
    );

    return results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .flatMap(r => r.value);
  }
}

// Usage in src/app/api/crawl/route.ts
const REDDIT_SUBREDDITS = [
  'artificial',
  'MachineLearning',
  'singularity',
  'LocalLLaMA',
  'ControlProblem'
];

const redditCrawler = new RedditCrawler({
  clientId: process.env.REDDIT_CLIENT_ID!,
  clientSecret: process.env.REDDIT_CLIENT_SECRET!,
  userAgent: 'AGI-Detector-Bot/1.0',
  username: process.env.REDDIT_USERNAME!,
  password: process.env.REDDIT_PASSWORD!
});

const redditPosts = await redditCrawler.crawlMultipleSubreddits(REDDIT_SUBREDDITS);
```

### 10.5 Example: GitHub Monitoring

```typescript
// src/lib/crawlers/github-crawler.ts
import { Octokit } from '@octokit/rest';

export class GitHubCrawler {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async monitorRepository(owner: string, repo: string) {
    // Get latest releases
    const { data: releases } = await this.octokit.repos.listReleases({
      owner,
      repo,
      per_page: 5
    });

    // Get recent commits
    const { data: commits } = await this.octokit.repos.listCommits({
      owner,
      repo,
      per_page: 10
    });

    // Get repository stats
    const { data: repoData } = await this.octokit.repos.get({
      owner,
      repo
    });

    return {
      releases: releases.map(r => ({
        name: r.name,
        tag: r.tag_name,
        description: r.body,
        publishedAt: r.published_at,
        url: r.html_url
      })),
      commits: commits.map(c => ({
        message: c.commit.message,
        author: c.commit.author?.name,
        date: c.commit.author?.date,
        sha: c.sha
      })),
      stats: {
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        watchers: repoData.watchers_count,
        openIssues: repoData.open_issues_count
      }
    };
  }

  async searchRepositories(query: string) {
    const { data } = await this.octokit.search.repos({
      q: query,
      sort: 'stars',
      order: 'desc',
      per_page: 50
    });

    return data.items.map(repo => ({
      name: repo.full_name,
      description: repo.description,
      stars: repo.stargazers_count,
      language: repo.language,
      url: repo.html_url,
      updatedAt: repo.updated_at
    }));
  }
}

// Search queries
const AGI_SEARCH_QUERIES = [
  'AGI stars:>50',
  '"artificial general intelligence" language:python',
  'autonomous agent stars:>100 pushed:>2024-01-01'
];
```

### 10.6 Deduplication Strategy

```typescript
// src/lib/processors/deduplicator.ts
import crypto from 'crypto';

interface Article {
  title: string;
  url: string;
  content: string;
}

export class Deduplicator {
  private seenHashes = new Set<string>();

  // Method 1: URL-based (exact duplicates)
  private getUrlHash(url: string): string {
    return crypto.createHash('md5').update(url).digest('hex');
  }

  // Method 2: Title similarity (fuzzy)
  private getTitleHash(title: string): string {
    // Normalize: lowercase, remove punctuation, trim
    const normalized = title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .trim();
    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  // Method 3: Levenshtein distance for title similarity
  private levenshteinDistance(a: string, b: string): number {
    const matrix = Array(b.length + 1).fill(null).map(() =>
      Array(a.length + 1).fill(null)
    );

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[b.length][a.length];
  }

  private titleSimilarity(title1: string, title2: string): number {
    const distance = this.levenshteinDistance(title1, title2);
    const maxLength = Math.max(title1.length, title2.length);
    return 1 - distance / maxLength;
  }

  isDuplicate(article: Article, threshold: number = 0.85): boolean {
    // Check exact URL match
    const urlHash = this.getUrlHash(article.url);
    if (this.seenHashes.has(urlHash)) {
      return true;
    }

    // Check title similarity
    const titleHash = this.getTitleHash(article.title);
    if (this.seenHashes.has(titleHash)) {
      return true;
    }

    // Store hashes
    this.seenHashes.add(urlHash);
    this.seenHashes.add(titleHash);

    return false;
  }

  // Database-based deduplication
  async checkDatabaseDuplicates(
    article: Article,
    prisma: any
  ): Promise<boolean> {
    // Check URL
    const urlMatch = await prisma.crawlResult.findFirst({
      where: { url: article.url }
    });
    if (urlMatch) return true;

    // Check title similarity (requires full scan - slow)
    const recentArticles = await prisma.crawlResult.findMany({
      where: {
        timestamp: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      select: { title: true }
    });

    for (const existing of recentArticles) {
      if (this.titleSimilarity(article.title, existing.title) > 0.85) {
        return true;
      }
    }

    return false;
  }
}
```

### 10.7 Scheduler Implementation

```typescript
// src/lib/scheduler/cron-jobs.ts
import cron from 'node-cron';
import { crawlAllSources } from '@/lib/crawler';
import { crawlReddit } from '@/lib/crawlers/reddit-crawler';
import { crawlGitHub } from '@/lib/crawlers/github-crawler';

export function initScheduler() {
  // Daily crawl at midnight UTC
  cron.schedule('0 0 * * *', async () => {
    console.log('[Scheduler] Running daily crawl...');
    await crawlAllSources(); // Existing sources
  });

  // Hourly Reddit crawl
  cron.schedule('0 * * * *', async () => {
    console.log('[Scheduler] Running hourly Reddit crawl...');
    await crawlReddit();
  });

  // GitHub monitoring every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('[Scheduler] Running GitHub monitoring...');
    await crawlGitHub();
  });

  // Weekly leaderboard update (Sundays at 00:00)
  cron.schedule('0 0 * * 0', async () => {
    console.log('[Scheduler] Running weekly leaderboard update...');
    await updateLeaderboards();
  });

  console.log('[Scheduler] All cron jobs initialized');
}
```

---

## 11. Risk Mitigation

### 11.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| API rate limits | High | Medium | Implement caching, respect limits, use multiple tiers |
| IP bans | Medium | High | Proxy rotation, respectful crawling, API preference |
| Site structure changes | High | Medium | Automated tests, fallback methods, versioned selectors |
| Database overflow | Medium | Medium | Partitioning, archiving, storage monitoring |
| Cost overrun | Medium | High | Budget alerts, tiered processing, GPT-4o-mini for bulk |
| API key exposure | Low | Critical | Environment variables, .gitignore, key rotation |

### 11.2 Legal Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| ToS violation | Medium | High | Prefer APIs, read ToS, legal review |
| Copyright claims | Low | Medium | Store metadata only, fair use, attribution |
| GDPR complaints | Low | Medium | Minimal data, public data only, deletion mechanism |
| Cease & desist | Low | High | Immediate compliance, legal consultation |

### 11.3 Quality Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| False positives (hype as AGI) | High | High | Multi-source verification, weighted scoring |
| Duplicate content | High | Low | Deduplication system, URL tracking |
| Low-quality sources | Medium | Medium | Source reliability scoring, manual review |
| Outdated information | Medium | Low | Timestamp tracking, refresh schedules |
| Misinformation amplification | Medium | High | Peer review status, source reputation, fact-checking |

---

## 12. Success Metrics

### 12.1 Coverage Metrics
- **Goal:** 40+ sources by end of Phase 3
- **Measurement:** Active sources count, articles/day
- **Target:** 2,000+ relevant articles/day

### 12.2 Quality Metrics
- **Deduplication Rate:** >90%
- **False Positive Rate:** <10% (manual audit of 100 samples/month)
- **Source Uptime:** >95% for all sources
- **API Success Rate:** >98%

### 12.3 Performance Metrics
- **Crawl Latency:** <30 minutes for full daily crawl
- **Database Query Time:** <500ms for dashboard load
- **Analysis Latency:** <2 minutes for batch of 50 articles

### 12.4 Cost Metrics
- **Monthly Budget:** $150-300
- **Cost per Article:** <$0.05
- **ROI:** High-priority findings justify cost

---

## 13. Next Steps & Recommendations

### Immediate Actions (Week 1)

1. **Set up Reddit API credentials**
   - Create Reddit app at https://www.reddit.com/prefs/apps
   - Get client ID and secret
   - Test with r/MachineLearning

2. **Install additional dependencies**
   ```bash
   npm install snoowrap @octokit/rest rss-parser
   ```

3. **Expand arXiv coverage**
   - Add cs.LG, cs.CL RSS feeds (quick win)
   - Update SOURCES configuration

4. **Implement basic deduplication**
   - URL-based deduplication first
   - Add unique constraint to database

### Short-term Priorities (Weeks 2-4)

1. **Add 7 new AI lab blogs** (high-value, low-complexity)
2. **Reddit integration** (5 subreddits)
3. **Hacker News API** (easy implementation)
4. **GitHub monitoring** (20 key repositories)
5. **Semantic Scholar API** (academic search)

### Long-term Considerations (Months 2-3)

1. **Evaluate Twitter API** (wait for ROI data from other sources)
2. **Conference proceedings** (timing-dependent)
3. **Advanced NLP pre-filtering** (cost optimization)
4. **Machine learning for false positive reduction**

### Decision Points

**After Phase 1 (Week 2):**
- Evaluate data quality and volume
- Assess GPT analysis costs
- Decide on Phase 2 scope

**After Phase 2 (Week 4):**
- Review budget and ROI
- User feedback on findings
- Decide on Twitter API investment

**After Phase 3 (Week 6):**
- Long-term sustainability assessment
- Potential monetization strategy
- Community contributions

---

## 14. Conclusion

This comprehensive data scraping strategy expands the AGI Detector from 7 sources to 40+ sources, increasing daily article volume from ~1,000 to ~2,000-5,000. The phased approach allows for:

1. **Incremental value delivery:** Each phase adds meaningful capabilities
2. **Cost control:** Start with free/low-cost sources, evaluate ROI before expensive APIs
3. **Risk mitigation:** Legal and ethical compliance built-in from the start
4. **Scalability:** Architecture supports future growth

**Key Success Factors:**
- Prefer APIs over scraping (legal safety, reliability)
- Implement aggressive caching (cost reduction)
- Multi-source verification (quality assurance)
- Respectful crawling (ethical compliance)
- Continuous monitoring (early warning for issues)

**Estimated Timeline:** 6 weeks for full implementation
**Estimated Cost:** $80-215/month (sustainable for research project)
**Expected Outcome:** Comprehensive, reliable, legally compliant AGI monitoring system

---

## Appendix A: Environment Variables

```bash
# .env.local additions

# === Existing ===
DATABASE_URL="postgresql://..."
API_KEY="sk-..."
FIRECRAWL_API_KEY="fc-..."
BRAVE_API_KEY="bs-..."

# === New for Phase 1 ===

# Reddit API
REDDIT_CLIENT_ID="your_client_id"
REDDIT_CLIENT_SECRET="your_client_secret"
REDDIT_USERNAME="your_bot_username"
REDDIT_PASSWORD="your_bot_password"

# GitHub API
GITHUB_TOKEN="ghp_your_token"

# Semantic Scholar API (optional, has free tier)
SEMANTIC_SCHOLAR_API_KEY="your_api_key"

# === Optional for Phase 2+ ===

# Twitter API (Pro tier)
TWITTER_API_KEY="your_api_key"
TWITTER_API_SECRET="your_api_secret"
TWITTER_BEARER_TOKEN="your_bearer_token"

# Papers With Code API
PAPERS_WITH_CODE_API_KEY="your_api_key"

# Proxy (if needed for scaling)
PROXY_URL="http://your-proxy:port"
PROXY_USERNAME="username"
PROXY_PASSWORD="password"

# Rate limiting overrides
CRAWL_DELAY_MS="3000"  # Default delay between requests
MAX_CONCURRENT_CRAWLS="5"  # Parallel crawl limit

# Feature flags
ENABLE_REDDIT="true"
ENABLE_GITHUB="true"
ENABLE_TWITTER="false"
ENABLE_DEDUPLICATION="true"
```

---

## Appendix B: Useful Links

**APIs & Documentation:**
- Reddit API: https://www.reddit.com/dev/api/
- GitHub API: https://docs.github.com/en/rest
- Semantic Scholar API: https://api.semanticscholar.org/
- OpenAlex API: https://docs.openalex.org/
- arXiv API: https://info.arxiv.org/help/api/index.html
- Hacker News API: https://github.com/HackerNews/API
- OpenReview API: https://docs.openreview.net/reference/api-v2/restful-api

**Tools:**
- Puppeteer Stealth: https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth
- Crawlee: https://crawlee.dev/
- rss-parser: https://www.npmjs.com/package/rss-parser
- Snoowrap: https://not-an-aardvark.github.io/snoowrap/
- Octokit: https://octokit.github.io/rest.js/

**Legal Resources:**
- robots.txt spec: https://www.robotstxt.org/
- GDPR compliance: https://gdpr.eu/
- Fair use guidelines: https://www.copyright.gov/fair-use/

**Best Practices:**
- Scraping best practices: https://www.scrapehero.com/web-scraping-best-practices/
- Ethical web scraping: https://towardsdatascience.com/ethics-in-web-scraping-b96b18136f01

---

**Document Version:** 1.0
**Last Updated:** 2025-11-17
**Next Review:** 2025-12-01
**Owner:** AGI Detector Development Team
**Status:** Ready for Implementation
