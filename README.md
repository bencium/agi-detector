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
Create a `.env.local` file with:
```env
# PostgreSQL Database
# For Neon: Copy from Neon dashboard (looks like: postgresql://user:pass@host.neon.tech/neondb?sslmode=require)
# For Supabase: Copy from Settings > Database
# For Local: postgresql://localhost/agi_detector
DATABASE_URL="your_postgresql_connection_string_here"

# OpenAI API Key (starts with sk-...)
# Get from: https://platform.openai.com/api-keys
API_KEY="sk-..."

# Firecrawl API Key (starts with fc-...)
# Get from: https://app.firecrawl.dev/api-keys
# Optional but enables DeepMind and Anthropic crawling
FIRECRAWL_API_KEY="fc-..."

# Optional: Proxy for web crawling
# PROXY_URL="http://your-proxy:port"
```

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
- Never commit `.env.local` to version control
- Keep your API keys secure
- For production, use environment variables from your hosting platform

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

3. **Firecrawl API**: For heavily protected sources
   - Professional web scraping service
   - Handles JavaScript rendering
   - Bypasses most anti-bot measures
   - Limited to 50 requests/day (cached for 24h)

4. **Browser Automation**: Last resort using Playwright
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

### Data Accuracy
- This is an experimental system for research purposes
- Should not be relied upon as the sole indicator of AGI emergence
- Designed to supplement, not replace, expert analysis

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

## 🆕 Recent Updates (June 2025)

### v2.1 - Complete Source Coverage & Enhanced UI
- **All 7 Sources Working**: DeepMind and Anthropic now accessible via Firecrawl API
- **Enhanced Console Output**: Real-time detailed logging showing:
  - Each article being analyzed
  - Batch progress updates
  - Error messages and debugging info
- **Improved Processing Indicators**: 
  - Glowing button animation during processing
  - Automatic console expansion
  - Clear visual feedback
- **Better Validation System**:
  - "Get 2nd opinion" explanation text
  - Detailed validation summary dialog
  - Scores can only increase (never decrease)
  - Shows before/after comparison

### v2.0 - Enhanced AGI Detection
- **Upgraded to GPT-4.1-mini**: Cost-efficient model with sophisticated analysis
- **Improved AGI Detection Prompt**: More sensitive to AGI indicators including:
  - Near-term AGI developments
  - Architectural innovations
  - Multi-modal capabilities
  - Better scoring gradients (0.1-0.3 for minor advances, 0.3-0.5 for significant progress)
- **Enhanced Risk Level Indicator**: Shows details like average score and critical findings count
- **Historical Tracking**: Complete database of all analyses
- **Trend Visualization**: Interactive charts showing AGI risk over time

### Advanced Web Crawling
- **Multi-Strategy Approach**: RSS feeds → HTTP requests → Firecrawl API → Browser automation
- **Anti-Blocking**: User agent rotation, stealth techniques, rate limiting
- **All 7 Sources Working**: Successfully crawling 1000+ articles total
- **Firecrawl Integration**: Professional scraping for heavily protected sites (DeepMind, Anthropic)
- **Smart Caching**: 24-hour cache for API-limited services

---

**Disclaimer**: This is an experimental research tool. AGI detection is highly speculative and this system may produce false positives or miss important indicators. Always verify findings through multiple sources.