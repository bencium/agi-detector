# Setting up Firecrawl API Key

To enable crawling of DeepMind and Anthropic sources, you need to add your Firecrawl API key to the environment variables.

## Steps:

1. Add your Firecrawl API key to `.env.local`:

```bash
# Edit your .env.local file
echo "FIRECRAWL_API_KEY=fc-4a3d7c98f2c44eb382b6f0e84e9c83f7" >> .env.local
```

2. Restart your development server for the changes to take effect:

```bash
npm run dev
```

## Important Notes:

- **Never commit API keys to Git**: The `.env.local` file is already in `.gitignore`
- **Limited Usage**: The integration is configured to use max 50 API calls per day
- **Caching**: Results are cached for 24 hours to minimize API usage
- **Only for blocked sources**: Firecrawl is only used for DeepMind and Anthropic

## API Limits:

Your current Firecrawl plan has limited usage. The system will:
- Track daily usage (shown in console logs)
- Stop after 50 calls per day
- Cache results for 24 hours
- Only crawl when necessary

## Monitoring Usage:

Watch the console output for messages like:
- `[Firecrawl] API usage: 1/50`
- `[Firecrawl] Using cached data for DeepMind Research`
- `[Firecrawl] Daily limit reached (50), skipping`