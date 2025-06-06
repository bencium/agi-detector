# Testing Firecrawl Integration

## Setup Complete ✅

1. **API Key Added**: The Firecrawl API key has been added to `.env.local`
2. **Environment Fixed**: Fixed the formatting issue where API keys were on the same line
3. **Code Updated**: All hardcoded API keys removed, now using environment variables

## Testing Steps

1. **Restart the Next.js server** (required for new env variables):
   ```bash
   # Stop the current server (Ctrl+C)
   # Start it again
   npm run dev
   ```

2. **Test DeepMind crawler**:
   ```bash
   curl -X POST http://localhost:3000/api/test-crawler \
     -H "Content-Type: application/json" \
     -d '{
       "source": {
         "name": "DeepMind Research",
         "url": "https://deepmind.google/research/",
         "selector": ".research-card",
         "titleSelector": "h3",
         "contentSelector": "p",
         "linkSelector": "a"
       }
     }' | jq
   ```

3. **Test Anthropic crawler**:
   ```bash
   curl -X POST http://localhost:3000/api/test-crawler \
     -H "Content-Type: application/json" \
     -d '{
       "source": {
         "name": "Anthropic Blog",
         "url": "https://www.anthropic.com/news",
         "selector": ".news-item",
         "titleSelector": "h2, h3",
         "contentSelector": "p",
         "linkSelector": "a"
       }
     }' | jq
   ```

## Expected Results

When Firecrawl is working correctly, you should see:
- DeepMind: 1 article with blog content
- Anthropic: 2-3 articles from search results

## Console Output

Watch the console for messages like:
- `[Firecrawl] Using limited API for blocked source: DeepMind Research`
- `[Firecrawl] Found 2 articles from Anthropic Blog`
- `[Firecrawl] API usage: 1/50`

## Troubleshooting

If still getting 0 articles:
1. Check console for error messages
2. Verify API key is correct in `.env.local`
3. Check Firecrawl dashboard for API usage/errors
4. The API might be rate limited or the sites might be blocking Firecrawl