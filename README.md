# AGI Detector 🧠

[![Build Status](https://img.shields.io/badge/build-in%20progress-yellow)](https://github.com/bencium/agi-detector)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

An advanced monitoring system designed to detect possible signals related to Artificial General Intelligence (AGI) by analyzing patterns across AI research labs, academic papers, benchmarks, and technology news. It is a signal and evidence assessment system, not an oracle.

## ✨ Recent Improvements
- **Layer-0 noise filter**: Cheap triage skips obvious non-capability updates before LLM analysis.
- **Evidence-gated severity**: Critical alerts require real benchmark deltas to reduce false positives.
- **Corroboration penalties**: Unverified high-claims get a score penalty during validation.
- **Signal assessment model**: Separates watch priority from evidence confidence so weak evidence is not presented as truth.
- **Honest source status**: Live, cached, stale, manual snapshot, and unavailable source states are labeled explicitly.
- **Score transparency**: UI shows model vs heuristic scores, secrecy boost, evidence counts, and penalties.
- **Smarter anomalies**: Source-grouped clustering + minimum AGI score threshold reduce noise.
- **CJK normalization**: Chinese text gets tokenization support and optional translation for consistent indicators.
- **Playwright retries**: Gated sources use Playwright with retries for better coverage.
- **Correlation MVP**: Cross-source co-occurrence of indicators + benchmark deltas surfaced on Overview.
- **LLM Insights**: SQL-aggregated indicator counts + LLM synthesis (cached daily).
- **Manual analysis**: Crawls no longer auto-trigger analysis; run analysis explicitly when ready.

## 🧭 Roadmap (Next)
- Improve selectors and stability for China lab pages (BAAI, ByteDance Seed, Tencent AI Lab, Shanghai AI Lab).
- Add ChinaXiv parsing refinements (author/date extraction + canonicalization).
- Expand bilingual evidence extraction + translation for mixed Chinese/English releases.
- Add learning loop (ruvector or agentdb): feedback-driven retrain or reranker to adapt thresholds over time.
- Correlations v2: embedding-based clustering across sources + time-windowed co-movement detection.
- Correlations v3: LLM synthesis over correlation clusters + anomaly alignment for context.

## 🎯 Project Vision

A sophisticated early-warning system that monitors the AI landscape for plausible AGI-related signals, distinguishes evidence from interpretation, and shows exactly why any claim may be wrong.

**Concept and AI Agent Orchestration by [Bence Csernak • bencium.io](https://www.bencium.io)**

## 🚀 Key Features

### Core Monitoring
- **Multi-Source Crawling**: Monitors major labs, academic hubs, and model releases (OpenAI, DeepMind, Anthropic, Microsoft AI, arXiv, BAAI, ByteDance Seed, Tencent AI Lab, Shanghai AI Lab, ChinaXiv, Qwen, Huawei Noah, ModelScope)
- **GPT-5-mini Powered Analysis**: Uses GPT-5-mini for more robust AGI indicator detection
- **Real-time Console Output**: Detailed logging shows every article being analyzed, batch progress, and errors
- **Enhanced Processing Indicators**: Glowing button animation and automatic console expansion during analysis
- **Real-time Alerts**: Automated detection and severity classification (none/low/medium/high/critical)
- **Corrective Validation**: Independent verification system that can raise, hold, lower, dismiss, or investigate a signal

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
- **Improved Signal Assessment**:
  - Watch priority: low, medium, high, critical
  - Evidence confidence: none, weak, moderate, strong, extraordinary
  - Source status: live, cached fresh, cached stale, manual snapshot, unavailable, model inferred
  - Claim ladder: mentioned, claimed, demonstrated, independently corroborated, replicated, sustained in deployment
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
- **Database**: PostgreSQL + pgvector (raw SQL via `pg` library)
- **Vector Search**: pgvector extension for semantic similarity (512-dim embeddings)
- **AI Integration**: OpenAI GPT-4o-mini
- **Web Crawling**:
  - Advanced multi-strategy crawler with RSS feed support
  - Playwright browser automation for JavaScript-heavy sites
  - User agent rotation and stealth techniques
  - Rate limiting (1 request per 2 seconds)
- **Data Visualization**: Custom SVG trend charts

### Database Schema
```sql
-- Core tables (auto-created on first API call)
- CrawlResult: Stores crawled articles (id, url, title, content, metadata)
- AnalysisResult: AI analysis with scores, severity, embeddings (pgvector)
- HistoricalData: Tracks metrics over time
- TrendAnalysis: Aggregated trend data for visualization
- AnalysisJob: Progress tracking for batch operations
- ARCProgress: ARC-AGI benchmark snapshots
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

3. **Firecrawl API Key** (Optional - legacy)
   - No longer required for Anthropic/DeepMind (Playwright handles these now)
   - Sign up at [firecrawl.dev](https://www.firecrawl.dev) if you want additional fallback
   - Free tier: 500 credits/month

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

# Local API auth (required)
LOCAL_API_KEY=local-...
NEXT_PUBLIC_LOCAL_API_KEY=local-...

# Optional: Override default analysis model
# Default: OPENAI_MODEL=gpt-5-mini
# OPENAI_MODEL=gpt-5-mini

# Optional: LLM insights model
# INSIGHTS_MODEL=gpt-5-mini

# Optional: Insights cache TTL (minutes)
# Default: 360 (6 hours)
# INSIGHTS_TTL_MINUTES=360

# Optional: Force Neon-only (disable local DB hostnames)
# NEON_ONLY=true

# Optional: Analyze-all job limits
# ANALYZE_JOB_LIMIT=50
# ANALYZE_BATCH_SIZE=2
# OPENAI_TIMEOUT_MS=12000
# OPENAI_MAX_RETRIES=3
# OPENAI_RETRY_BASE_MS=1500
# BATCH_TIMEOUT_MS=18000
# DISABLE_ANALYZE_RATE_LIMIT=true

# Optional: Multi-signal scoring weights
# MODEL_SCORE_WEIGHT=0.85
# HEURISTIC_SCORE_WEIGHT=0.15
# HEURISTIC_MAX=0.4

# Optional: Evals threshold
# EVAL_POSITIVE_THRESHOLD=0.3

### Evals & Metrics
- `GET /api/evals?days=30&threshold=0.3` — compute precision/recall/f1 from feedback.
- `GET /api/evals?days=30&threshold=0.3&persist=true` — persist snapshot in `AccuracyMetrics`.
- `GET /api/metrics` — quick pipeline counts + latest timestamps.

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
- Set `LOCAL_API_KEY` and `NEXT_PUBLIC_LOCAL_API_KEY` to the same local secret
- Replace `FIRECRAWL_API_KEY` with your Firecrawl key (no quotes needed)
- If provided, `BRAVE_API_KEY` enables Brave site search fallback
- The format must be exactly as shown (no extra quotes around keys)

4. **Set up the database** (if using local PostgreSQL):
```bash
# Enable pgvector extension (required for semantic search)
psql -d your_database -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Tables are auto-created on first API call
# For Neon/Supabase, pgvector is pre-installed
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
   - No paid API required for crawling (Playwright handles blocked sources)

3. **Troubleshooting**:
   - If sources show 0 articles, ensure Playwright browsers are installed (`npx playwright install chromium`)
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
- ✅ SQL injection protection - parameterized queries via pg library
- ✅ Regular dependency updates - automated security patch management

**Best Practices for Users:**
1. **API Keys**: Use separate keys for development/production, rotate regularly
2. **Network**: Only crawl trusted public sources (default configuration is safe)
3. **Updates**: Run `npm update` and `npm audit fix` regularly for security patches
4. **Monitoring**: Watch for unusual API usage or costs
5. **Local Only**: This tool is for local use; don't expose APIs publicly without authentication

**For Security Issues:**
See [SECURITY.md](SECURITY.md) for our security policy and how to report vulnerabilities responsibly.

### 🗄️ Database Notes
- If `DATABASE_URL` is not set, the server runs in a no-DB mode. API routes like `/api/data` and `/api/trends` return empty arrays so you can exercise the UI and crawling/analysis flows without persistence.
- To enable persistence locally:
  1) Set `DATABASE_URL` in `.env.local`.
  2) Tables are auto-created on first API call.
  3) For pgvector support, run: `psql -d your_db -c "CREATE EXTENSION IF NOT EXISTS vector;"`

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

