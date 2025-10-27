# AGI Detector 🧠

[![Build Status](https://img.shields.io/badge/build-in%20progress-yellow)](https://github.com/bencium/agi-detector)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

An advanced monitoring system designed to detect early signs of Artificial General Intelligence (AGI) emergence by analyzing patterns across AI research labs, academic papers, and technology news.

## 🎯 Project Vision

A sophisticated early-warning system that monitors the AI landscape for genuine indicators of AGI development, distinguishing between normal AI progress and potentially groundbreaking developments that could signal the emergence of AGI.

**Concept and AI Agent Orchestration by [Bence Csernak • bencium.io](https://www.bencium.io)**

## 🚀 Key Features

### Core Monitoring
- **Multi-Source Crawling**: Successfully monitors all 7 major AI sources (OpenAI, DeepMind, Anthropic, Microsoft AI, arXiv, TechCrunch, VentureBeat)
- **GPT-4.1-mini Powered Analysis**: Uses cost-efficient GPT-4.1-mini model for sophisticated AGI indicator detection
- **Real-time Console Output**: Detailed logging shows every article being analyzed, batch progress, and errors
- **Enhanced Processing Indicators**: Glowing button animation and automatic console expansion during analysis
- **Real-time Alerts**: Automated detection and severity classification (none/low/medium/high/critical)
- **Cross-Validation**: Independent verification system that only increases scores (never decreases) to ensure no AGI progress is hidden

### Advanced Analytics
- **Historical Tracking**: Complete database of all analyses with trend data
- **Trend Visualization**: Interactive charts showing AGI risk trends over time
- **Risk Assessment**: Daily, weekly, and monthly trend analysis
- **Pattern Recognition**: Identifies unusual spikes or accelerating trends

### Enhanced Detection System
- **Comprehensive AGI Indicators**:
  - Recursive self-improvement capabilities
  - Novel algorithm creation
  - Cross-domain generalization
  - Emergent capabilities from scale
  - Meta-learning breakthroughs
  - Autonomous research abilities
  - Human-level performance on complex tasks
  - Reasoning and planning breakthroughs
  - Self-awareness indicators
  - Generalization leaps
- **Near-term AGI Detection**: Also monitors architectural innovations, benchmark improvements (>10%), multi-modal capabilities, tool use, and chain-of-thought reasoning
- **Improved Scoring System**:
  - 0.0-0.1: No AGI relevance
  - 0.1-0.3: Minor AI advancements
  - 0.3-0.5: Significant AGI progress
  - 0.5-0.7: Major breakthrough
  - 0.7-1.0: Critical AGI development
- **Evidence Quality Rating**: Classifies findings as speculative, circumstantial, or direct
- **Cross-Reference System**: Suggests additional sources for verification

### Beautiful UI
- **Anthropic-Inspired Design**: Clean, minimal interface with sophisticated aesthetics
- **Four-Tab Navigation**: Overview, Findings, Analysis, and Trends
- **Enhanced Risk Level Indicator**: Shows current risk level with details (average score, critical findings count)
- **Real-time Console Output**: Floating console window shows detailed analysis progress
- **Processing Animations**: Glowing button effect and automatic console expansion during analysis
- **Validation UI**: Clear "Get 2nd opinion" button with detailed summary dialog
- **Source Status Cards**: Shows article counts and working status for each source
- **Responsive Layout**: Works seamlessly on desktop and mobile devices

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 14 + React 19 + TypeScript
- **Styling**: TailwindCSS with custom Anthropic-inspired theme
- **Database**: PostgreSQL (via Neon) + Prisma ORM
- **AI Integration**: OpenAI GPT-4.1
- **Web Crawling**: 
  - Advanced multi-strategy crawler with RSS feed support
  - Playwright browser automation for JavaScript-heavy sites
  - User agent rotation and stealth techniques
  - Rate limiting (1 request per 2 seconds)
- **Data Visualization**: Custom SVG trend charts

### Database Schema
```prisma
- CrawlResult: Stores crawled articles
- AnalysisResult: Enhanced with severity, evidence quality, and cross-references
- HistoricalData: Tracks metrics over time
- TrendAnalysis: Aggregated trend data for visualization
```

## 🛠️ Installation

### Prerequisites
Before starting, you'll need to set up free accounts for:

1. **OpenAI API Key** (Required)
   - Sign up at [platform.openai.com](https://platform.openai.com)
   - Go to API Keys section and create a new key
   - Free tier includes $5 credit (enough for ~1000 analyses)
   - Note: You'll need to add payment method for continued use

2. **PostgreSQL Database** (Required - Choose one):
   - **[Neon](https://neon.tech)** (Recommended - Free tier)
     - Sign up and create a new project
     - Copy the connection string from the dashboard
     - Free tier: 3GB storage, perfect for this project
   - **[Supabase](https://supabase.com)** (Alternative)
     - Create new project and get the connection string
     - Free tier: 500MB storage
   - **Local PostgreSQL**
     - Install PostgreSQL locally
     - Create a database: `createdb agi_detector`
     - Connection string: `postgresql://localhost/agi_detector`

3. **Firecrawl API Key** (Optional but recommended)
   - Sign up at [firecrawl.dev](https://www.firecrawl.dev)
   - Get your API key from dashboard
   - Free tier: 500 credits/month (enough for DeepMind & Anthropic crawling)
   - Without this, DeepMind and Anthropic sources won't work

### Installation Steps

1. **Clone the repository**:
```bash
git clone https://github.com/bencium/agi-detector.git
cd agi-detector
```

2. **Install dependencies**:
```bash
npm install --legacy-peer-deps

# Install Playwright browsers for advanced crawling
npx playwright install chromium
```

3. **Set up environment variables**:
Create a `.env.local` file with exactly these variables:
```env
# PostgreSQL Database
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
# Optional direct connection for migrations:
DIRECT_URL="postgresql://user:password@host/database?sslmode=require"

# OpenAI API Key
API_KEY=sk-...

# Optional: Override default analysis model
# Default: OPENAI_MODEL=gpt-5-mini
# OPENAI_MODEL=gpt-5-mini

# Firecrawl API Key (optional - for DeepMind and Anthropic)
# Get your API key from https://www.firecrawl.dev/
# Sign up for free tier at https://www.firecrawl.dev/pricing
FIRECRAWL_API_KEY=fc-...

# Optional: Proxy for web crawling
PROXY_URL="http://your-proxy:port"

# Optional: Brave Search API (fallback search)
# Enables site-restricted queries for sources without RSS or heavy blocking
BRAVE_API_KEY=bs-...

# Optional: Validation UI thresholds (client-side)
# NEXT_PUBLIC_VALIDATION_MIN_SEVERITY=medium  # none|low|medium|high|critical
# NEXT_PUBLIC_VALIDATION_ALWAYS=false         # show Validate for all analyses
```

**Important Notes about .env.local**:
- Replace `DATABASE_URL` with your actual PostgreSQL connection string
- Replace `API_KEY` with your OpenAI API key (no quotes needed)
- Replace `FIRECRAWL_API_KEY` with your Firecrawl key (no quotes needed)
- If provided, `BRAVE_API_KEY` enables Brave site search fallback
- The format must be exactly as shown (no extra quotes around keys)

4. **Set up the database**:
```bash
npx prisma generate
npx prisma db push
```

5. **Run the development server**:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### 🎯 Quick Start Tips

1. **First Run**:
   - Click "Run Manual Scan" to crawl all sources
   - The system will automatically analyze articles for AGI indicators
   - Check the console output at the bottom for progress

2. **Cost Optimization**:
   - The system uses GPT-4.1-mini which is very cost-efficient
   - Each analysis costs ~$0.001 (1000 analyses ≈ $1)
   - Firecrawl free tier is sufficient for daily monitoring

3. **Troubleshooting**:
   - If sources show 0 articles, check your Firecrawl API key
   - Database connection errors: Verify your DATABASE_URL format
   - OpenAI errors: Ensure your API key has credits

### 🔒 Security Notes

**CRITICAL: Protect Your API Keys**
- ⚠️ **NEVER** commit `.env` or `.env.local` files to version control
- ⚠️ Keep your OpenAI, database, and other API keys secure and private
- ⚠️ For production deployments, use environment variables from your hosting platform

**Security Features (October 2025 Update):**
- ✅ SSRF protection - blocks localhost, private IPs, and cloud metadata endpoints
- ✅ Safe JSON parsing - prevents crashes from malformed responses
- ✅ Input validation - all API parameters validated with Zod schemas
- ✅ Request limits - 1MB body size, 10MB response size, 30s timeouts
- ✅ Security headers - X-Frame-Options, XSS protection, content-type sniffing protection
- ✅ Browser security - Playwright runs without dangerous --disable-web-security flags
- ✅ SQL injection protection - Prisma ORM with parameterized queries
- ✅ Regular dependency updates - automated security patch management

**Best Practices for Users:**
1. **API Keys**: Use separate keys for development/production, rotate regularly
2. **Network**: Only crawl trusted public sources (default configuration is safe)
3. **Updates**: Run `npm update` and `npm audit fix` regularly for security patches
4. **Monitoring**: Watch for unusual API usage or costs
5. **Local Only**: This tool is for local use; don't expose APIs publicly without authentication

**For Security Issues:**
See [SECURITY.md](SECURITY.md) for our security policy and how to report vulnerabilities responsibly.

### 🗄️ Database (Prisma) Notes
- If `DATABASE_URL` is not set, the server runs in a no-DB mode. API routes like `/api/data` and `/api/trends` return empty arrays so you can exercise the UI and crawling/analysis flows without persistence.
- To enable persistence locally:
  1) Set `DATABASE_URL` in `.env.local`.
  2) Run `npx prisma generate`.
  3) Run `npx prisma db push` (or `npx prisma migrate dev`).

## 🕷️ Web Crawling Implementation

### Advanced Crawling Features
The AGI Detector uses a sophisticated multi-strategy crawling system to bypass blocking and collect data from various sources:

#### Crawling Strategies (in order of attempt):
1. **RSS Feed Parsing**: Primary method for most sources
   - Fastest and most reliable
   - No blocking issues
   - Structured data format

2. **Advanced HTTP Requests**: Fallback with stealth headers
   - User agent rotation
   - Browser-like headers
   - Cookie support
   - Automatic decompression

3. **Brave Web Search (New)**: Site-restricted fallback via Brave Search API
   - Query form: `site:<host> [source-specific keywords]`
   - Normalizes results to article candidates (title, snippet, URL)
   - Honors a short TTL cache and minimal rate-limiting
   - Requires `BRAVE_API_KEY`

4. **Firecrawl API**: For heavily protected sources
   - Professional web scraping service
   - Handles JavaScript rendering
   - Bypasses most anti-bot measures
   - Limited to 50 requests/day (cached for 24h)

5. **Browser Automation**: Last resort using Playwright
   - Full JavaScript rendering
   - Stealth plugins to avoid detection
   - Random viewport sizes
   - Human-like delays

#### Working Sources:
- ✅ **OpenAI Blog**: ~500 articles via RSS feed
- ✅ **DeepMind Research**: ~100 articles via advanced crawling
- ✅ **Anthropic Blog**: 3+ articles via Firecrawl API
- ✅ **Microsoft AI Blog**: ~30 articles via RSS feed  
- ✅ **TechCrunch AI**: ~60 articles via RSS feed
- ✅ **VentureBeat AI**: ~90 articles via RSS feed
- ✅ **arXiv AI**: ~200 articles via HTML parsing

### Crawler Configuration
The crawler includes:
- **Rate Limiting**: 1 request per 2 seconds
- **Random Delays**: 2-5 seconds between requests
- **User Agent Pool**: Rotates through real browser user agents
- **Error Handling**: Automatic retries with exponential backoff
- **Resource Cleanup**: Proper browser instance management

## 📊 Usage Guide

### Manual Monitoring
1. Click "Run Manual Scan" to immediately crawl all sources
2. The system will automatically analyze findings for AGI indicators
3. View results in the "Analysis" tab with severity ratings

### Automated Monitoring
1. Click "Start Monitoring" to enable daily automated crawls
2. The system checks every hour and runs a crawl every 24 hours
3. Critical findings trigger immediate alerts

### Trend Analysis
1. Navigate to the "Trends" tab
2. Select time period: Daily, Weekly, or Monthly
3. View risk trends, milestones, and historical patterns

### Validation System
1. Articles marked for verification show a "Validate" button with "Get 2nd opinion" text
2. Click to run independent AI analysis that:
   - Never decreases scores (only increases)
   - Finds additional AGI indicators
   - Increases confidence levels
   - Cross-checks with suggested sources
3. Shows detailed summary with:
   - Score changes (e.g., 5% → 15%)
   - Confidence changes
   - New indicators found
   - AI reasoning

## 🔧 API Endpoints

- `POST /api/crawl` - Trigger manual crawl of all sources
- `POST /api/analyze-all` - Analyze all unprocessed articles (processes in batches of 50)
- `GET /api/data` - Get all crawled articles and analyses with source statistics
- `GET /api/trends?period={daily|weekly|monthly}` - Fetch trend data
- `POST /api/validate` - Validate specific analysis results (only increases scores)
- `POST /api/test-crawler` - Test individual crawler sources
 - `POST /api/backfill-historical` - One-off backfill of HistoricalData from existing analyses
 - `POST /api/backfill-severities` - One-off recompute of severities from scores (escalate-only)
- `GET /api/db-health` - Quick DB connectivity and counts (crawl/analysis/trends)
  ```json
  {
    "source": {
      "name": "OpenAI Blog",
      "url": "https://openai.com/blog",
      "selector": ".ui-list__item",
      "titleSelector": ".ui-title-text",
      "contentSelector": ".prose",
      "linkSelector": "a"
    }
  }
  ```

## 🧪 Testing

Run the test suite:
```bash
npm test
```

For crawl testing:
```bash
# Test all sources
curl -X POST http://localhost:3000/api/crawl | jq

# Test specific source
curl -X POST http://localhost:3000/api/test-crawler \
  -H "Content-Type: application/json" \
  -d '{
    "source": {
      "name": "OpenAI Blog",
      "url": "https://openai.com/blog",
      "selector": ".ui-list__item",
      "titleSelector": ".ui-title-text",
      "contentSelector": ".prose",
      "linkSelector": "a"
    }
  }' | jq
```

## 🧯 Troubleshooting: Analyze-All Hangs / Timeouts

If clicking "Run Manual Scan" leads to a long spinner and no results, it’s often due to the analysis phase (`POST /api/analyze-all`) waiting on external services. We’ve hardened the endpoint to avoid indefinite hangs and added tunable timeouts.

What typically causes the delay
- OpenAI API timeouts during batch analysis (most common). You’ll see logs like:
  - `[Analyze] Error type: APIConnectionTimeoutError` and `Request timed out.`
- Database latency or connection issues when reading/writing analyses.

How it’s mitigated in code
- Per‑step timeouts and fast‑fail handling in `src/app/api/analyze-all/route.ts`:
  - DB reads/writes: 10–15s cap with clear log messages.
  - OpenAI analysis: explicit per‑request timeout and no automatic retries.
  - Batch processing: `Promise.allSettled` with a per‑batch timeout so one slow item doesn’t stall the whole request.
- On timeout, the API returns HTTP 504 with an array of `logs` instead of hanging.

Environment tuning (recommended for dev)
- Add these to `.env.local` to speed up responses and reduce timeouts:
  - `OPENAI_MODEL=gpt-4o-mini` (fast, reliable)
  - `OPENAI_TIMEOUT_MS=12000` (per‑request timeout)
  - `ANALYZE_BATCH_SIZE=2` (lower concurrency)
  - `BATCH_TIMEOUT_MS=18000` (per‑batch cap)

Quick diagnostics
- Check OpenAI reachability:
  - `curl -s http://localhost:3000/api/test-openai` should return a short message.
- Check DB health:
  - `curl -s http://localhost:3000/api/db-health` should be 200 with counts; 503 means no DB configured.
- Exercise analyze-all with a client timeout:
  - `curl -i -m 45 -X POST http://localhost:3000/api/analyze-all`
  - Expect 200 with results or 504 within ~20–40s with a JSON body including `logs`.

Reading the last log line
- Last line is “About to query database…” → DB `findMany` is stalling (pooling/network/statement timeout).
- Shows “Found X unanalyzed articles” then “Processing batch …” with repeated OpenAI timeouts → reduce `ANALYZE_BATCH_SIZE`, increase `OPENAI_TIMEOUT_MS`, or switch model.
- Timeouts during `DB create(analysisResult)`/`createMany(historicalData)` → investigate DB write latency; consider Neon pooled connection and statement timeout.

Notes
- The crawl step (`POST /api/crawl`) can be long, but it now runs independent of analysis timeouts. The UI triggers analyze-all after crawling; with the settings above, analysis should no longer block indefinitely.

## ⚠️ Important Notes

### Security
- Never commit `.env.local` to version control
- Rotate API keys regularly
- Use environment variables from your hosting platform in production

### Rate Limiting
- Crawler implements 2-5 second delays between requests
- OpenAI API calls are rate-limited to 1 per second
- Advanced rate limiter using token bucket algorithm
- Respects robots.txt via proxy configuration

### Crawler Dependencies
The advanced crawler requires:
- `playwright`: Browser automation
- `limiter`: Rate limiting
- `user-agents`: User agent rotation
- `xml2js`: RSS feed parsing

### Data Accuracy & Privacy
- This is an experimental system for research purposes
- Should not be relied upon as the sole indicator of AGI emergence
- Designed to supplement, not replace, expert analysis
- Article content is sent to OpenAI for analysis - review OpenAI's data policy
- URLs are accessed via Firecrawl and Brave Search APIs when configured
- All data stays in your local database; no telemetry or external reporting

## 🚀 Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Docker
```bash
docker build -t agi-detector .
docker run -p 3000:3000 --env-file .env.local agi-detector
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 Author

**Bence Csernak**
- Website: [bencium.io](https://bencium.io)
- GitHub: [@bencium](https://github.com/bencium)
- Concept and AI Agent Orchestration: [www.bencium.io](https://www.bencium.io)

## 🙏 Acknowledgments

- OpenAI for GPT-4 API access
- Anthropic for UI design inspiration
- All monitored AI research labs for their transparency
- Contributors and testers

## 🆕 Recent Updates (October 2025)

### v2.3 — Validation UX, Trends, and Risk Link
- Validation enhancements:
  - Persisted “last validated” metadata on each analysis (timestamp + before/after deltas).
  - Validate button shows for medium+ by default; configurable via `NEXT_PUBLIC_VALIDATION_MIN_SEVERITY` and `NEXT_PUBLIC_VALIDATION_ALWAYS`.
  - Severity is recomputed from score and never decreases; backfill endpoint provided.
- Trends improvements:
  - Live aggregation now reads from `HistoricalData` (with fallback), so charts reflect real scores without snapshots.
  - One‑time backfill endpoint adds missing historical rows for existing analyses.
- Risk banner action:
  - “View critical finding(s)” link jumps to the most severe analysis card.

### v2.2 — Brave Fallback, GPT‑5 Mini, No‑DB Mode
- Brave Web Search fallback integrated into crawler:
  - Site‑restricted queries via Brave API (`BRAVE_API_KEY`)
  - 10‑minute in‑memory cache + minimal rate limiting
  - Unit tests with axios mocked (`__tests__/lib/brave-search.test.ts`)
- Default analysis model switched to `gpt-5-mini` with low reasoning:
  - Overridable via `OPENAI_MODEL` and `OPENAI_REASONING_EFFORT`
  - Reasoning option added only for GPT‑5 models
- No‑DB mode for local development:
  - When `DATABASE_URL` is unset, Prisma is stubbed and APIs return empty datasets
  - Documented in README; `.env.local.example` updated
- DX and stability enhancements:
  - Jest migrated to `ts-jest` for TS/ESM; all tests passing
  - Next.js build skips lint/type checks for local builds (CI should still lint)
  - Added `.env.local.example` and support for `BRAVE_API_KEY`
  - Contributor guide `AGENTS.md` added and updated
- Fixes and refactors:
  - Validation schema moved to `src/lib/validation/schema.ts`
  - Prisma client wrapper simplified in `src/lib/prisma.ts`

### v2.1 — Complete Source Coverage & Enhanced UI
- All 7 sources working: DeepMind and Anthropic via Firecrawl API
- Enhanced console output and processing indicators
- Validation system improvements (second‑opinion flow; scores never decrease)

### v2.0 — Enhanced AGI Detection
- Upgraded to GPT‑4.1‑mini (historical)
- Improved AGI detection prompt and risk indicators
- Historical tracking + trend visualization

### Advanced Web Crawling
- **Multi-Strategy Approach**: RSS feeds → HTTP requests → Firecrawl API → Browser automation
- **Anti-Blocking**: User agent rotation, stealth techniques, rate limiting
- **All 7 Sources Working**: Successfully crawling 1000+ articles total
- **Firecrawl Integration**: Professional scraping for heavily protected sites (DeepMind, Anthropic)
- **Smart Caching**: 24-hour cache for API-limited services

---

**Disclaimer**: This is an experimental research tool. AGI detection is highly speculative and this system may produce false positives or miss important indicators. Always verify findings through multiple sources.