4. **Browser Automation**: Primary for JavaScript-heavy sites (Playwright)
   - Full JavaScript rendering
   - Stealth plugins to avoid detection
   - Random viewport sizes
   - Human-like delays

#### Working Sources:
- ✅ **OpenAI Blog**: ~500 articles via RSS feed
- ✅ **DeepMind Research**: ~90 articles via Playwright browser automation
- ✅ **Anthropic Blog**: ~16 articles via Playwright (React SPA)
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

## 📱 UI Guide

### Overview Tab
- **Signal Dashboard**: Shows ARC-AGI-2 benchmark evidence without treating it as an AGI meter
- **Monitoring Status**: Groups sources by type (ARC, Research Labs, News)
- **Action Buttons**: Start/Stop monitoring, Run Manual Scan with progress bar
- **Progress Bar**: Shows % complete, ETA, current article during analysis

### Findings Tab
- Lists all crawled articles from monitored sources
- Shows title, content excerpt, source, timestamp, external link

### Analysis Tab
- AI-analyzed articles with watch-priority scores, evidence confidence, and uncertainty reasons
- Color-coded severity badges (critical/high/medium/low/none)
- Detected indicators, cross-references, explanations
- Validation button for second-opinion analysis

### Trends Tab
- Historical charts (daily/weekly/monthly periods)
- Average and max score lines
- Critical alert indicators (pulsing red dots)
- Risk assessment metrics

---

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
1. Articles marked for verification show a "Validate" button with corrective second-opinion text
2. Click to run independent AI analysis that:
   - Can raise, hold, lower, dismiss, or investigate a signal
   - Finds additional plausible indicators
   - Adjusts confidence levels up or down
   - Cross-checks with suggested sources
3. Shows detailed summary with:
   - Score changes (e.g., 5% → 15%)
   - Confidence changes
   - New indicators found
   - AI reasoning

## 🔧 API Endpoints

- `POST /api/crawl` - Trigger manual crawl of all sources
- `POST /api/analyze-all` - Analyze all unprocessed articles (processes in batches of 50)
- `GET /api/analyze-status?jobId=X` - Poll analysis job progress (%, ETA, current article)
- `GET /api/data` - Get all crawled articles and analyses with source statistics
- `GET /api/trends?period={daily|weekly|monthly}` - Fetch trend data
- `POST /api/validate` - Validate specific analysis results; can raise, hold, lower, dismiss, or investigate
- `POST /api/test-crawler` - Test individual crawler sources
- `GET /api/arc` - Fetch ARC-AGI benchmark data (official, Kaggle, GitHub)
- `POST /api/arc` - Force refresh ARC data
- `GET /api/similar?id=X` - Find semantically similar articles (pgvector)
- `GET /api/backfill-embeddings` - Check embedding status
- `POST /api/backfill-embeddings` - Generate missing embeddings
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

## 🔍 Vector Search (pgvector)

The system uses pgvector for semantic similarity search:

**Status:**
- ✅ pgvector extension enabled
- ✅ 512-dimensional embeddings via `text-embedding-3-small`
- ✅ HNSW index for fast similarity queries
- ⚠️ Embeddings generated on-demand (not auto during analysis)

**Usage:**
```bash
# Check embedding status
curl http://localhost:3000/api/backfill-embeddings

# Generate missing embeddings (~$0.02 for 1000 articles)
curl -X POST http://localhost:3000/api/backfill-embeddings

# Find similar articles
curl http://localhost:3000/api/similar?id=<analysis-uuid>
```

**Future Plans:**
- Auto-generate embeddings during analysis
- Semantic search UI
- Anomaly detection (find outliers)

---

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

## 🆕 Recent Updates

### v2.6 — Honest Signal Assessment Methodology

**Signal Methodology:**
- Replaced ARC-only "toward AGI" language with benchmark evidence classification.
- Added watch priority and evidence confidence as separate concepts.
- Added source freshness/status labels for live, cached, stale, manual snapshot, and unavailable data.
- Added uncertainty reasons and required verification metadata to signal assessments.
- Validation can now lower or dismiss weak signals instead of ratcheting scores upward.

**ARC Benchmark Evidence:**
- ARC-AGI-2 is treated as benchmark evidence only, not an AGI or ASI meter.
- Failed live scraping no longer appears as fresh data.
- Historical/manual snapshots are labeled as manual snapshots with limitations.

### v2.5 — ARC Benchmark Indicator & Crawler Fixes (December 2025)

**ARC Benchmark Indicator:**
- ARC-AGI-2 results are shown as benchmark movement, not percent toward AGI.
- Benchmark scores include source status and limitations.
- Added real-time benchmark signal calculation from official ARC leaderboard data when available.

**Crawler Improvements:**
- Replaced Firecrawl dependency with native Playwright for Anthropic/DeepMind
- Updated CSS selectors for Anthropic's React SPA (FeaturedGrid, PublicationList)
- Fixed empty linkSelector handling in browser automation
- DeepMind now fetching 90+ articles via Playwright

**ARC Challenge Categories:**
- Removed hardcoded fake percentages (3%, 2%, 1%)
- Now displays "N/A - Not publicly available" for categories without official data
- Categories based on actual ARC-AGI-2 benchmark structure

**Bug Fixes:**
- Fixed database UUID generation (`gen_random_uuid()`)
- Fixed TypeScript interface for AnalysisResult timestamps
- Fixed data path for ARC progress API response

**Known Limitation:**
- Historical articles (like OpenAI's 2019 "Emergent Tool Use") may score high because they describe genuinely impressive capabilities
- Future: Add temporal weighting to reduce scores for older breakthroughs

### v2.4 — Raw SQL Migration & Progress Tracking (December 2025)

**Architecture:**
- Migrated from Prisma ORM to raw PostgreSQL with `pg` library
- Added pgvector extension for semantic search (512-dim embeddings)
- Reduced bundle size by ~5MB (removed Prisma client)

**Progress Indicator:**
- Real-time progress bar during batch analysis
- ETA prediction based on average batch time
- Shows current article, success/failure counts
- New `/api/analyze-status` polling endpoint

**Improved AGI Detection:**
- More conservative scoring (reduced false positives)
- Added explicit disqualifiers for narrow domain work
- New skeptical guidance: "Could a PhD student replicate in 6 months?"
- Better severity mapping

**ARC-AGI Monitoring:**
- GitHub repository monitoring (arcprize/ARC-AGI-2)
- Tracks discussions, releases, commits
- Kaggle and Official leaderboard integration (partial)
- Signal Dashboard component

**New Endpoints:**
- `GET /api/analyze-status?jobId=X` - Poll job progress
- `GET /api/arc` - Fetch ARC benchmark data
- `GET /api/similar?id=X` - Find semantically similar articles
- `GET /api/backfill-embeddings` - Check/generate embeddings

### v2.3 — Validation UX, Trends, and Risk Link (October 2025)
- Validation enhancements:
  - Persisted “last validated” metadata on each analysis (timestamp + before/after deltas).
  - Validate button shows for medium+ by default; configurable via `NEXT_PUBLIC_VALIDATION_MIN_SEVERITY` and `NEXT_PUBLIC_VALIDATION_ALWAYS`.
  - Legacy note: older versions recomputed severity from score and never decreased. Current validation is corrective and may lower weak signals.
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
- All 7 sources working: DeepMind and Anthropic via browser automation
- Enhanced console output and processing indicators
- Validation system improvements (second-opinion flow; scores never decrease)

### v2.0 — Enhanced AGI Detection
- Upgraded to GPT‑4.1‑mini (historical)
- Improved AGI detection prompt and risk indicators
- Historical tracking + trend visualization

### Advanced Web Crawling
- **Multi-Strategy Approach**: RSS feeds → HTTP requests → Playwright browser automation
- **Anti-Blocking**: User agent rotation, stealth techniques, rate limiting
- **All 7 Sources Working**: Successfully crawling 1000+ articles total
- **Playwright Integration**: Browser automation for JavaScript-heavy sites (DeepMind, Anthropic)
- **No Paid APIs Required**: All crawling done via open-source tools

---

**Disclaimer**: This is an experimental research tool. AGI detection is highly speculative and this system may produce false positives or miss important indicators. Always verify findings through multiple sources.
